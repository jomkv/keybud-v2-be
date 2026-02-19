import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma, User, UserFollow } from '@prisma/client';
import { AuthInput } from 'src/shared/types/auth';
import { PopulatedStatus, StatusService } from '../status/status.service';

@Injectable()
export class UserService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly statusService: StatusService,
  ) {}

  private getUserQueryInclude(): Prisma.UserInclude {
    return {
      _count: {
        select: {
          followers: true,
          followings: true,
        },
      },
    };
  }

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
    return this.prismaService.user.findUnique({
      where: { id },
      include: this.getUserQueryInclude(),
    });
  }

  findByUsername(username: string): Promise<User | null> {
    return this.prismaService.user.findUnique({
      where: { username },
    });
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

  async follow(followerId: number, followingId: number) {
    const existingFollow: UserFollow | null =
      await this.prismaService.userFollow.findFirst({
        where: {
          followerUserId: followerId,
          followingUserId: followingId,
        },
      });

    if (existingFollow) {
      throw new BadRequestException('Invalid action');
    }

    await this.prismaService.userFollow.create({
      data: {
        followerUserId: followerId,
        followingUserId: followingId,
      },
    });

    return {
      message: `User #${followingId} Followed`,
    };
  }

  async unfollow(followerId: number, followingId: number) {
    const existingFollow = await this.prismaService.userFollow.findFirst({
      where: {
        followerUserId: followerId,
        followingUserId: followingId,
      },
    });

    if (!existingFollow) {
      throw new BadRequestException('Invalid action');
    }

    await this.prismaService.userFollow.delete({
      where: {
        id: existingFollow.id,
      },
    });

    return {
      message: `User #${followingId} Unfollowed'`,
    };
  }

  getUserStats(userId: number) {
    return this.prismaService.user.findUnique({
      where: {
        id: userId,
      },
      include: this.getUserQueryInclude(),
    });
  }

  async getUserProfile(currUserId: number, profileUserId: number) {
    const profileAllStatuses: PopulatedStatus[] =
      await this.statusService.getAndEnrichMultipleStatus(
        {
          where: {
            userId: profileUserId,
          },
          orderBy: {
            createdAt: 'desc', // Latest first
          },
        },
        currUserId,
      );

    const profileStars = await this.prismaService.statusStar.findMany({
      where: {
        userId: profileUserId,
      },
    });
    const profileStarIds: number[] = profileStars.map((star) => star.statusId);

    // Get all statuses from profileStarIds
    const starStatuses: PopulatedStatus[] =
      await this.statusService.getAndEnrichMultipleStatus(
        {
          where: {
            id: { in: profileStarIds },
          },
          orderBy: {
            createdAt: 'desc', // Latest first
          },
        },
        currUserId,
      );

    // Filter only to statuses with no parentId
    const statuses = profileAllStatuses.filter(
      (status) => status.parentId == null,
    );

    // Filter only to statuses with a parentId
    const commentStatuses = profileAllStatuses.filter(
      (status) => status.parentId !== null,
    );

    // Filter only to statuses with attachments
    const mediaStatuses = profileAllStatuses.filter(
      (status) => status.attachments.length > 0,
    );

    return {
      posts: statuses,
      comments: commentStatuses,
      media: mediaStatuses,
      stars: starStatuses,
    };
  }

  getUserPosts(currUserId: number, ownerId: number) {
    return this.statusService.getAndEnrichMultipleStatus(
      {
        where: { userId: ownerId, parentId: null },
        orderBy: {
          createdAt: 'desc',
        },
      },
      currUserId,
    );
  }

  getUserComments(currUserId: number, ownerId: number) {
    return this.statusService.getAndEnrichMultipleStatus(
      {
        where: { userId: ownerId, parentId: { not: null } },
        orderBy: {
          createdAt: 'desc',
        },
      },
      currUserId,
    );
  }

  async getUserMedia(currUserId: number, ownerId: number) {
    const allUserStatuses: PopulatedStatus[] =
      await this.statusService.getAndEnrichMultipleStatus(
        {
          where: { userId: ownerId },
          orderBy: {
            createdAt: 'desc',
          },
        },
        currUserId,
      );

    return allUserStatuses.filter((status) => status.attachments.length > 0);
  }

  async getUserStars(currUserId: number, ownerId: number) {
    const userStars = await this.prismaService.statusStar.findMany({
      where: {
        userId: ownerId,
      },
    });
    const starIds: number[] = userStars.map((star) => star.statusId);

    return await this.statusService.getAndEnrichMultipleStatus(
      {
        where: {
          id: { in: starIds },
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
      currUserId,
    );
  }
}
