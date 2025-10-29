import { IsNotEmpty, IsNumberString, IsString } from 'class-validator';

export class CreateMessageDto {
  @IsNotEmpty()
  @IsNumberString()
  conversationId: string;

  @IsNotEmpty()
  @IsString()
  content: string;
}
