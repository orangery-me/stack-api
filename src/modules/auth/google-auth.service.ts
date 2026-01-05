import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { GoogleCodeDto } from './dto/google-code.dto';
import { ResponseItem } from '@app/common/dtos/response-item.dto';
import { TokenDto } from './dto/token.dto';
import { UserEntity } from '@app/entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { JwtTokenService } from './services/jwt.service';
import { EmailService } from '../email/email.service';
import { UserStatusEnum } from '@Constant/enums';

@Injectable()
export class GoogleAuthService {
  private oauthClient: OAuth2Client;

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtTokenService: JwtTokenService,
    private readonly emailService: EmailService,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>
  ) {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
    const redirectUri = this.configService.get<string>('GOOGLE_CALLBACK_URL');

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Google OAuth env missing');
    }

    this.oauthClient = new OAuth2Client(clientId, clientSecret, redirectUri);
  }

  async verifyGoogleCode(dto: GoogleCodeDto) {
    // exchange code for access token
    const { tokens } = await this.oauthClient.getToken(dto.code);

    if (!tokens.id_token) {
      throw new UnauthorizedException('No id_token returned from Google');
    }

    // verify id token
    const ticket = await this.oauthClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: this.configService.get<string>('GOOGLE_CLIENT_ID'),
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      throw new UnauthorizedException('Cannot retrieve Google user info');
    }

    const googleUser = {
      googleId: payload.sub,
      email: payload.email,
      name: payload.name,
      avatar: payload.picture || null,
    };

    return this.googleLogin(googleUser);
  }

  async googleLogin(googleUser: any): Promise<ResponseItem<TokenDto>> {
    let user = await this.userRepository.findOne({
      where: [
        { googleId: googleUser.googleId, deletedAt: IsNull() },
        { email: googleUser.email, deletedAt: IsNull() },
      ],
    });

    if (user) {
      // User exists, update Google ID if needed
      if (!user.googleId && user.email === googleUser.email) {
        user.googleId = googleUser.googleId;
        user.provider = 'google';
        user.emailVerified = true; // Google emails are verified
        user.status = UserStatusEnum.ACTIVE;
        if (googleUser.avatar && !user.avatar) {
          user.avatar = googleUser.avatar;
        }
        await this.userRepository.save(user);
      }
    } else {
      // Create new user
      user = this.userRepository.create({
        googleId: googleUser.googleId,
        email: googleUser.email,
        name: googleUser.name,
        avatar: googleUser.avatar,
        provider: 'google',
        emailVerified: true,
        status: UserStatusEnum.ACTIVE,
        // Generate dummy values for required fields
        phone: '',
      });
      await this.userRepository.save(user);

      // Send welcome email
      await this.emailService.sendWelcomeEmail(user.email, user.name);
    }

    // Generate tokens
    const tokenData = await this.jwtTokenService.generateTokenResponse(user);

    return new ResponseItem(tokenData, 'Đăng nhập Google thành công');
  }
}
