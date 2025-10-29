import { Body, Controller, Post, ValidationPipe } from '@nestjs/common';
import { MessageService } from './message.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { RequestService } from 'src/request/request.service';

@Controller('message')
export class MessageController {
  constructor(
    private readonly messageService: MessageService,
    private readonly requestService: RequestService,
  ) {}

  @Post()
  create(@Body(ValidationPipe) createMessageDto: CreateMessageDto) {
    const user = this.requestService.getUser();

    return this.messageService.create(createMessageDto, user.id);
  }
}
