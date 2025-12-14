import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  ValidationPipe,
  UploadedFiles,
  ParseIntPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { StatusService } from './status.service';
import { CreateStatusDto } from './dto/create-status.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { FilesInterceptor } from '@nestjs/platform-express';
import { AttachmentValidationPipe } from './pipes/attachment-validation.pipe';
import { RequestService } from 'src/request/request.service';
import { StatusOwnerGuard } from './guards/status-owner.guard';
import { Status } from 'generated/prisma';
import { CONSTANTS } from 'src/shared/constants';

@Controller('status')
export class StatusController {
  constructor(
    private readonly statusService: StatusService,
    private readonly requestService: RequestService,
  ) {}

  @Post()
  @UseInterceptors(
    FilesInterceptor('attachments', CONSTANTS.MAX_IMAGE_ATTACHMENTS_LENGTH),
  )
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
    const user = this.requestService.getUser();

    return this.statusService.findAll(user.id);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.statusService.findOne(id);
  }

  @UseGuards(StatusOwnerGuard)
  @UseInterceptors(
    FilesInterceptor('attachments', CONSTANTS.MAX_IMAGE_ATTACHMENTS_LENGTH),
  )
  @Patch(':id')
  update(
    @Req() req,
    @Body() updateStatusDto: UpdateStatusDto,
    @UploadedFiles(new AttachmentValidationPipe())
    attachments: Express.Multer.File[],
  ) {
    const statusToUpdate = req.status as Status;

    return this.statusService.update(
      statusToUpdate,
      updateStatusDto,
      attachments,
    );
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
