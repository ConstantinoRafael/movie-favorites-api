import { ApiProperty } from '@nestjs/swagger';

export class HealthCheckResponseDto {
  @ApiProperty({
    example: 'ok',
    description: 'Status operacional da API',
  })
  status: string;
}
