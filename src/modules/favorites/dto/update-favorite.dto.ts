import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateFavoriteDto {
  @ApiPropertyOptional({
    example: true,
    description: 'Indica se o filme foi assistido',
  })
  @IsOptional()
  @IsBoolean()
  watched?: boolean;

  @ApiPropertyOptional({
    example: 9,
    description: 'Avaliação pessoal do usuário (1–10)',
    minimum: 1,
    maximum: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  rating?: number;
}
