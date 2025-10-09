import { Module } from '@nestjs/common';
import { AuthGateway } from './gateways/auth.gateway';
import { AuthStrategy } from './strategies/auth.strategy';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { RedisModule } from 'src/redis/redis.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [RedisModule, JwtModule],
  providers: [AuthGateway, AuthStrategy, AuthService],
  controllers: [AuthController],
})
export class AuthModule {}
