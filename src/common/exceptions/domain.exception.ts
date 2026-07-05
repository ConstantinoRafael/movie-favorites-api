import { HttpException, HttpStatus } from '@nestjs/common';

export abstract class DomainException extends HttpException {
  protected constructor(message: string, statusCode: HttpStatus) {
    super(message, statusCode);
  }
}
