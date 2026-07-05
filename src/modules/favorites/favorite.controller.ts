import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
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
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ErrorResponseDto, TmdbIdParamDto } from '@common/dto';
import { API_TAGS } from '@common/swagger';
import { FavoriteService } from './favorite.service';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import { FavoriteMovieResponseDto } from './dto/favorite-movie-response.dto';
import { UpdateFavoriteRatingDto } from './dto/update-favorite-rating.dto';

@ApiTags(API_TAGS.FAVORITES)
@Controller('favorites')
export class FavoriteController {
  constructor(private readonly favoriteService: FavoriteService) {}

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
    return this.favoriteService.listFavorites();
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
    return this.favoriteService.addFavorite(dto);
  }

  @Patch(':tmdbId/watch')
  @ApiOperation({ summary: 'Marcar filme favorito como assistido' })
  @ApiParam({
    name: 'tmdbId',
    type: Number,
    example: 550,
    description: 'ID do filme no TMDB',
  })
  @ApiOkResponse({
    description: 'Filme marcado como assistido (ou já estava assistido)',
    type: FavoriteMovieResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Parâmetro tmdbId inválido',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Filme favorito não encontrado',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Erro interno ao processar a requisição',
    type: ErrorResponseDto,
  })
  markAsWatched(
    @Param() params: TmdbIdParamDto,
  ): Promise<FavoriteMovieResponseDto> {
    return this.favoriteService.markAsWatched(params.tmdbId);
  }

  @Patch(':tmdbId/rating')
  @ApiOperation({ summary: 'Avaliar filme favorito assistido' })
  @ApiParam({
    name: 'tmdbId',
    type: Number,
    example: 550,
    description: 'ID do filme no TMDB',
  })
  @ApiOkResponse({
    description: 'Avaliação do filme atualizada com sucesso',
    type: FavoriteMovieResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'Dados inválidos ou filme ainda não foi marcado como assistido',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Filme favorito não encontrado',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Erro interno ao processar a requisição',
    type: ErrorResponseDto,
  })
  updateRating(
    @Param() params: TmdbIdParamDto,
    @Body() dto: UpdateFavoriteRatingDto,
  ): Promise<FavoriteMovieResponseDto> {
    return this.favoriteService.updateRating(params.tmdbId, dto);
  }
}
