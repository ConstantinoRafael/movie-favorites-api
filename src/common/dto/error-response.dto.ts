import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode: number;

  @ApiProperty({
    example: 'query must be longer than or equal to 1 characters',
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
  })
  message: string | string[];

  @ApiProperty({ example: '2026-07-04T15:00:00.000Z' })
  timestamp: string;

  @ApiProperty({ example: '/movies/search' })
  path: string;
}
