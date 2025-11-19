import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { User, UserFollow } from 'generated/prisma';
import { AuthInput } from 'src/shared/types/auth';

@Injectable()
export class UserService {
  constructor(private readonly prismaService: PrismaService) {}

  async findOrCreate(input: AuthInput): Promise<User> {
    const email = input.emails[0].value;

    let user: User | null = await this.findByGoogleIdOrEmail(input.id, email);

    if (!user) {
      user = await this.create({
        googleId: input.id,
        username: `user${input.id}`,
        email: email,
      });
    }

    return user;
  }

  async create(createUserDto: CreateUserDto) {
    return await this.prismaService.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: createUserDto,
      });

      const userSetting = await tx.userSetting.create({
        data: { userId: user.id },
      });

      return user;
    });
  }

  findAll() {
    return this.prismaService.user.findMany();
  }

  findById(id: number): Promise<User | null> {
    return this.prismaService.user.findUnique({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prismaService.user.findUnique({ where: { email } });
  }

  findByGoogleIdOrEmail(googleId: string, email: string): Promise<User | null> {
    return this.prismaService.user.findFirst({
      where: { OR: [{ googleId }, { email }] },
    });
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    return `This action updates a #${id} user`;
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }

  async follow(userId: number, recipientUserId: number) {
    const existingFollow: UserFollow | null =
      await this.prismaService.userFollow.findFirst({
        where: {
          followerUserId: userId,
          followingUserId: recipientUserId,
        },
      });

    if (existingFollow) {
      // Unfollow
      await this.prismaService.userFollow.delete({
        where: {
          id: existingFollow.id,
        },
      });
    } else {
      // Follow
      await this.prismaService.userFollow.create({
        data: {
          followerUserId: userId,
          followingUserId: recipientUserId,
        },
      });
    }

    return {
      message: `User #${recipientUserId} ${existingFollow ? 'Unfollowed' : 'Followed'}`,
    };
  }
}
