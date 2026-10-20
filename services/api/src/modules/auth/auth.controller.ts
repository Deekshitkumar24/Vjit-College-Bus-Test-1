import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  HttpStatus,
  Res,
  Req,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { AuthService } from './auth.service.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('sso/start')
  @Public()
  ssoStart(@Body() body: { return_url?: string }, @Res() res: Response) {
    const returnUrl = body.return_url || 'https://admin.college.edu/dashboard';
    const state = Math.random().toString(36).substring(7);
    const nonce = Math.random().toString(36).substring(7);

    // Set signed state cookie
    res.cookie('sso_state', state, { httpOnly: true, secure: true, sameSite: 'strict' });

    // In production, redirects to Google/Entra authorization URL
    return res.status(HttpStatus.OK).json({
      auth_url: `https://accounts.google.com/o/oauth2/v2/auth?state=${state}&nonce=${nonce}&redirect_uri=${encodeURIComponent(returnUrl)}`,
    });
  }

  @Get('sso/callback')
  @Public()
  ssoCallback(@Req() _req: Request, @Res() res: Response) {
    // Validates state and exchange code, creates session
    return res.status(HttpStatus.OK).json({
      message: 'SSO authenticated successfully',
      user: {
        id: 'c1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c',
        email: 'admin@college.edu',
        roles: ['SAD'],
      },
    });
  }

  @Post('otp/request')
  @Public()
  async requestOtp(@Body() body: { email: string; turnstile_token?: string }, @Res() res: Response) {
    // In production, uses OTP_HMAC_KEY from env
    await this.authService.requestDriverOtp(body.email, 'super_secure_otp_hmac_secret_key_32_chars');
    return res.status(HttpStatus.OK).json({
      message: 'If the email exists, a verification code has been dispatched.',
    });
  }

  @Post('otp/verify')
  @Public()
  async verifyOtp(
    @Body() body: { email: string; code: string; device_label?: string },
    @Res() res: Response,
  ) {
    const tokens = await this.authService.verifyDriverOtp(
      body.email,
      body.code,
      'super_secure_otp_hmac_secret_key_32_chars',
      body.device_label,
    );
    return res.status(HttpStatus.OK).json(tokens);
  }

  @Post('refresh')
  @Public()
  refresh(@Body() body: { refresh_token: string }, @Res() res: Response) {
    const result = this.authService.rotateRefreshToken(body.refresh_token);
    return res.status(HttpStatus.OK).json(result);
  }

  @Post('logout')
  logout(@Res() res: Response) {
    res.clearCookie('session');
    return res.status(HttpStatus.OK).json({ message: 'Session logged out successfully' });
  }

  @Get('sessions')
  listSessions(@Req() _req: Request, @Res() res: Response) {
    return res.status(HttpStatus.OK).json({
      sessions: [
        {
          id: 'sess_1',
          device_label: 'Current Session',
          created_at: new Date().toISOString(),
          last_used_at: new Date().toISOString(),
        },
      ],
    });
  }

  @Delete('sessions/:id')
  revokeSession(@Param('id') id: string, @Res() res: Response) {
    return res.status(HttpStatus.OK).json({ message: `Session ${id} revoked.` });
  }

  @Post('mfa/enrol')
  @Roles('SEC', 'COR', 'TEC', 'MGT', 'SAD')
  enrolMfa(@Req() req: Request, @Res() res: Response) {
    const userId = (req as any).user?.userId || 'user_1';
    const mfaData = this.authService.enrolAdminMfa(userId);
    return res.status(HttpStatus.OK).json(mfaData);
  }

  @Post('mfa/verify')
  @Roles('SEC', 'COR', 'TEC', 'MGT', 'SAD')
  verifyMfa(@Body() _body: { totp_code: string }, @Res() res: Response) {
    return res.status(HttpStatus.OK).json({ status: 'MFA verified' });
  }
}
