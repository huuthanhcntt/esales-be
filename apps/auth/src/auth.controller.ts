import { Controller, Post, Res, UseGuards } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ApiBody } from '@nestjs/swagger';
import { Response } from 'express';
import { User } from './generated/prisma/client';
import { CurrentUser } from '@app/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(LocalAuthGuard)
  @Post('login')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', example: 'test@esales.com' },
        password: { type: 'string', example: 'Test1234!@' },
      },
    },
  })
  async login(
    @CurrentUser() user: User,
    @Res({ passthrough: true }) response: Response,
  ) {
    const jwt = await this.authService.login(user, response);
    response.send(jwt);
  }

  @UseGuards(JwtAuthGuard)
  @MessagePattern('authenticate')
  async authenticate(@Payload() data: any) {
    return data.user;
  }
}
