import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  BadRequestException,
  ValidationPipe,
  NotFoundException,
  Query,
  ParseEnumPipe,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { RequestService } from 'src/request/request.service';
import { UserProfileTab } from './enums/user-profile-tab.enum';

@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly requestService: RequestService,
  ) {}

  @Post()
  create(@Body(ValidationPipe) createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @Get()
  findAll() {
    return this.userService.findAll();
  }

  @Get('me')
  getMe() {
    const user = this.requestService.getUser();

    return user;
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userService.findById(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(ValidationPipe) updateUserDto: UpdateUserDto,
  ) {
    return this.userService.update(+id, updateUserDto);
  }

  @Get('profile/:username')
  async getProfile(
    @Param('username') username: string,
    @Query('tab', new ParseEnumPipe(UserProfileTab)) tab: UserProfileTab,
  ) {
    const currUser = this.requestService.getUser();
    const user = await this.userService.findByUsername(username);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    let res = null;

    switch (tab) {
      case UserProfileTab.POSTS:
        res = await this.userService.getUserPosts(currUser.id, user.id);
        break;
      case UserProfileTab.COMMENTS:
        res = await this.userService.getUserComments(currUser.id, user.id);
        break;
      case UserProfileTab.MEDIA:
        res = await this.userService.getUserMedia(currUser.id, user.id);
        break;
      case UserProfileTab.STARS:
        res = await this.userService.getUserStars(currUser.id, user.id);
        break;
      default:
        res = await this.userService.getUserProfile(currUser.id, user.id);
        break;
    }

    return res;
  }

  @Post('follow/:id')
  follow(@Param('id', ParseIntPipe) id: number) {
    const user = this.requestService.getUser();

    if (user.id === id) {
      throw new BadRequestException('Invalid action');
    }

    return this.userService.follow(user.id, id);
  }

  @Delete('unfollow/:id')
  unfollow(@Param('id', ParseIntPipe) id: number) {
    const user = this.requestService.getUser();

    if (user.id === id) {
      throw new BadRequestException('Invalid action');
    }

    return this.userService.unfollow(user.id, id);
  }
}
