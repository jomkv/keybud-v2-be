import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateMessageDto } from './dto/create-message.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  createCipher,
  createDecipher,
  randomBytes,
  createHash,
  createCipheriv,
  createDecipheriv,
} from 'crypto';
import EnvironmentVariables from 'src/shared/env-variables';
import { PrismaClientKnownRequestError } from 'generated/prisma/runtime/library';
import { Message } from 'generated/prisma';

@Injectable()
export class MessageService {
  constructor(private readonly prismaService: PrismaService) {}

  private readonly algorithm = 'aes-256-ctr';
  private readonly secretKey = this.generateKey(
    EnvironmentVariables.encryptionSecret,
  );
  /**
   * Generate a consistent 32-byte key from secret
   */
  private generateKey(secret: string): Buffer {
    return createHash('sha256').update(secret).digest();
  }

  /**
   * @param {string} content - Message's content to be encrypted
   * @returns {string} Encrypted content in the format of "{iv}:{encrypted}"
   */
  private encryptContent(content: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv(this.algorithm, this.secretKey, iv);

    const encrypted = Buffer.concat([cipher.update(content), cipher.final()]);

    return iv.toString('hex') + ':' + encrypted.toString('hex');
  }

  /**
   * @param {string} content - Message's content to be decrypted
   * @returns {string} Decrypted content of the message
   */
  public decryptContent(content: string): string {
    const parts = content.split(':');

    if (parts.length !== 2) {
      throw new Error('Invalid encrypted content format');
    }

    // Extract IV and encrypted content
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = Buffer.from(parts[1], 'hex');

    const decipher = createDecipheriv(this.algorithm, this.secretKey, iv);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString('utf-8');
  }

  async create(createMessageDto: CreateMessageDto, senderId: number) {
    const encryptedContent = this.encryptContent(createMessageDto.content);

    try {
      return await this.prismaService.message.create({
        data: {
          content: encryptedContent,
          conversationId: +createMessageDto.conversationId,
          senderId: senderId,
        },
      });
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2003' // Foreign key error
      ) {
        throw new BadRequestException('Conversation not found');
      }

      throw error;
    }
  }
}
