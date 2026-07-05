import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Request, Response } from 'express';
import { ErrorResponseDto } from '../dto/error-response.dto';
import { LogEvent } from '../logging/log-events';
import { RequestWithId } from '../types';
import { getErrorMessage } from '../utils';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(
    @InjectPinoLogger(HttpExceptionFilter.name)
    private readonly logger: PinoLogger,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithId>();

    const status = this.resolveStatus(exception);
    const message = this.extractMessage(exception);
    const errorResponse: ErrorResponseDto = {
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    this.logException(request, status, message, exception);

    response.status(status).json(errorResponse);
  }

  private resolveStatus(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }

    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private extractMessage(exception: unknown): string | string[] {
    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        return exceptionResponse;
      }

      if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null &&
        'message' in exceptionResponse
      ) {
        const { message } = exceptionResponse as {
          message: string | string[];
        };

        return message;
      }
    }

    if (exception instanceof Error) {
      return exception.message;
    }

    return 'Internal server error';
  }

  private logException(
    request: RequestWithId,
    status: number,
    message: string | string[],
    exception: unknown,
  ): void {
    const payload = {
      event: LogEvent.ERROR,
      requestId: request.id,
      method: request.method,
      path: request.url,
      statusCode: status,
      message,
      err:
        exception instanceof Error
          ? exception.stack ?? exception.message
          : getErrorMessage(exception),
    };

    if (status >= 500) {
      this.logger.error(payload, 'error');

      return;
    }

    this.logger.warn(payload, 'error');
  }
}
