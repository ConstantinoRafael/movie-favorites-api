import { ApiProperty } from '@nestjs/swagger';

export class MovieGenreResponseDto {
  @ApiProperty({ example: 18, description: 'ID do gênero no TMDB' })
  id: number;

  @ApiProperty({ example: 'Drama', description: 'Nome do gênero' })
  name: string;
}
