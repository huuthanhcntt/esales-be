import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { User } from '../generated/prisma/client';
import { CurrentUser } from '@app/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  async createUser(@Body() createUserDto: CreateUserDto) {
    const user = await this.usersService.create(createUserDto);
    const { password: _, ...userWithoutPassword } = user as any;
    return userWithoutPassword;
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getUser(@CurrentUser() user: User) {
    const { password: _, ...userWithoutPassword } = user as any;
    return userWithoutPassword;
  }
}
