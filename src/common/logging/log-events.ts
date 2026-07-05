export const LogEvent = {
  REQUEST_STARTED: 'request.started',
  REQUEST_FINISHED: 'request.finished',
  CACHE_HIT: 'cache.hit',
  CACHE_MISS: 'cache.miss',
  RETRY: 'retry',
  FALLBACK: 'fallback',
  ERROR: 'error',
} as const;

export type LogEventType = (typeof LogEvent)[keyof typeof LogEvent];
