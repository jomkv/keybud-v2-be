import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { RequestService } from 'src/request/request.service';
import { AuthService } from './auth.service';
import { SessionAuthGuard } from './guards/session-auth.guard';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { Profile } from 'passport-google-oauth20';
import EnvironmentVariables from 'src/shared/env-variables';
import { Public } from 'src/shared/decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly requestService: RequestService,
    private readonly authService: AuthService,
  ) {}

  @Public()
  @Post('dev-login')
  async devLogin(
    @Body('email') email: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!email) {
      throw new BadRequestException(
        'Please provide email within the request body',
      );
    }

    const { accessToken } = await this.authService.devAuthenticate(email);

    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: EnvironmentVariables.isProd,
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    });

    return {
      message: 'Dev login success',
    };
  }

  @Public()
  @Get('google')
  @UseGuards(SessionAuthGuard)
  async googleAuth() {}

  @Get('google/redirect')
  @Public()
  @UseGuards(AuthGuard('google'))
  async googleRedirect(
    @Req() req: Request,
    @Res() res: Response,
    @Query('state') nonce: string,
  ) {
    const userPayload = req.user as Profile | undefined | null;

    if (!userPayload) {
      throw new HttpException(
        'Something went wrong, please try again later.',
        500,
      );
    }

    const { accessToken } = await this.authService.authenticate(userPayload);

    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: EnvironmentVariables.isProd,
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    });

    await this.authService.emitSuccess(nonce);

    return res.redirect(EnvironmentVariables.clientUrl + '/login-success');
  }
}
