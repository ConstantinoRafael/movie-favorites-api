import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '@common/dto';
import { API_TAGS } from '@common/swagger';
import { SearchMoviesQueryDto } from './dto/search-movies-query.dto';
import { SearchMoviesResponseDto } from './dto/search-movies-response.dto';
import { MovieService } from './movie.service';

@ApiTags(API_TAGS.MOVIES)
@Controller('movies')
export class MovieController {
  constructor(private readonly movieService: MovieService) {}

  @Get('search')
  @ApiOperation({ summary: 'Buscar filmes no TMDB' })
  @ApiOkResponse({
    description: 'Lista paginada de filmes encontrados',
    type: SearchMoviesResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Parâmetros de busca inválidos',
    type: ErrorResponseDto,
  })
  @ApiBadGatewayResponse({
    description: 'Falha ao comunicar com o TMDB',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Erro interno ao processar a busca',
    type: ErrorResponseDto,
  })
  search(
    @Query() query: SearchMoviesQueryDto,
  ): Promise<SearchMoviesResponseDto> {
    return this.movieService.search(query);
  }
}
