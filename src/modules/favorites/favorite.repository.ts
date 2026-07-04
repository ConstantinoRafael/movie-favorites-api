import { Injectable } from '@nestjs/common';
import { FavoriteMovie, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma';

@Injectable()
export class FavoriteRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<FavoriteMovie[]> {
    return this.prisma.favoriteMovie.findMany();
  }

  findByTmdbId(tmdbId: number): Promise<FavoriteMovie | null> {
    return this.prisma.favoriteMovie.findUnique({
      where: { tmdbId },
    });
  }

  create(data: Prisma.FavoriteMovieCreateInput): Promise<FavoriteMovie> {
    return this.prisma.favoriteMovie.create({ data });
  }

  update(
    tmdbId: number,
    data: Prisma.FavoriteMovieUpdateInput,
  ): Promise<FavoriteMovie> {
    return this.prisma.favoriteMovie.update({
      where: { tmdbId },
      data,
    });
  }

  delete(tmdbId: number): Promise<FavoriteMovie> {
    return this.prisma.favoriteMovie.delete({
      where: { tmdbId },
    });
  }
}
