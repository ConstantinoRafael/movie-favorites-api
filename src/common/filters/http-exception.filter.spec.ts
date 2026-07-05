import { ArgumentsHost, BadRequestException, HttpStatus } from '@nestjs/common';
import { MovieAlreadyFavoritedException } from '../exceptions';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let host: ArgumentsHost;

  beforeEach(() => {
    filter = new HttpExceptionFilter();

    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    host = {
      switchToHttp: () => ({
        getResponse: () => ({ status: statusMock }),
        getRequest: () => ({ url: '/favorites/550', method: 'PATCH' }),
      }),
    } as ArgumentsHost;
  });

  it('should format domain exceptions with standard error response', () => {
    filter.catch(new MovieAlreadyFavoritedException(), host);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.CONFLICT,
        message: 'Movie is already in favorites',
        timestamp: expect.any(String),
        path: '/favorites/550',
      }),
    );

    const response = jsonMock.mock.calls[0]?.[0] as Record<string, unknown>;

    expect(Object.keys(response).sort()).toEqual([
      'message',
      'path',
      'statusCode',
      'timestamp',
    ]);
  });

  it('should format validation errors with standard error response', () => {
    filter.catch(new BadRequestException(['rating must not be greater than 10']), host);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        message: ['rating must not be greater than 10'],
        path: '/favorites/550',
      }),
    );
  });

  it('should format unknown errors as internal server error', () => {
    filter.catch('unexpected failure', host);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
      }),
    );
  });
});
