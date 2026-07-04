import { HttpService } from '@nestjs/axios';
import { Test, TestingModule } from '@nestjs/testing';
import { of } from 'rxjs';
import { AppConfigService } from '../config';
import { TmdbMovieDetails, TmdbSearchMoviesResponse } from './interfaces';
import { TmdbService } from './tmdb.service';

describe('TmdbService', () => {
  let service: TmdbService;
  let httpService: { get: jest.Mock };

  const mockAppConfig = {
    tmdbApiKey: 'test-api-key',
    tmdbBaseUrl: 'https://api.themoviedb.org/3',
  };

  const mockSearchResponse: TmdbSearchMoviesResponse = {
    page: 1,
    total_pages: 1,
    total_results: 1,
    results: [
      {
        id: 550,
        title: 'Fight Club',
        overview: 'A ticking-time-bomb insomniac...',
        poster_path: '/poster.jpg',
        release_date: '1999-10-15',
        vote_average: 8.4,
      },
    ],
  };

  const mockMovieDetails: TmdbMovieDetails = {
    id: 550,
    title: 'Fight Club',
    overview: 'A ticking-time-bomb insomniac...',
    poster_path: '/poster.jpg',
    release_date: '1999-10-15',
    vote_average: 8.4,
    runtime: 139,
    genres: [{ id: 18, name: 'Drama' }],
    status: 'Released',
  };

  beforeEach(async () => {
    httpService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TmdbService,
        { provide: HttpService, useValue: httpService },
        { provide: AppConfigService, useValue: mockAppConfig },
      ],
    }).compile();

    service = module.get<TmdbService>(TmdbService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('searchMovies', () => {
    it('should call TMDB search endpoint', async () => {
      httpService.get.mockReturnValue(of({ data: mockSearchResponse }));

      const result = await service.searchMovies('fight club', 1);

      expect(result).toEqual(mockSearchResponse);
      expect(httpService.get).toHaveBeenCalledWith('/search/movie', {
        params: {
          api_key: mockAppConfig.tmdbApiKey,
          query: 'fight club',
          page: 1,
        },
      });
    });
  });

  describe('getMovie', () => {
    it('should call TMDB movie details endpoint', async () => {
      httpService.get.mockReturnValue(of({ data: mockMovieDetails }));

      const result = await service.getMovie(550);

      expect(result).toEqual(mockMovieDetails);
      expect(httpService.get).toHaveBeenCalledWith('/movie/550', {
        params: {
          api_key: mockAppConfig.tmdbApiKey,
        },
      });
    });
  });
});
