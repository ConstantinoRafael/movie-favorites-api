import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { API_TAGS } from '@common/swagger';
import { HealthCheckResponseDto } from './dto/health-check-response.dto';

@ApiTags(API_TAGS.HEALTH)
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Verificar saúde da API' })
  @ApiOkResponse({
    description: 'API operacional',
    type: HealthCheckResponseDto,
  })
  check(): HealthCheckResponseDto {
    return { status: 'ok' };
  }
}
