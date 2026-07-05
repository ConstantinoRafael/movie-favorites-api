import { AxiosError, AxiosHeaders } from 'axios';
import { buildTmdbRetryConfig } from './tmdb-retry.config';
import { TMDB_RETRY_ATTEMPTS, TMDB_RETRY_COUNT } from './tmdb-retry.constants';
import { LogEvent } from '../common/logging';
import { TmdbHttpRetrySetup } from './tmdb-http-retry.setup';
import { HttpService } from '@nestjs/axios';
import { Test, TestingModule } from '@nestjs/testing';
import axios from 'axios';
import { getLoggerToken } from 'nestjs-pino';
import { configureTmdbAxiosRetry } from './tmdb-retry.config';

describe('buildTmdbRetryConfig', () => {
  let logger: { warn: jest.Mock };

  beforeEach(() => {
    logger = { warn: jest.fn() };
  });

  it('should configure 3 total attempts', () => {
    const config = buildTmdbRetryConfig(logger as never);

    expect(config.retries).toBe(TMDB_RETRY_COUNT);
    expect(TMDB_RETRY_COUNT + 1).toBe(TMDB_RETRY_ATTEMPTS);
    expect(config.shouldResetTimeout).toBe(true);
  });

  it('should log attempt, wait time and error when scheduling retry', () => {
    const config = buildTmdbRetryConfig(logger as never);

    const error = new AxiosError('Gateway Timeout');
    error.response = {
      status: 504,
      statusText: 'Gateway Timeout',
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: {},
    };

    const waitTimeMs = config.retryDelay?.(1, error, {} as never);

    expect(waitTimeMs).toBeGreaterThan(0);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: LogEvent.RETRY,
        attempt: 1,
        maxAttempts: TMDB_RETRY_ATTEMPTS,
        waitTimeMs,
        status: 504,
        err: 'Gateway Timeout',
      }),
      'retry',
    );
  });

  it('should retry only retryable errors', () => {
    const config = buildTmdbRetryConfig(logger as never);

    const retryableError = new AxiosError('Bad Gateway');
    retryableError.response = {
      status: 502,
      statusText: 'Bad Gateway',
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: {},
    };

    const nonRetryableError = new AxiosError('Not Found');
    nonRetryableError.response = {
      status: 404,
      statusText: 'Not Found',
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: {},
    };

    expect(config.retryCondition?.(retryableError)).toBe(true);
    expect(config.retryCondition?.(nonRetryableError)).toBe(false);
  });
});

describe('configureTmdbAxiosRetry', () => {
  it('should register axios retry interceptors', () => {
    const axiosInstance = axios.create();
    const logger = { warn: jest.fn() };
    const handlersBefore =
      axiosInstance.interceptors.response.handlers.length;

    configureTmdbAxiosRetry(axiosInstance, logger as never);

    expect(axiosInstance.interceptors.response.handlers.length).toBeGreaterThan(
      handlersBefore,
    );
  });
});

describe('TmdbHttpRetrySetup', () => {
  it('should configure retry on module init', async () => {
    const axiosInstance = axios.create();
    const logger = { warn: jest.fn() };
    const handlersBefore =
      axiosInstance.interceptors.response.handlers.length;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TmdbHttpRetrySetup,
        {
          provide: HttpService,
          useValue: { axiosRef: axiosInstance },
        },
        {
          provide: getLoggerToken(TmdbHttpRetrySetup.name),
          useValue: logger,
        },
      ],
    }).compile();

    const setup = module.get(TmdbHttpRetrySetup);
    setup.onModuleInit();

    expect(axiosInstance.interceptors.response.handlers.length).toBeGreaterThan(
      handlersBefore,
    );
  });
});
