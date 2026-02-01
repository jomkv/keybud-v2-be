import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateMessageDto } from './dto/create-message.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  randomBytes,
  createHash,
  createCipheriv,
  createDecipheriv,
} from 'crypto';
import EnvironmentVariables from 'src/shared/env-variables';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { Message } from '@prisma/client';
import { RedisService } from 'src/redis/redis.service';
import { MessageCursorKey } from 'src/shared/types/redis';
import { MessageGateway } from './gateways/message.gateway';

@Injectable()
export class MessageService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
    private readonly messageGateway: MessageGateway,
  ) {}

  private readonly PAGINATION_LIMIT = 15;
  private readonly ALGORITHM = 'aes-256-ctr';
  private readonly SECRET_KEY = this.generateKey(
    EnvironmentVariables.encryptionSecret,
  );

  /**
   * Generate a consistent 32-byte key from secret
   *
   * @param {string} secret - The secret string to generate encryption key from
   * @returns {Buffer} SHA-256 hash of the secret as a Buffer for encryption use
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
    const cipher = createCipheriv(this.ALGORITHM, this.SECRET_KEY, iv);

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

    const decipher = createDecipheriv(this.ALGORITHM, this.SECRET_KEY, iv);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString('utf-8');
  }

  /**
   * Retrieves the existing pagination cursor for a specific user and conversation from Redis
   *
   * @param {number} conversationId - The ID of the conversation
   * @param {number} userId - The ID of the user requesting messages
   * @returns {Promise<number | null>} The cursor ID if exists, null if no cursor found
   */
  private async getExistingCursor(
    conversationId: number,
    userId: number,
  ): Promise<number | null> {
    const existingCursorKey: MessageCursorKey = `message:cursor:${userId}-${conversationId}`;
    const existingCursor: string | null =
      await this.redisService.get(existingCursorKey);

    return existingCursor ? +existingCursor : null;
  }

  /**
   * Saves the pagination cursor for a specific user and conversation to Redis
   *
   * @param {number} conversationId - The ID of the conversation
   * @param {number} userId - The ID of the user
   * @param {number} cursor - The message ID to use as cursor for next pagination
   * @returns {Promise<void>}
   */
  private async saveCursor(
    conversationId: number,
    userId: number,
    cursor: number,
  ): Promise<void> {
    // TODO: Add cursorKey cleanup after client leaves page (use websocket)
    const cursorKey: MessageCursorKey = `message:cursor:${userId}-${conversationId}`;
    await this.redisService.set(cursorKey, String(cursor));
  }

  /**
   * Deletes the pagination cursor for a specific user and conversation from Redis
   * Used to reset pagination to start from the beginning
   *
   * @param {number} conversationId - The ID of the conversation
   * @param {number} userId - The ID of the user
   * @returns {Promise<void>}
   */
  private async deleteCursor(
    conversationId: number,
    userId: number,
  ): Promise<void> {
    const cursorKey: MessageCursorKey = `message:cursor:${userId}-${conversationId}`;
    await this.redisService.delete(cursorKey);
  }

  /**
   * Retrieves paginated messages from a conversation with automatic decryption
   * Supports cursor-based pagination and reset functionality for infinite scroll
   *
   * @param {number} conversationId - The ID of the conversation to fetch messages from
   * @param {number} userId - The ID of the user requesting messages (for cursor tracking)
   * @param {boolean} reset - Whether to reset pagination and start from latest messages
   * @returns {Promise<Message[]>} Array of decrypted messages in descending order (latest first)
   *
   * @example
   * // Initial load (reset pagination)
   * const latestMessages = await findMessagesFromConversation(123, 456, true);
   *
   * // Load more messages (continue pagination)
   * const olderMessages = await findMessagesFromConversation(123, 456, false);
   */
  public async findMessagesFromConversation(
    conversationId: number,
    userId: number,
    reset: boolean,
  ): Promise<Message[]> {
    if (reset) {
      await this.deleteCursor(conversationId, userId);
    }

    const existingCursor: number | null = reset
      ? null
      : await this.getExistingCursor(conversationId, userId);

    let messages: Message[] = [];

    if (existingCursor) {
      messages = await this.prismaService.message.findMany({
        take: this.PAGINATION_LIMIT,
        skip: 1, // Skip the cursor itself
        cursor: {
          id: +existingCursor,
        },
        where: { conversationId: conversationId },
        orderBy: {
          createdAt: 'desc', // Latest messages first
        },
      });
    } else {
      messages = await this.prismaService.message.findMany({
        take: this.PAGINATION_LIMIT,
        where: { conversationId: conversationId },
        orderBy: {
          createdAt: 'desc', // Latest messages first
        },
      });
    }

    const paginationCursor: number | null =
      messages.length > 0 ? messages[messages.length - 1].id : null; // Get id from last query result if possible

    if (paginationCursor) {
      await this.saveCursor(conversationId, userId, paginationCursor);
    }

    const decryptedMessages: Message[] = messages.map((message) => ({
      ...message,
      content: this.decryptContent(message.content),
    }));

    return decryptedMessages;
  }

  /**
   * Creates a new message in a conversation with automatic content encryption
   *
   * @param {CreateMessageDto} createMessageDto - DTO containing message content and conversation ID
   * @param {number} senderId - The ID of the user sending the message
   * @returns {Promise<Message>} The created message with encrypted content stored in database
   * @throws {BadRequestException} When conversation is not found (foreign key error)
   *
   * @example
   * const messageDto = { content: "Hello world!", conversationId: "123" };
   * const newMessage = await create(messageDto, 456);
   */
  async create(
    createMessageDto: CreateMessageDto,
    senderId: number,
  ): Promise<Message> {
    const encryptedContent = this.encryptContent(createMessageDto.content);

    try {
      const newMessage = await this.prismaService.message.create({
        data: {
          content: encryptedContent,
          conversationId: +createMessageDto.conversationId,
          senderId: senderId,
        },
      });

      const rawNewMessage = {
        ...newMessage,
        content: createMessageDto.content,
      };

      await this.emitNewMessage(rawNewMessage);

      return rawNewMessage;
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

  async emitNewMessage(newMessage: Message): Promise<void> {
    try {
      const conversationMembers =
        await this.prismaService.conversation.findUnique({
          where: {
            id: newMessage.conversationId,
          },
          select: {
            members: true,
          },
        });

      // Convert userIds to their equivalent redis User->Socket key
      const userIds = conversationMembers.members.map(
        (member) => member.userId,
      );

      await this.messageGateway.emitNewMessageToUsers(newMessage, userIds);
    } catch (error) {
      // Do nothing
    }
  }
}
