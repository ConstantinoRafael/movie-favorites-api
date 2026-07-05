export class TmdbCircuitOpenException extends Error {
  constructor() {
    super('TMDB circuit breaker is open');
    this.name = TmdbCircuitOpenException.name;
  }
}
