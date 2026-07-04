import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class SearchMoviesQueryDto {
  @ApiProperty({
    example: 'fight club',
    description: 'Termo de busca para pesquisar filmes no TMDB',
    minLength: 1,
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  query: string;

  @ApiProperty({
    example: 1,
    description: 'Página de resultados do TMDB',
    minimum: 1,
    maximum: 500,
    required: false,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  page?: number = 1;
}
