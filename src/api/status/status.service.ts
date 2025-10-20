import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateStatusDto } from './dto/create-status.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { extname } from 'path';
import { createHash } from 'crypto';
import { UploadService } from 'src/upload/upload.service';
import { PrismaClientKnownRequestError } from 'generated/prisma/runtime/library';
import { Attachment, Status } from 'generated/prisma';

@Injectable()
export class StatusService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly uploadService: UploadService,
  ) {}

  /**
   * @param {number} statusId - The id of the status the attachment is for
   * @param {Express.Multer.File} attachment - The attachment
   * @param {number} timestamp - Current date in milliseconds
   * @returns {string} Unique key for the current attachment in a specific format
   */
  private generateAttachmentKey(
    statusId: number,
    attachment: Express.Multer.File,
    timestamp: number,
  ): string {
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
   * Creates a new status
   *
   * @param {CreateStatusDto} createStatusDto - The user input from request body
   * @param {Express.Multer.File[]} attachments - The images attached to the status
   */
  async create(
    createStatusDto: CreateStatusDto,
    attachments: Express.Multer.File[],
  ) {
    try {
      return await this.prismaService.$transaction(async (tx) => {
        // Create status
        const status = await tx.status.create({
          data: {
            userId: +createStatusDto.userId,
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
        const timestamp = Date.now();
        const attachmentWithKeys: {
          key: string;
          attachment: Express.Multer.File;
        }[] = attachments.map((attachment) => ({
          attachment: attachment,
          key: this.generateAttachmentKey(status.id, attachment, timestamp),
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

  findAll() {
    return `This action returns all status`;
  }

  findOne(id: number) {
    return `This action returns a #${id} status`;
  }

  update(id: number, updateStatusDto: UpdateStatusDto) {
    return `This action updates a #${id} status`;
  }

  async delete(id: number) {
    try {
      return await this.prismaService.$transaction(async (tx) => {
        const attachments: Attachment[] = await tx.attachment.findMany({
          where: { statusId: id },
        });

        // Extract s3 object keys
        const keys: string[] = attachments.map((attachment) => attachment.key);

        // Delete attachments from db
        await tx.attachment.deleteMany({
          where: { statusId: id },
        });

        // Delete s3 objects
        await this.uploadService.deleteMany(keys);

        // Delete status from db
        await tx.status.delete({ where: { id: id } });

        return {
          deletedStatus: id,
          deletedAttachmentsCount: keys.length,
        };
      });
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2025' // Record not found
      ) {
        throw new NotFoundException(`Status with ID ${id} not found`);
      }

      throw error;
    }
  }
}
