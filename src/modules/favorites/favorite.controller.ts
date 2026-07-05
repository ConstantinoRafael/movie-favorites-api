import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '@common/dto';
import { API_TAGS } from '@common/swagger';
import { MovieService } from '../movies/movie.service';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import { FavoriteMovieResponseDto } from './dto/favorite-movie-response.dto';

@ApiTags(API_TAGS.FAVORITES)
@Controller('favorites')
export class FavoriteController {
  constructor(private readonly movieService: MovieService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar favoritos',
    description:
      'Retorna todos os favoritos enriquecidos com dados atualizados do TMDB. ' +
      'Quando o TMDB estiver indisponível, retorna os dados locais persistidos.',
  })
  @ApiOkResponse({
    description: 'Lista de favoritos enriquecidos com dados do TMDB',
    type: [FavoriteMovieResponseDto],
  })
  @ApiInternalServerErrorResponse({
    description: 'Erro interno ao processar a requisição',
    type: ErrorResponseDto,
  })
  findAll(): Promise<FavoriteMovieResponseDto[]> {
    return this.movieService.listFavorites();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Adicionar filme aos favoritos' })
  @ApiCreatedResponse({
    description: 'Filme adicionado aos favoritos com sucesso',
    type: FavoriteMovieResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Dados de entrada inválidos',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'Filme já está nos favoritos',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Filme não encontrado no TMDB',
    type: ErrorResponseDto,
  })
  @ApiBadGatewayResponse({
    description: 'Falha ao comunicar com o TMDB',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Erro interno ao processar a requisição',
    type: ErrorResponseDto,
  })
  create(@Body() dto: CreateFavoriteDto): Promise<FavoriteMovieResponseDto> {
    return this.movieService.addFavorite(dto);
  }
}
