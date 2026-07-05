import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '../config';
import { TmdbCircuitBreaker } from './tmdb-circuit-breaker';
import { TmdbMovieDetails, TmdbSearchMoviesResponse } from './interfaces';

@Injectable()
export class TmdbService {
  constructor(
    private readonly httpService: HttpService,
    private readonly appConfig: AppConfigService,
    private readonly circuitBreaker: TmdbCircuitBreaker,
  ) {}

  async searchMovies(
    query: string,
    page = 1,
  ): Promise<TmdbSearchMoviesResponse> {
    return this.circuitBreaker.execute(() =>
      this.searchMoviesRequest(query, page),
    );
  }

  async getMovie(tmdbId: number): Promise<TmdbMovieDetails> {
    return this.circuitBreaker.execute(() => this.getMovieRequest(tmdbId));
  }

  private async searchMoviesRequest(
    query: string,
    page: number,
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

  private async getMovieRequest(tmdbId: number): Promise<TmdbMovieDetails> {
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
