import { ResponseItem } from '@app/common/dtos';
import { Body, Controller, Get, Headers, HttpCode, Post, Query, Req, UseGuards } from '@nestjs/common';
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
  @ApiOperation({ summary: 'Login' })
  @ApiBody({ type: CredentialsDto })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: TokenDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid login credentials' })
  async login(
    @Req() request,
    @Body() _credentials: CredentialsDto
  ): Promise<ResponseItem<TokenDto>> {
    return this.authService.login(request.user);
  }

  @UseGuards(JwtAccessTokenGuard)
  @Get('logout')
  @ApiOperation({ summary: 'Logout' })
  @ApiBearerAuth('JWT-auth')
  @ApiResponse({ status: 200, description: 'Logout successful' })
  @ApiResponse({ status: 401, description: 'Invalid token' })
  async logout(@Req() request) {
    return this.authService.logout(request.user.userId);
  }

  @UseGuards(JwtRefreshTokenGuard)
  @HttpCode(200)
  @Get('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiHeader({
    name: 'Authorization',
    description: 'Bearer refresh_token',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Access token refreshed successfully',
    type: TokenDto,
  })
  @ApiResponse({ status: 401, description: 'Refresh token is invalid' })
  refresh(@Headers('Authorization') auth: string) {
    const token = auth.replace('Bearer ', '');
    return this.authService.refreshToken(token);
  }

  @Post('register')
  @ApiOperation({ summary: 'Register a new account' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: 201,
    description: 'Registration successful. Verification email has been sent.',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        email: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Email or phone number already in use' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('verify-email')
  @ApiOperation({ summary: 'Verify email' })
  @ApiBody({ type: VerifyEmailDto })
  @ApiResponse({
    status: 200,
    description: 'Email verified successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Token is invalid or has expired' })
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    return this.authService.verifyEmail(verifyEmailDto);
  }

  @Get('verify-email')
  @ApiOperation({ summary: 'Verify email via URL (GET)' })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  @ApiResponse({ status: 400, description: 'Token is invalid or has expired' })
  async verifyEmailByUrl(@Query('token') token: string) {
    return this.authService.verifyEmail({ token });
  }

  @Post('resend-verification')
  @ApiOperation({ summary: 'Resend verification email' })
  @ApiBody({ type: ResendVerificationDto })
  @ApiResponse({
    status: 200,
    description: 'Verification email resent successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Email does not exist or has already been verified' })
  async resendVerification(@Body() resendDto: ResendVerificationDto) {
    return this.authService.resendVerification(resendDto);
  }

  @Post('google/login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Login with Google (Authorization Code)' })
  @ApiBody({ type: GoogleCodeDto })
  @ApiResponse({ status: 200, type: TokenDto })
  async verifyGoogleCode(@Body() googleCodeDto: GoogleCodeDto) {
    return this.googleAuthService.verifyGoogleCode(googleCodeDto);
  }
}
