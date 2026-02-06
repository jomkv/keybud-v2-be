import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class SearchService {
  constructor(private readonly prismaService: PrismaService) {}

  searchSuggestedUsers(limit: number) {
    return this.prismaService.$queryRaw`
    SELECT * FROM "User"
    ORDER BY RANDOM()
    LIMIT ${limit}
  `;
  }

  searchUsers(searchQuery: string) {
    return this.prismaService.user.findMany({
      where: {
        username: {
          contains: searchQuery,
          mode: 'insensitive',
        },
      },
    });
  }

  searchStatuses(searchQuery: string) {
    return this.prismaService.status.findMany({
      where: {
        AND: [
          {
            OR: [
              {
                title: {
                  contains: searchQuery,
                  mode: 'insensitive',
                },
              },
              {
                description: {
                  contains: searchQuery,
                  mode: 'insensitive',
                },
              },
            ],
          },
          {
            parentId: null,
          },
        ],
      },
    });
  }
}
