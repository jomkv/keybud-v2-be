import { Controller, Get, Query, ValidationPipe } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dtos/search-query.dto';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  async search(
    @Query(
      new ValidationPipe({
        transform: true,
        transformOptions: { enableImplicitConversion: true },
        forbidNonWhitelisted: true,
      }),
    )
    query: SearchQueryDto,
  ) {
    const users = await this.searchService.searchUsers(query.searchQuery);
    const statuses = await this.searchService.searchStatuses(query.searchQuery);

    return {
      users,
      statuses,
    };
  }

  @Get('user')
  searchUsers(
    @Query(
      new ValidationPipe({
        transform: true,
        transformOptions: { enableImplicitConversion: true },
        forbidNonWhitelisted: true,
      }),
    )
    query: SearchQueryDto,
  ) {
    return this.searchService.searchUsers(query.searchQuery);
  }

  @Get('status')
  searchStatuses(
    @Query(
      new ValidationPipe({
        transform: true,
        transformOptions: { enableImplicitConversion: true },
        forbidNonWhitelisted: true,
      }),
    )
    query: SearchQueryDto,
  ) {
    return this.searchService.searchStatuses(query.searchQuery);
  }
}
