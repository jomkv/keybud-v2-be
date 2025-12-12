import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateStatusDto } from './dto/create-status.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { extname } from 'path';
import { createHash } from 'crypto';
import { UploadService } from 'src/upload/upload.service';
import { PrismaClientKnownRequestError } from 'generated/prisma/runtime/library';
import { Attachment, Status } from 'generated/prisma';
import { RedisService } from 'src/redis/redis.service';
import { REDIS_KEYS } from 'src/shared/redis-keys';
import EnvironmentVariables from 'src/shared/env-variables';
import { getSignedUrl } from '@aws-sdk/cloudfront-signer';

@Injectable()
export class StatusService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly uploadService: UploadService,
    private readonly redisService: RedisService,
  ) {}
  private readonly KEY_PAIR_ID = EnvironmentVariables.cloudfrontKeyPairId;
  private readonly PRIVATE_KEY = EnvironmentVariables.cloudfrontPrivateKey;
  private readonly DISTRIBUTION_DOMAIN = EnvironmentVariables.cloudfrontDomain;

  private readonly URL_CACHE_PERCENTAGE = 0.8; // 80%
  private readonly URL_CACHE_LIFETIME = 5; // In minutes

  /**
   * @param {number} statusId - The id of the status the attachment is for
   * @param {Express.Multer.File} attachment - The attachment
   * @param {number} timestamp - Current date in milliseconds
   * @returns {string} Unique key for the current attachment in a specific format
   */
  private generateAttachmentKey(
    statusId: number,
    attachment: Express.Multer.File,
  ): string {
    const timestamp = Date.now();
    const fileExtension = this.getFileExtension(attachment.originalname);
    const hash = this.generateShortHash(`${statusId}-${timestamp}`);

    return `status-attachments/${statusId}/${timestamp}-${hash}.${fileExtension}`;
  }

  /**
   * @param {string} originalFilename - Original filename from multer file
   * @returns {string} Extension of filename (excluding the dot), ie: txt, pdf, png, etc...
   */
  private getFileExtension(originalFilename: string): string {
    return extname(originalFilename).toLowerCase().substring(1);
  }

  /**
   * @param {string} input - String to use for creating hash
   * @returns {string} Hashed string
   */
  private generateShortHash(input: string): string {
    return createHash('sha1').update(input).digest('hex').substring(0, 8);
  }

  /**
   * Generate a signed CloudFront URL with intelligent caching
   * Reuses existing signed URLs if they haven't expired
   *
   * @param {string} objectKey - S3 object key
   * @param {number} userId - User requesting access
   * @returns {Promise<string>} Signed CloudFront URL
   */
  private async generateSignedUrl(
    objectKey: string,
    userId: number,
  ): Promise<string> {
    const cachedUrlKey = REDIS_KEYS.ATTACHMENT.SIGNED_URL(userId, objectKey);
    const cachedUrl = await this.redisService.get(cachedUrlKey);

    if (cachedUrl) {
      return cachedUrl;
    }

    const url = `https://${this.DISTRIBUTION_DOMAIN}/${objectKey}`;

    // Lifetime of Signed URL
    const urlExpirationTime = new Date();
    urlExpirationTime.setMinutes(
      urlExpirationTime.getMinutes() + this.URL_CACHE_LIFETIME,
    );

    const signedUrl = getSignedUrl({
      url: url,
      keyPairId: this.KEY_PAIR_ID,
      privateKey: this.PRIVATE_KEY,
      dateLessThan: urlExpirationTime.toISOString(),
    });

    // Store in cache for 80% of URL lifetime
    const cacheExpirationTime = Math.floor(
      this.URL_CACHE_LIFETIME * 60 * this.URL_CACHE_PERCENTAGE,
    );
    await this.redisService.set(cachedUrlKey, signedUrl, cacheExpirationTime);

    return signedUrl;
  }

  /**
   * Batch generate signed URLs with caching optimization
   * Only generates new URLs for uncached items
   *
   * @param {string[]} objectKeys - Array of S3 object keys
   * @param {number} userId - User requesting access
   * @returns {Promise<Record<string, string>>} Map of objectKey -> signedUrl
   */
  async generateBatchSignedUrls(
    objectKeys: string[],
    userId: number,
  ): Promise<Record<string, string>> {
    const signedUrls: Record<string, string> = {};
    const uncachedKeys: string[] = [];

    // Check cache for all keys
    for (const key of objectKeys) {
      const cachedUrlKey = REDIS_KEYS.ATTACHMENT.SIGNED_URL(userId, key);
      const cachedUrl = await this.redisService.get(cachedUrlKey);

      if (cachedUrl) {
        signedUrls[key] = cachedUrl;
      } else {
        uncachedKeys.push(key);
      }
    }

    // Generate new signed URLs only for uncached keys
    if (uncachedKeys.length > 0) {
      const cacheExpirationTime = Math.floor(
        this.URL_CACHE_LIFETIME * 60 * this.URL_CACHE_PERCENTAGE,
      );

      for (const key of uncachedKeys) {
        const url = `https://${this.DISTRIBUTION_DOMAIN}/${key}`;

        const expirationTime = new Date();
        expirationTime.setMinutes(
          expirationTime.getMinutes() + this.URL_CACHE_LIFETIME,
        );

        const signedUrl = getSignedUrl({
          url,
          keyPairId: this.KEY_PAIR_ID,
          privateKey: this.PRIVATE_KEY,
          dateLessThan: expirationTime.toISOString(),
        });

        signedUrls[key] = signedUrl;

        // Cache the new signed URL
        const cacheUrlKey = REDIS_KEYS.ATTACHMENT.SIGNED_URL(userId, key);
        await this.redisService.set(
          cacheUrlKey,
          signedUrl,
          cacheExpirationTime,
        );
      }
    }

    return signedUrls;
  }

  /**
   * Creates a new status
   *
   * @param {CreateStatusDto} createStatusDto - The user input from request body
   * @param {Express.Multer.File[]} attachments - The images attached to the status
   */
  async create(
    createStatusDto: CreateStatusDto,
    attachments: Express.Multer.File[],
    userId: number,
  ) {
    try {
      return await this.prismaService.$transaction(async (tx) => {
        // Create status
        const status = await tx.status.create({
          data: {
            userId: userId,
            parentId: createStatusDto.parentId
              ? +createStatusDto.parentId
              : null,
            title: createStatusDto.title,
            description: createStatusDto.description,
          },
        });

        // Immediately finish if no attachments
        if (!attachments || attachments.length === 0) {
          return { status, attachments: [] };
        }

        // Generate unique keys for each attachment
        const attachmentWithKeys: {
          key: string;
          attachment: Express.Multer.File;
        }[] = attachments.map((attachment) => ({
          attachment: attachment,
          key: this.generateAttachmentKey(status.id, attachment),
        }));

        // Upload attachments to s3
        await Promise.all(
          attachmentWithKeys.map((a) =>
            this.uploadService.upload(a.key, a.attachment.buffer),
          ),
        );

        // Save attachments to db
        const newAttachments = await tx.attachment.createManyAndReturn({
          data: attachmentWithKeys.map((a) => ({
            key: a.key,
            statusId: status.id,
          })),
        });

        return {
          status: status,
          attachments: newAttachments,
        };
      });
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2003' // Foreign key error
      ) {
        throw new BadRequestException('Parent status not found');
      }

      throw error;
    }
  }

  async findAll(userId: number) {
    const statuses = await this.prismaService.status.findMany({
      where: {
        parentId: null, // Only top-level statuses
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            switchType: true,
          },
        },
        attachments: {
          select: {
            id: true,
            key: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            stars: true, // Star count
            reposts: true, // Repost count
            comments: true, // Comment count (replies)
          },
        },
      },
      orderBy: {
        createdAt: 'desc', // Latest first
      },
    });

    const allAttachmentKeys: string[] = [];
    statuses.forEach((status) => {
      status.attachments.forEach((attachment) => {
        allAttachmentKeys.push(attachment.key);
      });
    });

    const signedUrlMap = await this.generateBatchSignedUrls(
      allAttachmentKeys,
      userId,
    );

    return statuses.map((status) => ({
      ...status,
      attachments: status.attachments.map((attachment) => ({
        ...attachment,
        signedUrl: signedUrlMap[attachment.key],
      })),
    }));
  }

  async findOne(id: number) {
    const status: Status | null = await this.prismaService.status.findUnique({
      where: { id: id },
    });

    if (!status) {
      throw new NotFoundException('Status not found');
    }

    // The status that the current status MIGHT be replying to
    const parentStatus: Status | null = status.parentId
      ? await this.prismaService.status.findUnique({
          where: { id: status.parentId },
        })
      : null;

    // Replies
    const childrenStatuses: Status[] = await this.prismaService.status.findMany(
      { where: { parentId: id } },
    );

    return {
      status,
      parentStatus,
      childrenStatuses,
    };
  }

  update(statusId: number, updateStatusDto: UpdateStatusDto, userId: number) {
    // TODO
    return `This action updates a #${statusId} status`;
  }

  async delete(statusId: number, userId: number) {
    const statusToDelete = await this.prismaService.status.findUnique({
      where: {
        id: statusId,
      },
    });

    if (!statusToDelete) {
      throw new NotFoundException(`Status with ID ${statusId} not found`);
    }

    if (statusToDelete.userId !== userId) {
      throw new UnauthorizedException(
        'User is not authorized to perform this action',
      );
    }

    return await this.prismaService.$transaction(async (tx) => {
      const attachments: Attachment[] = await tx.attachment.findMany({
        where: { statusId: statusToDelete.id },
      });

      // Extract s3 object keys
      const keys: string[] = attachments.map((attachment) => attachment.key);

      // Delete attachments from db
      await tx.attachment.deleteMany({
        where: { statusId: statusToDelete.id },
      });

      // Delete s3 objects
      await this.uploadService.deleteMany(keys);

      // Delete reposts and stars
      await tx.statusRepost.deleteMany({
        where: {
          statusId: statusToDelete.id,
        },
      });
      await tx.statusStar.deleteMany({
        where: {
          statusId: statusToDelete.id,
        },
      });

      // Delete status from db
      await tx.status.delete({ where: { id: statusToDelete.id } });

      return {
        deletedStatus: statusToDelete.id,
        deletedAttachmentsCount: keys.length,
      };
    });
  }

  async star(statusId: number, userId: number) {
    const existingStar = await this.prismaService.statusStar.findFirst({
      where: {
        statusId: statusId,
        userId: userId,
      },
    });

    if (existingStar) {
      throw new BadRequestException(
        `Status with ID ${statusId} is already starred`,
      );
    }

    try {
      return await this.prismaService.statusStar.create({
        data: {
          userId: userId,
          statusId: statusId,
        },
      });
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2025' // Record not found
      ) {
        throw new NotFoundException(`Status with ID ${statusId} not found`);
      }

      throw error;
    }
  }

  async unstar(statusId: number, userId: number) {
    const existingStar = await this.prismaService.statusStar.findFirst({
      where: {
        statusId: statusId,
        userId: userId,
      },
    });

    if (!existingStar) {
      throw new BadRequestException(
        `Status with ID ${statusId} is not starred`,
      );
    }

    return await this.prismaService.statusStar.delete({
      where: {
        id: existingStar.id,
      },
    });
  }

  async repost(statusId: number, userId: number) {
    const existingRepost = await this.prismaService.statusRepost.findFirst({
      where: {
        statusId: statusId,
        userId: userId,
      },
    });

    if (existingRepost) {
      throw new BadRequestException(
        `Status with ID ${statusId} is already reposted`,
      );
    }

    try {
      return await this.prismaService.statusRepost.create({
        data: {
          userId: userId,
          statusId: statusId,
        },
      });
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2025' // Record not found
      ) {
        throw new NotFoundException(`Status with ID ${statusId} not found`);
      }

      throw error;
    }
  }

  async unrepost(statusId: number, userId: number) {
    const existingRepost = await this.prismaService.statusRepost.findFirst({
      where: {
        statusId: statusId,
        userId: userId,
      },
    });

    if (!existingRepost) {
      throw new BadRequestException(
        `Status with ID ${statusId} is not reposted`,
      );
    }

    return await this.prismaService.statusRepost.delete({
      where: {
        id: existingRepost.id,
      },
    });
  }
}
