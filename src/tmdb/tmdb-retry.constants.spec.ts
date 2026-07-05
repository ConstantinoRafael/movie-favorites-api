import { AxiosError, AxiosHeaders } from 'axios';
import { isTmdbRetryableError } from './tmdb-retry.constants';

describe('isTmdbRetryableError', () => {
  const buildAxiosError = (
    status?: number,
    code?: string,
  ): AxiosError => {
    const error = new AxiosError('Request failed', code);

    if (status !== undefined) {
      error.response = {
        status,
        statusText: 'Error',
        headers: {},
        config: { headers: new AxiosHeaders() },
        data: {},
      };
    }

    return error;
  };

  it.each([500, 502, 503, 504])(
    'should retry on HTTP %i',
    (status) => {
      expect(isTmdbRetryableError(buildAxiosError(status))).toBe(true);
    },
  );

  it.each([400, 401, 403, 404])(
    'should not retry on HTTP %i',
    (status) => {
      expect(isTmdbRetryableError(buildAxiosError(status))).toBe(false);
    },
  );

  it.each(['ECONNABORTED', 'ETIMEDOUT'])(
    'should retry on timeout code %s',
    (code) => {
      expect(isTmdbRetryableError(buildAxiosError(undefined, code))).toBe(true);
    },
  );

  it('should not retry on other HTTP errors', () => {
    expect(isTmdbRetryableError(buildAxiosError(429))).toBe(false);
    expect(isTmdbRetryableError(buildAxiosError(408))).toBe(false);
  });

  it('should not retry on network errors without retryable status', () => {
    expect(isTmdbRetryableError(buildAxiosError(undefined, 'ENOTFOUND'))).toBe(
      false,
    );
  });
});
