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

@Injectable()
export class ConversationService {
  constructor(private readonly prismaService: PrismaService) {}

  async create(
    createConversationDto: CreateConversationDto,
    userId: number,
  ): Promise<Conversation> {
    const { memberIds } = createConversationDto;

    // If user is not part of members
    if (!memberIds.includes(userId)) {
      throw new UnauthorizedException(
        "User not allowed to create conversation on other user's behalf",
      );
    }

    try {
      return await this.prismaService.$transaction(async (tx) => {
        // Create conversation
        const conversation = await tx.conversation.create({
          data: {},
        });

        // Create conversation members
        const members = await tx.conversationMember.createMany({
          data: memberIds.map((memberId) => ({
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

  findAll() {
    return `This action returns all conversation`;
  }

  findOne(id: number) {
    return `This action returns a #${id} conversation`;
  }

  update(id: number, updateConversationDto: UpdateConversationDto) {
    return `This action updates a #${id} conversation`;
  }

  remove(id: number) {
    return `This action removes a #${id} conversation`;
  }
}
