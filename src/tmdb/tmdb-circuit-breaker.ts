import { Injectable } from '@nestjs/common';
import CircuitBreaker from 'opossum';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  TMDB_CIRCUIT_ERROR_THRESHOLD_PERCENT,
  TMDB_CIRCUIT_RESET_TIMEOUT_MS,
  TMDB_CIRCUIT_TIMEOUT_MS,
  TMDB_CIRCUIT_VOLUME_THRESHOLD,
} from './tmdb-circuit-breaker.constants';
import { TmdbCircuitOpenException } from './tmdb-circuit-open.exception';

type TmdbAction<T> = () => Promise<T>;

@Injectable()
export class TmdbCircuitBreaker {
  private readonly breaker: CircuitBreaker<[TmdbAction<unknown>], unknown>;

  constructor(
    @InjectPinoLogger(TmdbCircuitBreaker.name)
    private readonly logger: PinoLogger,
  ) {
    this.breaker = new CircuitBreaker(
      async (action: TmdbAction<unknown>) => action(),
      {
        timeout: TMDB_CIRCUIT_TIMEOUT_MS,
        errorThresholdPercentage: TMDB_CIRCUIT_ERROR_THRESHOLD_PERCENT,
        resetTimeout: TMDB_CIRCUIT_RESET_TIMEOUT_MS,
        volumeThreshold: TMDB_CIRCUIT_VOLUME_THRESHOLD,
      },
    );

    this.breaker.on('open', () => {
      this.logger.warn(
        {
          failures: this.breaker.stats.failures,
          fires: this.breaker.stats.fires,
          timeouts: this.breaker.stats.timeouts,
          resetTimeoutMs: TMDB_CIRCUIT_RESET_TIMEOUT_MS,
        },
        'TMDB circuit open',
      );
    });

    this.breaker.on('halfOpen', () => {
      this.logger.info({}, 'TMDB circuit half open');
    });

    this.breaker.on('close', () => {
      this.logger.info(
        {
          successes: this.breaker.stats.successes,
          fires: this.breaker.stats.fires,
        },
        'TMDB circuit closed',
      );
    });

    this.breaker.fallback(() => {
      throw new TmdbCircuitOpenException();
    });
  }

  execute<T>(action: TmdbAction<T>): Promise<T> {
    return this.breaker.fire(action) as Promise<T>;
  }
}
