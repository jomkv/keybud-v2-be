import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ValidationPipe,
  UnauthorizedException,
} from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { RequestService } from 'src/request/request.service';

@Controller('conversation')
export class ConversationController {
  constructor(
    private readonly conversationService: ConversationService,
    private readonly requestService: RequestService,
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
  findOne(@Param('id') id: string) {
    return this.conversationService.findOne(+id);
  }
}
