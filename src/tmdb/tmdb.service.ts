import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '../config';
import { TmdbMovieDetails, TmdbSearchMoviesResponse } from './interfaces';

@Injectable()
export class TmdbService {
  constructor(
    private readonly httpService: HttpService,
    private readonly appConfig: AppConfigService,
  ) {}

  async searchMovies(
    query: string,
    page = 1,
  ): Promise<TmdbSearchMoviesResponse> {
    const { data } = await firstValueFrom(
      this.httpService.get<TmdbSearchMoviesResponse>('/search/movie', {
        params: {
          api_key: this.appConfig.tmdbApiKey,
          query,
          page,
        },
      }),
    );

    return data;
  }

  async getMovie(tmdbId: number): Promise<TmdbMovieDetails> {
    const { data } = await firstValueFrom(
      this.httpService.get<TmdbMovieDetails>(`/movie/${tmdbId}`, {
        params: {
          api_key: this.appConfig.tmdbApiKey,
        },
      }),
    );

    return data;
  }
}
