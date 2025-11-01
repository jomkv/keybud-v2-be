import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Conversation } from 'generated/prisma';
import { PrismaClientKnownRequestError } from 'generated/prisma/runtime/library';
import { MessageService } from '../message/message.service';

@Injectable()
export class ConversationService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly messageService: MessageService,
  ) {}

  async create(
    createConversationDto: CreateConversationDto,
    userId: number,
  ): Promise<Conversation> {
    try {
      return await this.prismaService.$transaction(async (tx) => {
        // Create conversation
        const conversation = await tx.conversation.create({
          data: {},
        });

        // Create conversation members
        await tx.conversationMember.createMany({
          data: createConversationDto.memberIds.map((memberId) => ({
            conversationId: conversation.id,
            userId: memberId,
          })),
        });

        // Return newly created conversation
        return conversation;
      });
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2003' // Foreign key error
      ) {
        throw new BadRequestException('Invalid memberId found');
      }

      throw error;
    }
  }

  async findAll(userId: number) {
    const conversations = await this.prismaService.conversation.findMany({
      where: { members: { some: { userId } } },
      include: {
        members: {
          include: {
            user: {
              select: {
                username: true,
              },
            },
          },
        },
        messages: {
          take: 1, // get latest
          orderBy: {
            createdAt: 'desc', // latest first
          },
        },
      },
    });

    const decryptedConversations = conversations.map((convo) => {
      if (convo.messages.length > 0 && convo.messages[0]?.content) {
        convo.messages[0].content = this.messageService.decryptContent(
          convo.messages[0].content,
        );
      }

      return convo;
    });

    return decryptedConversations;
  }

  findOne(id: number) {
    return `This action returns a #${id} conversation`;
  }
}
