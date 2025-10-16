import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateStatusDto {
  @IsNotEmpty()
  userId: number;

  @IsOptional()
  @IsInt()
  parentId?: number;

  @IsOptional()
  @IsString()
  title?: string;

  @IsNotEmpty()
  @IsString()
  description: string;
}
