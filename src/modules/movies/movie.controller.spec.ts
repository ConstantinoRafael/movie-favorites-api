import { Test, TestingModule } from '@nestjs/testing';
import { MovieController } from './movie.controller';
import { MovieService } from './movie.service';
import { SearchMoviesResponseDto } from './dto/search-movies-response.dto';

describe('MovieController', () => {
  let controller: MovieController;
  let movieService: { search: jest.Mock };

  const mockSearchResponse: SearchMoviesResponseDto = {
    page: 1,
    totalPages: 1,
    totalResults: 1,
    results: [
      {
        tmdbId: 550,
        title: 'Fight Club',
        overview: 'A ticking-time-bomb insomniac...',
        posterPath: '/poster.jpg',
        releaseYear: 1999,
        voteAverage: 8.4,
        isFavorite: false,
      },
    ],
  };

  beforeEach(async () => {
    movieService = {
      search: jest.fn().mockResolvedValue(mockSearchResponse),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MovieController],
      providers: [{ provide: MovieService, useValue: movieService }],
    }).compile();

    controller = module.get<MovieController>(MovieController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should delegate search to MovieService', async () => {
    const query = { query: 'fight club', page: 1 };

    const result = await controller.search(query);

    expect(result).toEqual(mockSearchResponse);
    expect(movieService.search).toHaveBeenCalledWith(query);
  });
});
