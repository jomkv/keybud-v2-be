import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RedisService } from 'src/redis/redis.service';

export const AUTH_MESSAGES = {
  REGISTER: 'auth:subscribe', // client subscribes to our io
  REGISTER_SUCCESS: 'auth:subscribe_success', // inform client that subscription is successful
  COMPLETE: 'auth:complete', // client completes login
};

export const REDIS_KEYS = {
  SOCKET: (socketId: string) => `ws:socket:${socketId}`,
  SESSION: (sessionId: string) => `ws:session:${sessionId}`,
};

@WebSocketGateway({
  namespace: 'auth',
  cors: { origin: '*', credentials: true },
})
export class AuthGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly redisService: RedisService) {}

  async handleDisconnect(socket: Socket) {
    const sessionId: string | null = await this.getSessionBySocket(socket.id);

    if (sessionId) {
      await this.redisService.delete(REDIS_KEYS.SESSION(sessionId));
    }
  }

  @SubscribeMessage(AUTH_MESSAGES.REGISTER)
  async handleSessionRegister(
    @ConnectedSocket() socket: Socket,
    @MessageBody('sessionId') sessionId: string,
  ) {
    // Socket -> Session
    await this.redisService.set(REDIS_KEYS.SOCKET(socket.id), sessionId);

    // Session -> Socket
    await this.redisService.set(REDIS_KEYS.SESSION(sessionId), socket.id);

    console.info(`Session Started: ${sessionId}`);

    socket.emit(AUTH_MESSAGES.REGISTER_SUCCESS, { sessionId });
  }

  /**
   * Get a sessionId by socketId.
   *
   * @param {string} sessionId - The socketId
   * @returns {Promise<string | null>} sessionId
   */
  private async getSessionBySocket(socketId: string): Promise<string | null> {
    try {
      return await this.redisService.get(REDIS_KEYS.SOCKET(socketId));
    } catch (error) {
      console.error('Failed to get session by socket ID:', error);
      return null;
    }
  }

  /**
   * Get a socket by sessionId.
   *
   * @param {string} sessionId - The sessionId from nonce
   * @returns {Promise<Socket | null>} socketId
   */
  private async getSocketBySession(sessionId: string): Promise<Socket | null> {
    try {
      const socketId = await this.redisService.get(
        REDIS_KEYS.SESSION(sessionId),
      );

      const socket = this.server.sockets.sockets.get(socketId);

      if (!socket) {
        console.error(`Socket ${socketId} not found or disconnected`);
        return null;
      }

      return socket;
    } catch (error) {
      console.error('Failed to get socket by session ID:', error);
      return null;
    }
  }

  /**
   * Emit a message to a specific session
   *
   * @param {string} sessionId - The sessionId to emit message to
   * @param {string} event - The event name to emit
   * @param {any} data - The data to send
   * @returns {Promise<boolean>} True if message was sent successfully
   */
  public async emitToSession(
    sessionId: string,
    event: string,
    data: any,
  ): Promise<boolean> {
    try {
      const socket: Socket | null = await this.getSocketBySession(sessionId);

      if (!socket) {
        console.error(`No socket found for session: ${sessionId}`);
        return false;
      }

      socket.emit(event, data);
      return true;
    } catch (error) {
      console.error(`Failed to emit to session ${sessionId}:`, error);
      return false;
    }
  }
}
