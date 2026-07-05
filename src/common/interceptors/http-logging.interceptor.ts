import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Observable, tap } from 'rxjs';
import { LogEvent } from '../logging/log-events';
import { RequestWithId } from '../types';
import { getErrorMessage } from '../utils';

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  constructor(
    @InjectPinoLogger(HttpLoggingInterceptor.name)
    private readonly logger: PinoLogger,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithId>();
    const startTime = Date.now();
    const requestId = request.id;

    if (requestId) {
      this.logger.assign({ requestId });
    }

    this.logger.info(
      {
        event: LogEvent.REQUEST_STARTED,
        requestId,
        method: request.method,
        path: request.url,
      },
      'request started',
    );

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse<Response>();

          this.logger.info(
            {
              event: LogEvent.REQUEST_FINISHED,
              requestId,
              method: request.method,
              path: request.url,
              statusCode: response.statusCode,
              responseTimeMs: Date.now() - startTime,
            },
            'request finished',
          );
        },
        error: (error: unknown) => {
          this.logger.error(
            {
              event: LogEvent.ERROR,
              requestId,
              method: request.method,
              path: request.url,
              responseTimeMs: Date.now() - startTime,
              err: getErrorMessage(error),
            },
            'error',
          );
        },
      }),
    );
  }
}
