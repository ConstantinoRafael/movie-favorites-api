import { ApiProperty } from '@nestjs/swagger';
import { MovieSummaryResponseDto } from './movie-summary-response.dto';

export class SearchMoviesResponseDto {
  @ApiProperty({ example: 1, description: 'Página atual dos resultados' })
  page: number;

  @ApiProperty({ example: 10, description: 'Total de páginas disponíveis' })
  totalPages: number;

  @ApiProperty({ example: 195, description: 'Total de filmes encontrados' })
  totalResults: number;

  @ApiProperty({
    type: [MovieSummaryResponseDto],
    description: 'Lista de filmes encontrados',
  })
  results: MovieSummaryResponseDto[];
}
