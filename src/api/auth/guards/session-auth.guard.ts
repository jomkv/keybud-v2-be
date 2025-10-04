import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { RequestService } from 'src/shared/services/request.service';
import { RedisService } from 'src/redis/redis.service';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { SessionNonceKey } from 'src/shared/types/auth';

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
    const nonceKey: SessionNonceKey = `nonce:${nonce}`;

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
