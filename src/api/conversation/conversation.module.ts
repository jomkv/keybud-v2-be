import { Module } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { ConversationController } from './conversation.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { RequestModule } from 'src/request/request.module';

@Module({
  imports: [PrismaModule, RequestModule],
  controllers: [ConversationController],
  providers: [ConversationService],
})
export class ConversationModule {}
