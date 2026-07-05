export class EnvironmentValidationException extends Error {
  constructor(message: string) {
    super(message);
    this.name = EnvironmentValidationException.name;
  }
}
