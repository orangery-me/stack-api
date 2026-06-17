import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class InternalSecretGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const configuredSecret =
      this.configService.get<string>('INTERNAL_SECRET') || this.configService.get<string>('CANVAS_COLLAB_SECRET') || '';
    const providedSecret = request.headers['x-internal-secret'];

    if (!configuredSecret || providedSecret !== configuredSecret) {
      throw new UnauthorizedException('Invalid internal secret');
    }

    return true;
  }
}
