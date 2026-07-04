import { Test, TestingModule } from '@nestjs/testing';
import { FavoriteRepository } from '../favorites/favorite.repository';
import { RedisService } from '../../redis';
import { TmdbService } from '../../tmdb';
import { MovieService } from './movie.service';

describe('MovieService', () => {
  let service: MovieService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MovieService,
        {
          provide: FavoriteRepository,
          useValue: {
            findAll: jest.fn(),
            findByTmdbId: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: RedisService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: TmdbService,
          useValue: {
            searchMovies: jest.fn(),
            getMovie: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MovieService>(MovieService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
