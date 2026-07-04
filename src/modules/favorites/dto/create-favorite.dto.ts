import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class CreateFavoriteDto {
  @ApiProperty({
    example: 550,
    description: 'ID do filme no TMDB a ser adicionado aos favoritos',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  tmdbId: number;
}
