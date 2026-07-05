import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { AxiosError } from 'axios';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { MovieNotFoundException } from '@common/exceptions';
import { LogEvent } from '@common/logging';
import { getErrorMessage } from '@common/utils';
import { TmdbCircuitOpenException } from './tmdb-circuit-open.exception';

export type TmdbFetchOperation = 'getMovie' | 'search';

@Injectable()
export class TmdbErrorHandler {
  constructor(
    @InjectPinoLogger(TmdbErrorHandler.name)
    private readonly logger: PinoLogger,
  ) {}

  handleFetchError(
    error: unknown,
    operation: TmdbFetchOperation,
    tmdbId?: number,
  ): never {
    const resource = operation === 'getMovie' ? 'movie' : 'movies';

    if (error instanceof TmdbCircuitOpenException) {
      this.logger.warn(
        {
          event: LogEvent.FALLBACK,
          ...(tmdbId !== undefined && { tmdbId }),
          reason: 'circuit_open',
        },
        'fallback',
      );

      throw new BadGatewayException(`Failed to fetch ${resource} from TMDB`);
    }

    if (error instanceof AxiosError) {
      const status = error.response?.status;

      this.logger.error(
        {
          event: LogEvent.ERROR,
          ...(tmdbId !== undefined && { tmdbId }),
          status: status ?? 'unknown',
          err: error.message,
        },
        'error',
      );

      if (operation === 'getMovie' && status === 404 && tmdbId !== undefined) {
        throw new MovieNotFoundException(tmdbId, 'tmdb');
      }

      if (status === 401) {
        throw new InternalServerErrorException('TMDB API key is invalid');
      }

      throw new BadGatewayException(`Failed to fetch ${resource} from TMDB`);
    }

    this.logger.error(
      {
        event: LogEvent.ERROR,
        ...(tmdbId !== undefined && { tmdbId }),
        err: getErrorMessage(error),
      },
      'error',
    );

    throw new InternalServerErrorException(`Failed to fetch ${resource}`);
  }

  logEnrichmentFailure(error: unknown, tmdbId: number): void {
    const isCircuitOpen = error instanceof TmdbCircuitOpenException;
    const status =
      error instanceof AxiosError ? error.response?.status : undefined;

    this.logger.warn(
      {
        event: LogEvent.FALLBACK,
        tmdbId,
        reason: isCircuitOpen ? 'circuit_open' : 'tmdb_error',
        status: isCircuitOpen ? 'circuit_open' : (status ?? 'unknown'),
        err: getErrorMessage(error),
      },
      'fallback',
    );
  }
}
