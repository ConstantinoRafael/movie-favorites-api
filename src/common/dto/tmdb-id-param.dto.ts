import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class TmdbIdParamDto {
  @ApiProperty({
    example: 550,
    description: 'Identificador do filme no TMDB',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  tmdbId: number;
}
