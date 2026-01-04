import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { Repository, IsNull, MoreThan } from 'typeorm';
import { I18nService } from 'nestjs-i18n';
import { UserEntity } from '@app/entities';
import { CredentialsDto } from './dto/credentials.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { UserStatusEnum } from '@Constant/enums';
import { UserPayloadDto } from './dto/user-payload.dto';
import { ResponseItem } from '@app/common/dtos';
import { TokenDto } from './dto/token.dto';
import { JwtTokenService } from './services/jwt.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtTokenService: JwtTokenService,
    private readonly emailService: EmailService,
    private readonly i18n: I18nService,
    private readonly configService: ConfigService,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>
  ) {}

  async validateUser(credentialsDto: CredentialsDto, lang = 'vi'): Promise<UserPayloadDto> {
    const user = await this.userRepository.findOne({
      where: {
        email: credentialsDto.email,
        deletedAt: IsNull(),
      },
    });

    if (!user) {
      throw new UnauthorizedException(await this.i18n.translate('auth.login.invalid_credentials', { lang }));
    }

    // Check if account is blocked
    if (user.status === UserStatusEnum.BLOCKED) {
      throw new UnauthorizedException(await this.i18n.translate('auth.login.account_blocked', { lang }));
    }

    // Check if account is inactive
    if (user.status === UserStatusEnum.INACTIVE) {
      throw new UnauthorizedException(await this.i18n.translate('auth.login.account_inactive', { lang }));
    }

    // Check email verification
    if (!user.emailVerified) {
      throw new UnauthorizedException(await this.i18n.translate('auth.login.email_not_verified', { lang }));
    }

    const comparePassword = await bcrypt.compareSync(credentialsDto.password, user.password);
    if (!comparePassword) {
      throw new UnauthorizedException(await this.i18n.translate('auth.login.invalid_credentials', { lang }));
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
    };
  }

  async login(userPayloadDto: UserPayloadDto, lang = 'vi'): Promise<ResponseItem<TokenDto>> {
    // Find the full user document
    const user = await this.userRepository.findOne({
      where: { id: userPayloadDto.id },
    });
    if (!user) {
      throw new UnauthorizedException(await this.i18n.translate('auth.token.user_not_found', { lang }));
    }

    // Generate tokens using JWT service
    const tokenData = await this.jwtTokenService.generateTokenResponse(user);

    return new ResponseItem(tokenData, await this.i18n.translate('auth.login.success', { lang }));
  }

  async logout(userId: string, lang = 'vi'): Promise<ResponseItem<string>> {
    try {
      await this.jwtTokenService.revokeAllTokens(userId);
      return new ResponseItem('', await this.i18n.translate('auth.logout.success', { lang }));
    } catch (error) {
      throw new BadRequestException(await this.i18n.translate('auth.logout.failed', { lang }));
    }
  }

  async refreshToken(token: string, lang = 'vi'): Promise<ResponseItem<{ accessToken: string }>> {
    const result = await this.jwtTokenService.refreshAccessToken(token);

    if (!result) {
      throw new UnauthorizedException(await this.i18n.translate('auth.token.invalid_refresh', { lang }));
    }

    return new ResponseItem(result, await this.i18n.translate('auth.token.refresh_success', { lang }));
  }

  async register(registerDto: RegisterDto): Promise<ResponseItem<{ message: string; email: string }>> {
    // Check if email already exists
    const existingUser = await this.userRepository.findOne({
      where: {
        email: registerDto.email,
        deletedAt: IsNull(),
      },
    });

    if (existingUser) {
      throw new BadRequestException('Email đã được sử dụng');
    }

    // Check if phone already exists
    const existingPhone = await this.userRepository.findOne({
      where: {
        phone: registerDto.phone,
        deletedAt: IsNull(),
      },
    });

    if (existingPhone) {
      throw new BadRequestException('Số điện thoại đã được sử dụng');
    }

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user
    const user = this.userRepository.create({
      ...registerDto,
      emailVerificationToken: verificationToken,
      emailVerificationExpires: verificationExpires,
      emailVerified: false,
      provider: 'local',
      status: UserStatusEnum.PENDING_VERIFICATION, // Will be activated after email verification
    });

    await this.userRepository.save(user);

    // Send verification email
    const emailSent = await this.emailService.sendVerificationEmail(user.email, user.name, verificationToken);

    if (!emailSent) {
      // If email fails, still create user but log error
      console.error('Failed to send verification email to:', user.email);
    }

    return new ResponseItem(
      {
        message: 'Đăng ký thành công. Vui lòng kiểm tra email để xác thực tài khoản.',
        email: user.email,
      },
      'Đăng ký thành công'
    );
  }

  async verifyEmail(verifyEmailDto: VerifyEmailDto): Promise<ResponseItem<{ message: string }>> {
    const user = await this.userRepository.findOne({
      where: {
        emailVerificationToken: verifyEmailDto.token,
        emailVerificationExpires: MoreThan(new Date()),
        deletedAt: IsNull(),
      },
    });

    if (!user) {
      throw new BadRequestException('Token xác thực không hợp lệ hoặc đã hết hạn');
    }

    if (user.emailVerified) {
      throw new BadRequestException('Email đã được xác thực trước đó');
    }

    // Update user verification status
    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    user.status = UserStatusEnum.ACTIVE;
    await this.userRepository.save(user);

    // Send welcome email
    await this.emailService.sendWelcomeEmail(user.email, user.name);

    return new ResponseItem(
      { message: 'Xác thực email thành công. Bạn có thể đăng nhập ngay bây giờ.' },
      'Xác thực thành công'
    );
  }

  async resendVerification(resendDto: ResendVerificationDto): Promise<ResponseItem<{ message: string }>> {
    const user = await this.userRepository.findOne({
      where: {
        email: resendDto.email,
        deletedAt: IsNull(),
      },
    });

    if (!user) {
      throw new BadRequestException('Không tìm thấy tài khoản với email này');
    }

    if (user.emailVerified) {
      throw new BadRequestException('Email đã được xác thực');
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = verificationExpires;
    await this.userRepository.save(user);

    // Send verification email
    const emailSent = await this.emailService.sendVerificationEmail(user.email, user.name, verificationToken);

    if (!emailSent) {
      throw new BadRequestException('Không thể gửi email xác thực. Vui lòng thử lại sau.');
    }

    return new ResponseItem(
      { message: 'Email xác thực đã được gửi lại. Vui lòng kiểm tra hộp thư.' },
      'Gửi email thành công'
    );
  }
}
