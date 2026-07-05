import { Test, TestingModule } from '@nestjs/testing';
import { FavoriteMovie } from '@prisma/client';
import { PrismaService } from '../../prisma';
import { FavoriteRepository } from './favorite.repository';

describe('FavoriteRepository', () => {
  let repository: FavoriteRepository;
  let prisma: {
    favoriteMovie: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  const mockFavorite: FavoriteMovie = {
    id: 1,
    tmdbId: 550,
    title: 'Fight Club',
    overview: 'A ticking-time-bomb insomniac...',
    releaseYear: 1999,
    posterPath: '/poster.jpg',
    voteAverage: 8.4,
    watched: false,
    watchedAt: null,
    rating: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    prisma = {
      favoriteMovie: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FavoriteRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    repository = module.get<FavoriteRepository>(FavoriteRepository);
  });

  it('should find all favorites', async () => {
    prisma.favoriteMovie.findMany.mockResolvedValue([mockFavorite]);

    const result = await repository.findAll();

    expect(result).toEqual([mockFavorite]);
    expect(prisma.favoriteMovie.findMany).toHaveBeenCalledWith();
  });

  it('should find a favorite by tmdbId', async () => {
    prisma.favoriteMovie.findUnique.mockResolvedValue(mockFavorite);

    const result = await repository.findByTmdbId(550);

    expect(result).toEqual(mockFavorite);
    expect(prisma.favoriteMovie.findUnique).toHaveBeenCalledWith({
      where: { tmdbId: 550 },
    });
  });

  it('should create a favorite', async () => {
    const createData = {
      tmdbId: 550,
      title: 'Fight Club',
      overview: 'A ticking-time-bomb insomniac...',
      releaseYear: 1999,
      posterPath: '/poster.jpg',
      voteAverage: 8.4,
    };

    prisma.favoriteMovie.create.mockResolvedValue(mockFavorite);

    const result = await repository.create(createData);

    expect(result).toEqual(mockFavorite);
    expect(prisma.favoriteMovie.create).toHaveBeenCalledWith({
      data: createData,
    });
  });

  it('should update a favorite', async () => {
    const updateData = { watched: true, watchedAt: new Date('2026-01-02') };
    const updatedFavorite = { ...mockFavorite, ...updateData };

    prisma.favoriteMovie.update.mockResolvedValue(updatedFavorite);

    const result = await repository.update(550, updateData);

    expect(result).toEqual(updatedFavorite);
    expect(prisma.favoriteMovie.update).toHaveBeenCalledWith({
      where: { tmdbId: 550 },
      data: updateData,
    });
  });
});
