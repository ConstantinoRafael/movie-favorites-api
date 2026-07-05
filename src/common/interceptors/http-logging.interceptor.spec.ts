import { CallHandler, ExecutionContext } from '@nestjs/common';
import { getLoggerToken } from 'nestjs-pino';
import { Test, TestingModule } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import { LogEvent } from '../logging/log-events';
import { HttpLoggingInterceptor } from './http-logging.interceptor';

describe('HttpLoggingInterceptor', () => {
  let interceptor: HttpLoggingInterceptor;
  let logger: { info: jest.Mock; error: jest.Mock; assign: jest.Mock };

  beforeEach(async () => {
    logger = {
      info: jest.fn(),
      error: jest.fn(),
      assign: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HttpLoggingInterceptor,
        {
          provide: getLoggerToken(HttpLoggingInterceptor.name),
          useValue: logger,
        },
      ],
    }).compile();

    interceptor = module.get(HttpLoggingInterceptor);
  });

  it('should log request started and finished with response time', (done) => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          id: 'req-456',
          method: 'GET',
          url: '/favorites',
        }),
        getResponse: () => ({ statusCode: 200 }),
      }),
    } as ExecutionContext;

    const next: CallHandler = {
      handle: () => of({ ok: true }),
    };

    interceptor.intercept(context, next).subscribe({
      complete: () => {
        expect(logger.assign).toHaveBeenCalledWith({ requestId: 'req-456' });
        expect(logger.info).toHaveBeenCalledWith(
          expect.objectContaining({
            event: LogEvent.REQUEST_STARTED,
            requestId: 'req-456',
          }),
          'request started',
        );
        expect(logger.info).toHaveBeenCalledWith(
          expect.objectContaining({
            event: LogEvent.REQUEST_FINISHED,
            requestId: 'req-456',
            statusCode: 200,
            responseTimeMs: expect.any(Number),
          }),
          'request finished',
        );
        done();
      },
    });
  });

  it('should log error when request fails', (done) => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          id: 'req-789',
          method: 'POST',
          url: '/favorites',
        }),
        getResponse: () => ({ statusCode: 500 }),
      }),
    } as ExecutionContext;

    const next: CallHandler = {
      handle: () => throwError(() => new Error('failure')),
    };

    interceptor.intercept(context, next).subscribe({
      error: () => {
        expect(logger.error).toHaveBeenCalledWith(
          expect.objectContaining({
            event: LogEvent.ERROR,
            requestId: 'req-789',
            responseTimeMs: expect.any(Number),
          }),
          'error',
        );
        done();
      },
    });
  });
});
