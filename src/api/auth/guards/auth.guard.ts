import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { UserService } from 'src/api/user/user.service';
import { RequestService } from 'src/request/request.service';
import EnvironmentVariables from 'src/shared/env-variables';
import { TokenPayload } from 'src/shared/types/auth';
import { User } from 'generated/prisma';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly usersService: UserService,
    private readonly jwtService: JwtService,
    private readonly requestService: RequestService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req: Request = context.switchToHttp().getRequest();

    const token: string = this.extractTokenFromCookies(req.cookies);

    const tokenPayload: TokenPayload = await this.verifyToken(token);

    const user: User = await this.validateUser(tokenPayload.sub);

    this.requestService.setUser(user);

    return true;
  }

  private extractTokenFromCookies(
    cookies: Record<string, string> | undefined,
  ): string {
    const token = cookies?.access_token;

    if (!token) {
      throw new UnauthorizedException('Access token not found');
    }

    return token as string;
  }

  private async verifyToken(token: string): Promise<TokenPayload> {
    try {
      return this.jwtService.verify(token, {
        secret: EnvironmentVariables.jwtSecret,
      });
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private async validateUser(userId: string): Promise<User> {
    try {
      const user = await this.usersService.findById(+userId);

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      return user;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error; // Rethrow auth error
      }

      console.error('Database error during user authentication');
      throw new UnauthorizedException('Authentication Failed');
    }
  }
}
