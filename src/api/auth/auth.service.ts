import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from 'src/redis/redis.service';
import { AUTH_MESSAGES, AuthGateway } from './gateways/auth.gateway';
import { UserService } from '../user/user.service';
import {
  AuthInput,
  AuthResult,
  SessionNonceKey,
  TokenPayload,
} from 'src/shared/types/auth';
import { User } from 'generated/prisma';
import EnvironmentVariables from 'src/shared/env-variables';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
    private readonly authGateway: AuthGateway,
    private readonly userService: UserService,
  ) {}

  /**
   * Authenticates incoming user payload from oauth2 redirect.
   *
   * @param {AuthInput} input - The oauth2 user data
   * @returns {Promise<AuthResult>} Authentication result containing accessToken and user information
   */
  async authenticate(input: AuthInput): Promise<AuthResult> {
    const user: User = await this.userService.findOrCreate(input);

    const accessToken = await this.generateAccessToken(user);

    return { accessToken, userId: String(user.id), username: user.username };
  }

  /**
   * Authenticates incoming user payload from oauth2 redirect.
   *
   * @param {User} user - The oauth2 user data
   * @returns {Promise<string>} JWT accessToken
   */
  generateAccessToken(user: User): Promise<string> {
    const { id, username } = user;

    const payload: TokenPayload = {
      sub: String(id),
      username: username,
    };

    return this.jwtService.signAsync(payload, {
      secret: EnvironmentVariables.jwtSecret,
    });
  }

  /**
   * Emit login success message to client
   *
   * @param {string} nonce - Nonce that is associated with a sessionId
   */
  async emitSuccess(nonce: string): Promise<void> {
    const sessionNonceKey: SessionNonceKey = `nonce:${nonce}`;
    const sessionId = await this.redisService.get(sessionNonceKey);

    if (!sessionId) {
      console.error(`Session not found from ${sessionNonceKey}`);
      return;
    }

    await this.authGateway.emitToSession(sessionId, AUTH_MESSAGES.COMPLETE, {});
  }
}
