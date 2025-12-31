import { Module } from '@nestjs/common';
import { MessageService } from './message.service';
import { MessageController } from './message.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { RequestModule } from 'src/request/request.module';
import { RedisModule } from 'src/redis/redis.module';
import { MessageGateway } from './gateways/message.gateway';

@Module({
  imports: [PrismaModule, RequestModule, RedisModule],
  controllers: [MessageController],
  providers: [MessageService, MessageGateway],
  exports: [MessageService],
})
export class MessageModule {}
