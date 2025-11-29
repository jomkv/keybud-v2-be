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
    const user = this.requestService.getUser();

    return this.statusService.update(id, updateStatusDto, user.id);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    const user = this.requestService.getUser();

    return this.statusService.delete(id, user.id);
  }

  @Post(':id/star')
  star(@Param('id', ParseIntPipe) id: number) {
    const user = this.requestService.getUser();

    return this.statusService.star(id, user.id);
  }

  @Delete(':id/star')
  unstar(@Param('id', ParseIntPipe) id: number) {
    const user = this.requestService.getUser();

    return this.statusService.unstar(id, user.id);
  }

  @Post(':id/repost')
  repost(@Param('id', ParseIntPipe) id: number) {
    const user = this.requestService.getUser();

    return this.statusService.repost(id, user.id);
  }

  @Delete(':id/repost')
  unrepost(@Param('id', ParseIntPipe) id: number) {
    const user = this.requestService.getUser();

    return this.statusService.unrepost(id, user.id);
  }
}
