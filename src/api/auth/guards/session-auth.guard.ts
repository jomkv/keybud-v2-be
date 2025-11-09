import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { RequestService } from 'src/request/request.service';
import { RedisService } from 'src/redis/redis.service';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthNonceKey } from 'src/shared/types/redis';

/**
 * Session-based authentication guard that extends Google OAuth2 authentication.
 *
 * This guard performs the following operations:
 * 1. Extracts sessionId from query parameters
 * 2. Generates a cryptographically secure nonce for CSRF protection
 * 3. Stores the mapping in Redis for later validation, in the format of {nonce: sessionId}
 * 4. Delegates to the Google OAuth2 strategy for actual authentication
 *
 * Note:
 * - The sessionId that comes from the client is just a randomly generated UUID
 * - This is more of a pre-processor for the existing google oauth2 guard, it doesn't actually have a guard logic of its own
 *
 * The nonce is passed as the 'state' parameter to Google OAuth2 to prevent
 * CSRF attacks during the authentication flow.
 */
@Injectable()
export class SessionAuthGuard
  extends AuthGuard('google')
  implements CanActivate
{
  constructor(
    private readonly requestService: RequestService,
    private readonly redisService: RedisService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: Request = context.switchToHttp().getRequest();

    const sessionId = request.query.session as string;

    const nonce = crypto.randomUUID();
    const nonceKey: AuthNonceKey = `auth:nonce:${nonce}`;

    await this.redisService.set(nonceKey, sessionId);

    this.requestService.setSessionNonce(nonce);

    // Delegate logic onto parent guard
    return super.canActivate(context) as boolean | Promise<boolean>;
  }

  getAuthenticateOptions(context: ExecutionContext) {
    const request: Request = context.switchToHttp().getRequest();

    return {
      scope: ['profile', 'email', 'openid'],
      state: this.requestService.getSessionNonce(),
    };
  }
}
