import { Module } from '@nestjs/common';
import { MessageService } from './message.service';
import { MessageController } from './message.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { RequestModule } from 'src/request/request.module';

@Module({
  imports: [PrismaModule, RequestModule],
  controllers: [MessageController],
  providers: [MessageService],
})
export class MessageModule {}
