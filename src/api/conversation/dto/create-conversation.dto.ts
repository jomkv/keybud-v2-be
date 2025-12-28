import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsPositive,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateConversationDto {
  @IsNotEmpty()
  @IsArray()
  @ArrayMinSize(2)
  @IsInt({ each: true }) // Validates each element is an integer
  @IsPositive({ each: true }) // Validates each element is positive
  @ArrayUnique()
  @Type(() => Number)
  memberIds: number[];
}
