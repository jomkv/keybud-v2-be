import { Module } from '@nestjs/common';
import { AuthGateway } from './gateways/auth.gateway';
import { GoogleStrategy } from './strategies/google.strategy';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { RedisModule } from 'src/redis/redis.module';
import { JwtModule } from '@nestjs/jwt';
import { UserModule } from '../user/user.module';
import { RequestModule } from 'src/request/request.module';

@Module({
  imports: [RedisModule, JwtModule, UserModule, RequestModule],
  providers: [AuthGateway, GoogleStrategy, AuthService],
  controllers: [AuthController],
})
export class AuthModule {}
