import { Module } from '@nestjs/common';
import { StatusService } from './status.service';
import { StatusController } from './status.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { UploadModule } from 'src/upload/upload.module';
import { RequestModule } from 'src/request/request.module';

@Module({
  imports: [PrismaModule, UploadModule, RequestModule],
  controllers: [StatusController],
  providers: [StatusService],
})
export class StatusModule {}
