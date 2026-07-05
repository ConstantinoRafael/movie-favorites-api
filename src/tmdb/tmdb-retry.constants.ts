import { AxiosError } from 'axios';

export const TMDB_RETRY_ATTEMPTS = 3;
export const TMDB_RETRY_COUNT = TMDB_RETRY_ATTEMPTS - 1;

const RETRYABLE_STATUS_CODES = new Set([500, 502, 503, 504]);
const NON_RETRYABLE_STATUS_CODES = new Set([400, 401, 403, 404]);

const TIMEOUT_ERROR_CODES = new Set(['ECONNABORTED', 'ETIMEDOUT']);

export const isTmdbRetryableError = (error: AxiosError): boolean => {
  const status = error.response?.status;

  if (status !== undefined && NON_RETRYABLE_STATUS_CODES.has(status)) {
    return false;
  }

  if (status !== undefined && RETRYABLE_STATUS_CODES.has(status)) {
    return true;
  }

  if (error.code !== undefined && TIMEOUT_ERROR_CODES.has(error.code)) {
    return true;
  }

  return false;
};
