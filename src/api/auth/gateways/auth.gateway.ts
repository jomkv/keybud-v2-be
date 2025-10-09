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

const AUTH_MESSAGES = {
  REGISTER: 'session:register', // client subscribes to our io
  REGISTER_SUCCESS: 'session:register_success', // inform client that subscription is successful
};

const REDIS_KEYS = {
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

  private async getSessionBySocket(socketId: string): Promise<string | null> {
    try {
      return await this.redisService.get(REDIS_KEYS.SOCKET(socketId));
    } catch (error) {
      console.error('Failed to get session by socket ID:', error);
      return null;
    }
  }

  private async getSocketBySession(sessionId: string): Promise<string | null> {
    try {
      return await this.redisService.get(REDIS_KEYS.SESSION(sessionId));
    } catch (error) {
      console.error('Failed to get socket by session ID:', error);
      return null;
    }
  }
}
