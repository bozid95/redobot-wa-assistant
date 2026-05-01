import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { AuthGuard } from '../common/auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private get cookieSecure() {
    const value = process.env.COOKIE_SECURE;
    if (value == null || value === '') {
      return process.env.NODE_ENV === 'production';
    }

    return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
  }

  private get cookieSameSite(): 'lax' | 'strict' | 'none' {
    const value = String(process.env.COOKIE_SAME_SITE || 'lax').toLowerCase();
    if (value === 'strict' || value === 'none') return value;
    return 'lax';
  }

  @Post('login')
  async login(
    @Body() body: { email?: string; password?: string },
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(String(body.email || ''), String(body.password || ''));
    response.cookie('wa_rag_session', result.token, {
      httpOnly: true,
      sameSite: this.cookieSameSite,
      secure: this.cookieSecure,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return result.user;
  }

  @Post('logout')
  async logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie('wa_rag_session');
    return { ok: true };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@Req() request: { user: unknown }) {
    return request.user;
  }
}
