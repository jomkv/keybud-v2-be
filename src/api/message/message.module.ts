import { Module } from '@nestjs/common';
import { MessageService } from './message.service';
import { MessageController } from './message.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { RequestModule } from 'src/request/request.module';
import { RedisModule } from 'src/redis/redis.module';

@Module({
  imports: [PrismaModule, RequestModule, RedisModule],
  controllers: [MessageController],
  providers: [MessageService],
  exports: [MessageService],
})
export class MessageModule {}
