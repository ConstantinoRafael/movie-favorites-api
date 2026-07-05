import CircuitBreaker from 'opossum';
import { TmdbCircuitBreaker } from './tmdb-circuit-breaker';
import {
  TMDB_CIRCUIT_ERROR_THRESHOLD_PERCENT,
  TMDB_CIRCUIT_RESET_TIMEOUT_MS,
  TMDB_CIRCUIT_TIMEOUT_MS,
  TMDB_CIRCUIT_VOLUME_THRESHOLD,
} from './tmdb-circuit-breaker.constants';
import { LogEvent } from '../common/logging';
import { TmdbCircuitOpenException } from './tmdb-circuit-open.exception';

describe('TmdbCircuitBreaker', () => {
  let logger: {
    warn: jest.Mock;
    info: jest.Mock;
  };

  beforeEach(() => {
    logger = {
      warn: jest.fn(),
      info: jest.fn(),
    };
  });

  it('should use configured timeout, threshold and reset timeout', () => {
    const breaker = new TmdbCircuitBreaker(logger as never);
    const internalBreaker = (
      breaker as unknown as { breaker: CircuitBreaker }
    ).breaker;

    expect(internalBreaker.options.timeout).toBe(TMDB_CIRCUIT_TIMEOUT_MS);
    expect(internalBreaker.options.errorThresholdPercentage).toBe(
      TMDB_CIRCUIT_ERROR_THRESHOLD_PERCENT,
    );
    expect(internalBreaker.options.resetTimeout).toBe(
      TMDB_CIRCUIT_RESET_TIMEOUT_MS,
    );
    expect(internalBreaker.options.volumeThreshold).toBe(
      TMDB_CIRCUIT_VOLUME_THRESHOLD,
    );
  });

  it('should execute action when circuit is closed', async () => {
    const breaker = new TmdbCircuitBreaker(logger as never);
    const action = jest.fn().mockResolvedValue({ id: 550 });

    const result = await breaker.execute(action);

    expect(result).toEqual({ id: 550 });
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('should not call action and throw when circuit is open', async () => {
    const breaker = new TmdbCircuitBreaker(logger as never);
    const internalBreaker = (
      breaker as unknown as { breaker: CircuitBreaker }
    ).breaker;
    const action = jest.fn().mockResolvedValue({ id: 550 });

    internalBreaker.open();

    await expect(breaker.execute(action)).rejects.toBeInstanceOf(
      TmdbCircuitOpenException,
    );
    expect(action).not.toHaveBeenCalled();
  });

  it('should log circuit state transitions', () => {
    const breaker = new TmdbCircuitBreaker(logger as never);
    const internalBreaker = (
      breaker as unknown as { breaker: CircuitBreaker }
    ).breaker;

    internalBreaker.open();
    internalBreaker.emit('halfOpen');
    internalBreaker.emit('close');

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: LogEvent.FALLBACK,
        reason: 'circuit_open',
      }),
      'fallback',
    );
    expect(logger.info).toHaveBeenCalledWith(
      { event: 'circuit.half_open' },
      'circuit half open',
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'circuit.closed' }),
      'circuit closed',
    );
  });
});
