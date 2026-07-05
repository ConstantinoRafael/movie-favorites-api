import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, Max, Min } from 'class-validator';

export class UpdateFavoriteRatingDto {
  @ApiProperty({
    example: 8.5,
    description: 'Avaliação pessoal do usuário (0–10, aceita decimais)',
    minimum: 0,
    maximum: 10,
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10)
  rating: number;
}
