import { Module } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { ConversationController } from './conversation.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { RequestModule } from 'src/request/request.module';
import { MessageModule } from '../message/message.module';

@Module({
  imports: [PrismaModule, RequestModule, MessageModule],
  controllers: [ConversationController],
  providers: [ConversationService],
})
export class ConversationModule {}
