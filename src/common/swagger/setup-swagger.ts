import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { API_TAGS, SWAGGER_PATH } from './swagger.constants';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Movie Favorites API')
    .setDescription(
      'API for managing a personal movie watchlist with TMDB integration. ' +
        'Stores local snapshots of favorited movies and supports watch status ' +
        'and personal ratings.',
    )
    .setVersion('1.0')
    .addTag(API_TAGS.HEALTH, 'Application health check')
    .addTag(API_TAGS.FAVORITES, 'Favorite movie management')
    .addTag(API_TAGS.MOVIES, 'TMDB movie search')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey: string, methodKey: string) =>
      `${controllerKey}_${methodKey}`,
  });

  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    jsonDocumentUrl: `${SWAGGER_PATH}-json`,
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      docExpansion: 'none',
    },
    customSiteTitle: 'Movie Favorites API — Docs',
  });
}
