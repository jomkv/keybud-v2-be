import { PartialType } from '@nestjs/mapped-types';
import { CreateStatusDto } from './create-status.dto';
import { IsArray, IsOptional } from 'class-validator';

export class UpdateStatusDto extends PartialType(CreateStatusDto) {
  @IsOptional()
  @IsArray()
  removedAttachmentIds: number[];
}
