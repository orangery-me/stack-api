import { ResponseItem } from '@app/common/dtos';
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { I18nLang } from 'nestjs-i18n';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiHeader, ApiBody } from '@nestjs/swagger';

import { AuthService } from './auth.service';
import { CredentialsDto } from './dto/credentials.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { GoogleCodeDto } from './dto/google-code.dto';
import { TokenDto } from './dto/token.dto';
import { JwtAccessTokenGuard } from './guards/jwt-access-token.guard';
import { JwtRefreshTokenGuard } from './guards/jwt-refresh-token.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { GoogleAuthService } from './google-auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService, private readonly googleAuthService: GoogleAuthService) {}

  @UseGuards(LocalAuthGuard)
  @HttpCode(200)
  @Post('login')
  @ApiOperation({ summary: 'Đăng nhập' })
  @ApiBody({ type: CredentialsDto })
  @ApiResponse({
    status: 200,
    description: 'Đăng nhập thành công',
    type: TokenDto,
  })
  @ApiResponse({ status: 401, description: 'Thông tin đăng nhập không chính xác' })
  async login(
    @Req() request,
    @Body() _credentials: CredentialsDto,
    @I18nLang() lang: string
  ): Promise<ResponseItem<TokenDto>> {
    return this.authService.login(request.user, lang);
  }

  @UseGuards(JwtAccessTokenGuard)
  @Get('logout')
  @ApiOperation({ summary: 'Đăng xuất' })
  @ApiBearerAuth('JWT-auth')
  @ApiResponse({ status: 200, description: 'Đăng xuất thành công' })
  @ApiResponse({ status: 401, description: 'Token không hợp lệ' })
  async logout(@Req() request, @I18nLang() lang: string) {
    return this.authService.logout(request.user.userId, lang);
  }

  @UseGuards(JwtRefreshTokenGuard)
  @HttpCode(200)
  @Get('refresh')
  @ApiOperation({ summary: 'Làm mới token' })
  @ApiHeader({
    name: 'Authorization',
    description: 'Bearer refresh_token',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Làm mới token thành công',
    type: TokenDto,
  })
  @ApiResponse({ status: 401, description: 'Refresh token không hợp lệ' })
  refresh(@Headers('Authorization') auth: string, @I18nLang() lang: string) {
    const token = auth.replace('Bearer ', '');
    return this.authService.refreshToken(token, lang);
  }

  @Post('register')
  @ApiOperation({ summary: 'Đăng ký tài khoản mới' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: 201,
    description: 'Đăng ký thành công. Email xác thực đã được gửi.',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        email: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Email hoặc thông tin đã được sử dụng' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('verify-email')
  @ApiOperation({ summary: 'Xác thực email' })
  @ApiBody({ type: VerifyEmailDto })
  @ApiResponse({
    status: 200,
    description: 'Xác thực email thành công',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Token không hợp lệ hoặc đã hết hạn' })
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    return this.authService.verifyEmail(verifyEmailDto);
  }

  @Get('verify-email')
  @ApiOperation({ summary: 'Xác thực email qua URL (GET)' })
  @ApiResponse({ status: 200, description: 'Xác thực email thành công' })
  @ApiResponse({ status: 400, description: 'Token không hợp lệ hoặc đã hết hạn' })
  async verifyEmailByUrl(@Query('token') token: string) {
    return this.authService.verifyEmail({ token });
  }

  @Post('resend-verification')
  @ApiOperation({ summary: 'Gửi lại email xác thực' })
  @ApiBody({ type: ResendVerificationDto })
  @ApiResponse({
    status: 200,
    description: 'Email xác thực đã được gửi lại',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Email không tồn tại hoặc đã được xác thực' })
  async resendVerification(@Body() resendDto: ResendVerificationDto) {
    return this.authService.resendVerification(resendDto);
  }

  @Post('google/login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Đăng nhập bằng Google (Authorization Code)' })
  @ApiBody({ type: GoogleCodeDto })
  @ApiResponse({ status: 200, type: TokenDto })
  async verifyGoogleCode(@Body() googleCodeDto: GoogleCodeDto, @Req() req) {
    const expectedState = req.cookies?.google_oauth_state || req.signedCookies?.google_oauth_state;
    if (!expectedState) {
      throw new UnauthorizedException('OAuth state cookie not found. Please try logging in again.');
    }
    return this.googleAuthService.verifyGoogleCode(googleCodeDto, expectedState);
  }
}
