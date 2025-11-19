import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  UploadedFile,
  ValidationPipe,
  UploadedFiles,
  ParseIntPipe,
} from '@nestjs/common';
import { StatusService } from './status.service';
import { CreateStatusDto } from './dto/create-status.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { FilesInterceptor } from '@nestjs/platform-express';
import { AttachmentValidationPipe } from './pipes/attachment-validation.pipe';
import { RequestService } from 'src/request/request.service';

@Controller('status')
export class StatusController {
  constructor(
    private readonly statusService: StatusService,
    private readonly requestService: RequestService,
  ) {}

  @Post()
  @UseInterceptors(FilesInterceptor('attachments', 4))
  create(
    @Body(ValidationPipe) createStatusDto: CreateStatusDto,
    @UploadedFiles(new AttachmentValidationPipe())
    attachments: Express.Multer.File[],
  ) {
    const user = this.requestService.getUser();

    return this.statusService.create(createStatusDto, attachments, user.id);
  }

  @Get()
  findAll() {
    return this.statusService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.statusService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateStatusDto: UpdateStatusDto,
  ) {
    return this.statusService.update(id, updateStatusDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.statusService.delete(id);
  }
}
