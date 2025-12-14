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
import { Attachment, Prisma, Status } from 'generated/prisma';
import { RedisService } from 'src/redis/redis.service';
import { REDIS_KEYS } from 'src/shared/redis-keys';
import EnvironmentVariables from 'src/shared/env-variables';
import { getSignedUrl } from '@aws-sdk/cloudfront-signer';
import { CONSTANTS } from 'src/shared/constants';

export interface AttachmentWithKey {
  key: string;
  attachment: Express.Multer.File;
}

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
    index: number,
  ): string {
    const timestamp = Date.now();
    const fileExtension = this.getFileExtension(attachment.originalname);
    const hash = this.generateShortHash(`${statusId}-${timestamp}`);

    return `status-attachments/${statusId}/${timestamp}-${index}-${hash}.${fileExtension}`;
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
   * Upload multiple attachments to the S3 bucket THEN DB
   *
   * @param {Express.Multer.File[]} attachments - Attachments from Form Data
   * @param {number} statusId - ID of the status that the attachments belong to
   * @param {Prisma.TransactionClient} client - (Optional) Transaction client to be used for the DB query
   * @returns {Promise<Attachment[]>} Newly created attachments from DB
   */
  private async uploadMultipleAttachments(
    attachments: Express.Multer.File[],
    statusId: number,
    client: Prisma.TransactionClient = this.prismaService,
  ): Promise<Attachment[]> {
    const attachmentWithKeys: AttachmentWithKey[] = attachments.map(
      (attachment, index) => ({
        attachment: attachment,
        key: this.generateAttachmentKey(statusId, attachment, index),
      }),
    );

    // Upload attachments to s3
    await Promise.all(
      attachmentWithKeys.map((a) =>
        this.uploadService.upload(a.key, a.attachment.buffer),
      ),
    );

    // Upload to DB and return
    return await client.attachment.createManyAndReturn({
      data: attachmentWithKeys.map((a) => ({
        key: a.key,
        statusId: statusId,
      })),
    });
  }

  /**
   * Deletes multiple existing attachments from the S3 bucket THEN DB
   *
   * @param {Partial<Pick<Attachment, 'key' | 'id'>>[]} attachmentsToDelete - Existing attachments from DB to be deleted
   * @param {number} statusId - ID of the status that the attachments belong to
   * @param {Prisma.TransactionClient} client - (Optional) Transaction client to be used for the DB query
   * @returns {Promise<number>} Count of deleted attachments
   */
  private async deleteMultipleAttachments(
    attachmentsToDelete: Partial<Pick<Attachment, 'key' | 'id'>>[],
    statusId: number,
    client: Prisma.TransactionClient = this.prismaService,
  ): Promise<number> {
    const keysToDelete: string[] = attachmentsToDelete.map(
      (attachment) => attachment.key,
    );

    // Delete s3 objects
    await this.uploadService.deleteMany(keysToDelete);

    const idsToDelete: number[] = attachmentsToDelete.map(
      (attachment) => attachment.id,
    );

    // Delete attachments from db
    const { count } = await client.attachment.deleteMany({
      where: {
        id: {
          in: idsToDelete,
        },
      },
    });

    return count;
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

        // Save attachments to db
        const newAttachments = await this.uploadMultipleAttachments(
          attachments,
          status.id,
          tx,
        );

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

  async update(
    statusToUpdate: Status,
    updateStatusDto: UpdateStatusDto,
    newAttachments: Express.Multer.File[],
  ) {
    return await this.prismaService.$transaction(async (tx) => {
      const existingAttachments = await tx.attachment.findMany({
        where: {
          statusId: statusToUpdate.id,
        },
      });

      const updatedExistingAttachmentsLength =
        existingAttachments.length -
        updateStatusDto.removedAttachmentIds.length;

      // Validate if total attachments will exceed 4
      if (
        updatedExistingAttachmentsLength + newAttachments.length >
        CONSTANTS.MAX_IMAGE_ATTACHMENTS_LENGTH
      ) {
        throw new BadRequestException(
          `Maximum of ${CONSTANTS.MAX_IMAGE_ATTACHMENTS_LENGTH} attachments`,
        );
      }

      // Update status
      const updatedStatus = await tx.status.update({
        where: {
          id: statusToUpdate.id,
        },
        data: {
          title: updateStatusDto.title,
          description: updateStatusDto.description,
          edittedAt: new Date(),
        },
      });

      // Immediately finish if no attachment changes
      if (
        newAttachments.length === 0 &&
        updateStatusDto.removedAttachmentIds.length === 0
      ) {
        return { updatedStatus, attachments: existingAttachments };
      }

      // Upload new attachments
      const createdAttachments = await this.uploadMultipleAttachments(
        newAttachments,
        statusToUpdate.id,
        tx,
      );

      // Get existing attachments to delete
      const attachmentsToDelete = existingAttachments.filter((att) => {
        return updateStatusDto.removedAttachmentIds.includes(att.id);
      });

      // Delete attachments
      await this.deleteMultipleAttachments(
        attachmentsToDelete,
        statusToUpdate.id,
        tx,
      );

      return {
        updatedStatus: updatedStatus,
        attachments: [...createdAttachments, ...existingAttachments],
      };
    });
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

      const deletedCount = await this.deleteMultipleAttachments(
        attachments,
        statusToDelete.id,
        tx,
      );

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
        deletedAttachmentsCount: deletedCount,
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
