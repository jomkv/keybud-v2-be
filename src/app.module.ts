import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './api/user/user.module';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './api/auth/guards/auth.guard';
import { JwtModule } from '@nestjs/jwt';
import { RequestModule } from './request/request.module';
import { AuthModule } from './api/auth/auth.module';
import EnvironmentVariables from './shared/env-variables';
import { StatusModule } from './api/status/status.module';
import { MessageModule } from './api/message/message.module';
import { ConversationModule } from './api/conversation/conversation.module';

@Module({
  imports: [
    UserModule,
    JwtModule.register({
      secret: EnvironmentVariables.jwtSecret,
      signOptions: { expiresIn: '24h' },
    }),
    RequestModule,
    AuthModule,
    StatusModule,
    MessageModule,
    ConversationModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {}
