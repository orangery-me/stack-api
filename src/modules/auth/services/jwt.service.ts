import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService as NestJwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';

import { UserEntity } from '@app/entities';
import { JwtPayload } from '@Constant/types';
import { TokenDto } from '../dto/token.dto';

export interface CanvasCollabTokenPayload {
  typ: 'canvas-collab';
  sub: string;
  canvasId: string;
  role: 'viewer' | 'editor';
  readOnly: boolean;
}

@Injectable()
export class JwtTokenService {
  constructor(
    private readonly jwtService: NestJwtService,
    private readonly configService: ConfigService,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>
  ) {}

  /**
   * Generate both access and refresh tokens
   */
  generateTokens(payload: JwtPayload): { accessToken: string; refreshToken: string } {
    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRETKEY'),
      expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES'),
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRETKEY'),
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES'),
    });

    return { accessToken, refreshToken };
  }

  /**
   * Generate only access token
   */
  generateAccessToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRETKEY'),
      expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES'),
    });
  }

  generateCanvasCollabToken(payload: CanvasCollabTokenPayload): { token: string; expiresIn: string } {
    const expiresIn = this.configService.get<string>('CANVAS_COLLAB_SESSION_TTL') || '10m';
    const token = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('CANVAS_COLLAB_SESSION_SECRET'),
      expiresIn,
    });

    return { token, expiresIn };
  }

  /**
   * Generate only refresh token
   */
  generateRefreshToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRETKEY'),
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES'),
    });
  }

  /**
   * Verify token
   */
  verifyToken(token: string, isRefreshToken = false): JwtPayload {
    const secret = isRefreshToken
      ? this.configService.get<string>('JWT_REFRESH_SECRETKEY')
      : this.configService.get<string>('JWT_ACCESS_SECRETKEY');

    return this.jwtService.verify(token, { secret });
  }

  /**
   * Save refresh token to database
   */
  async saveRefreshToken(userId: string, refreshToken: string): Promise<void> {
    await this.userRepository.update({ id: userId }, { refreshToken });
  }

  /**
   * Remove refresh token from database
   */
  async removeRefreshToken(userId: string): Promise<void> {
    await this.userRepository.update({ id: userId }, { refreshToken: null });
  }

  /**
   * Find user by refresh token
   */
  async findUserByRefreshToken(refreshToken: string): Promise<UserEntity | null> {
    return this.userRepository.findOne({
      where: {
        refreshToken,
        deletedAt: IsNull(),
      },
    });
  }

  /**
   * Validate refresh token and get user
   */
  async validateRefreshToken(refreshToken: string): Promise<UserEntity | null> {
    try {
      // Verify token signature and expiration
      const payload = this.verifyToken(refreshToken, true);

      // Find user with this refresh token
      const user = await this.findUserByRefreshToken(refreshToken);

      if (!user || user.id !== payload.sub) {
        return null;
      }

      return user;
    } catch (error) {
      return null;
    }
  }

  /**
   * Create JWT payload from user
   */
  createPayload(user: UserEntity): JwtPayload {
    return {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
  }

  /**
   * Generate complete token response
   */
  async generateTokenResponse(user: UserEntity): Promise<TokenDto> {
    const payload = this.createPayload(user);
    const { accessToken, refreshToken } = this.generateTokens(payload);

    // Save refresh token to database
    await this.saveRefreshToken(user.id, refreshToken);

    return {
      accessToken,
      refreshToken,
      name: user.name,
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string } | null> {
    const user = await this.validateRefreshToken(refreshToken);

    if (!user) {
      return null;
    }

    const payload = this.createPayload(user);
    const accessToken = this.generateAccessToken(payload);

    return { accessToken };
  }

  /**
   * Revoke all tokens for user (logout from all devices)
   */
  async revokeAllTokens(userId: string): Promise<void> {
    await this.removeRefreshToken(userId);
  }

  /**
   * Check if token is expired (without throwing error)
   */
  isTokenExpired(token: string, isRefreshToken = false): boolean {
    try {
      this.verifyToken(token, isRefreshToken);
      return false;
    } catch (error) {
      return true;
    }
  }

  /**
   * Get token expiration time
   */
  getTokenExpirationTime(isRefreshToken = false): string {
    return isRefreshToken
      ? this.configService.get<string>('JWT_REFRESH_EXPIRES')
      : this.configService.get<string>('JWT_ACCESS_EXPIRES');
  }
}
