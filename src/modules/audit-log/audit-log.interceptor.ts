import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditLogService } from './audit-log.service';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly auditLogService: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, path, user, ip, body } = request;

    if (!user || user.role !== 'ADMIN') {
      return next.handle();
    }

    const action = this.resolveAction(method, path);
    if (!action) {
      return next.handle();
    }

    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;

        this.auditLogService.create({
          userId: user.userId,
          userName: user.email,
          action,
          resourceType: this.resolveResourceType(path),
          resourceId: request.params?.id,
          metadata: {
            method,
            path,
            duration,
            requestBody: this.sanitizeBody(body),
          },
          status: 'success',
          ipAddress: ip,
        }).catch(() => {
          // Fail silently — audit logging should never break the main flow
        });
      }),
    );
  }

  private resolveAction(method: string, path: string): string | null {
    if (path.includes('/admin/settings')) return 'settings.update';
    if (path.includes('/admin/stats')) return null;
    if (path.includes('/users') && method === 'DELETE') return 'user.delete';
    if (path.includes('/users') && method === 'POST') return 'user.create';
    if (path.includes('/users') && method === 'PATCH') return 'user.update';
    return null;
  }

  private resolveResourceType(path: string): string {
    if (path.includes('/users')) return 'user';
    if (path.includes('/workspaces')) return 'workspace';
    if (path.includes('/settings')) return 'setting';
    return 'unknown';
  }

  private sanitizeBody(body: any): any {
    if (!body) return undefined;
    const sanitized = { ...body };
    delete sanitized.password;
    delete sanitized.oldPassword;
    delete sanitized.newPassword;
    delete sanitized.confirmPassword;
    return sanitized;
  }
}
