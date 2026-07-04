import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import {
  API_TAGS,
  BEARER_AUTH_SCHEME,
  SWAGGER_PATH,
} from './swagger.constants';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Movie Favorites API')
    .setDescription(
      'API para gerenciamento de filmes favoritos com integração ao TMDB. ' +
        'Armazena snapshots locais dos filmes favoritados e permite registrar ' +
        'status de visualização e avaliação pessoal.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Token JWT de autenticação',
      },
      BEARER_AUTH_SCHEME,
    )
    .addTag(API_TAGS.HEALTH, 'Verificação de saúde da aplicação')
    .addTag(API_TAGS.FAVORITES, 'Gerenciamento de filmes favoritos')
    .addTag(API_TAGS.MOVIES, 'Busca e consulta de filmes no TMDB')
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
