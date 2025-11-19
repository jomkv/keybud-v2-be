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
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @Get()
  findAll() {
    return this.userService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userService.findById(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.update(+id, updateUserDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.userService.remove(+id);
  }

  @Post('follow/:id')
  follow(@Param('id', ParseIntPipe) id: number) {
    const user = this.requestService.getUser();

    if (user.id === id) {
      throw new BadRequestException('You cannot follow/unfollow yourself');
    }

    return this.userService.follow(user.id, id);
  }
}
