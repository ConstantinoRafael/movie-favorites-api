import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FavoriteMovieResponseDto {
  @ApiProperty({ example: 1, description: 'ID interno do registro' })
  id: number;

  @ApiProperty({ example: 550, description: 'ID do filme no TMDB' })
  tmdbId: number;

  @ApiProperty({
    example: 'Fight Club',
    description: 'Título do filme (snapshot)',
  })
  title: string;

  @ApiProperty({
    example: 'A ticking-time-bomb insomniac...',
    description: 'Sinopse do filme (snapshot)',
  })
  overview: string;

  @ApiProperty({ example: 1999, description: 'Ano de lançamento (snapshot)' })
  releaseYear: number;

  @ApiPropertyOptional({
    example: '/pB8BM7pdSp6B6Ih7QZdYzCad1F.jpg',
    description: 'Caminho relativo do poster (snapshot)',
    nullable: true,
  })
  posterPath: string | null;

  @ApiProperty({
    example: 8.4,
    description: 'Nota média do TMDB no momento do favorito (snapshot)',
  })
  voteAverage: number;

  @ApiProperty({
    example: false,
    description: 'Indica se o filme foi assistido',
  })
  watched: boolean;

  @ApiPropertyOptional({
    example: '2026-01-15T20:30:00.000Z',
    description: 'Data em que o filme foi marcado como assistido',
    nullable: true,
  })
  watchedAt: Date | null;

  @ApiPropertyOptional({
    example: 9,
    description: 'Avaliação pessoal do usuário (1–10)',
    nullable: true,
  })
  rating: number | null;

  @ApiProperty({
    example: '2026-01-01T12:00:00.000Z',
    description: 'Data em que o filme foi adicionado aos favoritos',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2026-01-01T12:00:00.000Z',
    description: 'Data da última atualização do registro',
  })
  updatedAt: Date;
}
