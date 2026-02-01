import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Message } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { RedisService } from 'src/redis/redis.service';
import { REDIS_KEYS } from 'src/shared/redis-keys';
import {
  MESSAGE_EVENT_NAMES,
  MessageClientToServerEvents,
  MessageServerToClientEvents,
} from '@jomkv/keybud-v2-contracts';

@WebSocketGateway({
  namespace: 'message',
  cors: { origin: '*', credentials: true },
})
export class MessageGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  server: Server<MessageClientToServerEvents, MessageServerToClientEvents>;

  constructor(private readonly redisService: RedisService) {}

  async handleDisconnect(socket: Socket) {
    const userId: string | null = await this.getUserBySocket(socket.id);

    if (userId) {
      await this.cleanupSession(userId, socket.id);
    }
  }

  @SubscribeMessage(MESSAGE_EVENT_NAMES.SUBSCRIBE)
  async handleSessionRegister(
    @ConnectedSocket() socket: Socket,
    @MessageBody('userId') userId: string,
  ) {
    // User -> Socket
    await this.redisService.set(
      REDIS_KEYS.MESSAGE.USER_TO_SOCKET(+userId),
      socket.id,
    );

    // Socket - User
    await this.redisService.set(
      REDIS_KEYS.MESSAGE.SOCKET_TO_USER(socket.id),
      userId,
    );

    console.info(`Message Session Started: ${userId}`);
  }

  /**
   * Get a socketId by userId.
   *
   * @param {string} userId
   * @returns {Promise<string | null>} socketId
   */
  private async getSocketByUser(userId: string): Promise<string | null> {
    try {
      return await this.redisService.get(
        REDIS_KEYS.MESSAGE.USER_TO_SOCKET(+userId),
      );
    } catch (error) {
      console.error('Failed to get socket by user ID:', error);
      return null;
    }
  }

  /**
   * Get multiple socketIds by multiple userIds.
   *
   * @param {string[]} userIds
   * @returns {Promise<number[]>} socketId
   */
  private async getSocketsByUsers(userIds: number[]): Promise<string[]> {
    try {
      return (
        await this.redisService.getMany(
          userIds.map((id) => REDIS_KEYS.MESSAGE.USER_TO_SOCKET(id)),
        )
      ).filter((socketId) => socketId !== null);
    } catch (error) {
      console.error('Failed to get socket by user ID:', error);
      return [];
    }
  }

  /**
   * Get a userId by sessionId.
   *
   * @param {string} userId
   * @returns {Promise<string | null>} socketId
   */
  private async getUserBySocket(socketId: string): Promise<string | null> {
    try {
      return await this.redisService.get(
        REDIS_KEYS.MESSAGE.SOCKET_TO_USER(socketId),
      );
    } catch (error) {
      console.error('Failed to get user by socket ID:', error);
      return null;
    }
  }

  /**
   * Emit a new message to given users' sockets
   *
   * @param {Message} newMessage - New message to be emitted to members
   * @param {number[]} userIds - IDs of users to receive message
   * @returns {Promise<boolean>} True if message was sent successfully
   */
  public async emitNewMessageToUsers(
    newMessage: Message,
    userIds: number[],
  ): Promise<boolean> {
    try {
      const socketIds: string[] = await this.getSocketsByUsers(userIds);

      this.server
        .to(socketIds)
        .emit(MESSAGE_EVENT_NAMES.NEW_MESSAGE, newMessage);

      return true;
    } catch (error) {
      console.error(`Failed to emit to users ${newMessage.id}:`, error);
      return false;
    }
  }

  /**
   * Cleans up session mappings from Redis.
   *
   * @param {string} userId - The user ID to clean up
   * @param {string} socketId - The socket ID to clean up
   */
  private async cleanupSession(
    userId: string,
    socketId: string,
  ): Promise<void> {
    try {
      await this.redisService.delete(
        REDIS_KEYS.MESSAGE.USER_TO_SOCKET(+userId),
      );
      await this.redisService.delete(
        REDIS_KEYS.MESSAGE.SOCKET_TO_USER(socketId),
      );
      console.info(`Session cleanup completed: ${userId}`);
    } catch (error) {
      console.error('Failed to cleanup session:', error);
    }
  }
}
