import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { SystemLatencyService } from './system-latency.service';

@Injectable()
export class LatencyInterceptor implements NestInterceptor {
  constructor(private readonly latencyService: SystemLatencyService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest();
    const response = httpContext.getResponse();

    const path = request.route?.path || request.url;

    // Skip monitoring for static files or favicon
    if (path.includes('favicon') || path.includes('/assets/')) {
      return next.handle();
    }

    const start = performance.now();

    return next.handle().pipe(
      tap({
        next: () => this.log(request, response, start),
        error: (err) => this.log(request, response, start, err),
      })
    );
  }

  private log(request: any, response: any, start: number, error?: any) {
    const duration = Math.round(performance.now() - start);
    const statusCode = error ? error.status || 500 : response.statusCode || 200;
    const path = request.route?.path || request.url;
    const method = request.method;
    const ip = request.ip || request.headers['x-forwarded-for'] || request.connection.remoteAddress;
    const userId = request.user?.userId || request.user?.id;

    // Run DB record asynchronously in the background to prevent slowing down responses
    this.latencyService.record(path, method, duration, statusCode, ip, userId).catch(() => {
      // Fail silently to prevent telemetry errors from crashing the main request
    });
  }
}
