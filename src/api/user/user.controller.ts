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
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { RequestService } from 'src/request/request.service';

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
