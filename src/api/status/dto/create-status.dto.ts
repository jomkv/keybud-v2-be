import {
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateStatusDto {
  @IsNotEmpty()
  @IsNumberString()
  userId: number;

  @IsOptional()
  @IsNumberString()
  parentId?: number;

  @IsOptional()
  @IsString()
  title?: string;

  @IsNotEmpty()
  @IsString()
  description: string;
}
