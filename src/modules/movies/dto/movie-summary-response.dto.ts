import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MovieSummaryResponseDto {
  @ApiProperty({ example: 550, description: 'ID do filme no TMDB' })
  tmdbId: number;

  @ApiProperty({ example: 'Fight Club', description: 'Título do filme' })
  title: string;

  @ApiProperty({
    example: 'A ticking-time-bomb insomniac...',
    description: 'Sinopse do filme',
  })
  overview: string;

  @ApiPropertyOptional({
    example: '/pB8BM7pdSp6B6Ih7QZdYzCad1F.jpg',
    description: 'Caminho relativo do poster no TMDB',
    nullable: true,
  })
  posterPath: string | null;

  @ApiProperty({ example: 1999, description: 'Ano de lançamento' })
  releaseYear: number;

  @ApiProperty({ example: 8.4, description: 'Nota média do TMDB (0–10)' })
  voteAverage: number;

  @ApiPropertyOptional({
    example: false,
    description: 'Indica se o filme já está nos favoritos do usuário',
  })
  isFavorite?: boolean;
}
