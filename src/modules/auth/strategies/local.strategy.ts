import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';

import { AuthService } from '../auth.service';
import { UserPayloadDto } from '../dto/user-payload.dto';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({ usernameField: 'email' });
  }

  async validate(email: string, password: string, req?: any): Promise<UserPayloadDto> {
    const lang = req?.headers?.['x-lang'] || req?.query?.lang || 'vi';
    return await this.authService.validateUser({ email, password }, lang);
  }
}
