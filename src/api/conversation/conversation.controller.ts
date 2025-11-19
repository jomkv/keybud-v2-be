import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ValidationPipe,
  UnauthorizedException,
  NotFoundException,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { RequestService } from 'src/request/request.service';
import { MessageService } from '../message/message.service';

@Controller('conversation')
export class ConversationController {
  constructor(
    private readonly conversationService: ConversationService,
    private readonly requestService: RequestService,
    private readonly messageService: MessageService,
  ) {}

  @Post()
  create(@Body(ValidationPipe) createConversationDto: CreateConversationDto) {
    const user = this.requestService.getUser();

    // If user is not part of members
    if (!createConversationDto.memberIds.includes(user.id)) {
      throw new UnauthorizedException(
        "User not allowed to create conversation on other user's behalf",
      );
    }

    return this.conversationService.create(createConversationDto, user.id);
  }

  @Get()
  findAll() {
    const user = this.requestService.getUser();

    return this.conversationService.findAll(user.id);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Query('reset') reset?: string,
  ) {
    const user = this.requestService.getUser();

    const conversation = await this.conversationService.findOne(id, user.id);

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const messages = await this.messageService.findMessagesFromConversation(
      id,
      user.id,
      reset === 'true',
    );

    return { conversation, messages };
  }
}
