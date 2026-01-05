import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { Repository, IsNull, MoreThan } from 'typeorm';
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
    private readonly configService: ConfigService,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>
  ) {}

  async validateUser(credentialsDto: CredentialsDto): Promise<UserPayloadDto> {
    const user = await this.userRepository.findOne({
      where: {
        email: credentialsDto.email,
        deletedAt: IsNull(),
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check if account is blocked
    if (user.status === UserStatusEnum.BLOCKED) {
      throw new UnauthorizedException('Your account has been blocked. Please contact support.');
    }

    // Check if account is inactive
    if (user.status === UserStatusEnum.INACTIVE) {
      throw new UnauthorizedException('Your account is inactive. Please contact support.');
    }

    // Check email verification
    if (!user.emailVerified) {
      throw new UnauthorizedException('Please verify your email before signing in.');
    }

    const comparePassword = await bcrypt.compareSync(credentialsDto.password, user.password);
    if (!comparePassword) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
    };
  }

  async login(userPayloadDto: UserPayloadDto): Promise<ResponseItem<TokenDto>> {
    // Find the full user document
    const user = await this.userRepository.findOne({
      where: { id: userPayloadDto.id },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Generate tokens using JWT service
    const tokenData = await this.jwtTokenService.generateTokenResponse(user);

    return new ResponseItem(tokenData, 'Login successful');
  }

  async logout(userId: string): Promise<ResponseItem<string>> {
    try {
      await this.jwtTokenService.revokeAllTokens(userId);
      return new ResponseItem('', 'Logout successful');
    } catch (error) {
      throw new BadRequestException('Logout failed');
    }
  }

  async refreshToken(token: string): Promise<ResponseItem<{ accessToken: string }>> {
    const result = await this.jwtTokenService.refreshAccessToken(token);

    if (!result) {
      throw new UnauthorizedException('Refresh token is invalid');
    }

    return new ResponseItem(result, 'Access token refreshed successfully');
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
      throw new BadRequestException('Email is already in use');
    }

    // Check if phone already exists
    const existingPhone = await this.userRepository.findOne({
      where: {
        phone: registerDto.phone,
        deletedAt: IsNull(),
      },
    });

    if (existingPhone) {
      throw new BadRequestException('Phone number is already in use');
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
        message: 'Registration successful. Please check your email to verify your account.',
        email: user.email,
      },
      'Registration successful'
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
      throw new BadRequestException('Verification token is invalid or has expired');
    }

    if (user.emailVerified) {
      throw new BadRequestException('Email has already been verified');
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
      { message: 'Email verified successfully. You can sign in now.' },
      'Email verification successful'
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
      throw new BadRequestException('No account found with this email');
    }

    if (user.emailVerified) {
      throw new BadRequestException('Email has already been verified');
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
      throw new BadRequestException('Unable to send verification email. Please try again later.');
    }

    return new ResponseItem(
      { message: 'Verification email has been resent. Please check your inbox.' },
      'Verification email resent successfully'
    );
  }
}
