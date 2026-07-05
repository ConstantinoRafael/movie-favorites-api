import { AxiosError } from 'axios';
import axiosRetry, { IAxiosRetryConfig } from 'axios-retry';
import { PinoLogger } from 'nestjs-pino';
import { LogEvent } from '../common/logging';
import {
  isTmdbRetryableError,
  TMDB_RETRY_COUNT,
  TMDB_RETRY_ATTEMPTS,
} from './tmdb-retry.constants';

export const buildTmdbRetryConfig = (
  logger: PinoLogger,
): IAxiosRetryConfig => ({
  retries: TMDB_RETRY_COUNT,
  retryDelay: (retryCount, error) => {
    const waitTimeMs = Math.round(axiosRetry.exponentialDelay(retryCount));

    logger.warn(
      {
        event: LogEvent.RETRY,
        attempt: retryCount,
        maxAttempts: TMDB_RETRY_ATTEMPTS,
        waitTimeMs,
        status: error.response?.status ?? null,
        code: error.code ?? null,
        err: error.message,
      },
      'retry',
    );

    return waitTimeMs;
  },
  retryCondition: (error) => isTmdbRetryableError(error as AxiosError),
  shouldResetTimeout: true,
});

export const configureTmdbAxiosRetry = (
  axiosInstance: Parameters<typeof axiosRetry>[0],
  logger: PinoLogger,
): void => {
  axiosRetry(axiosInstance, buildTmdbRetryConfig(logger));
};
