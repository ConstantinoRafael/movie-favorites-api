/**
 * Centraliza valores de configuração da aplicação.
 * Substituir por @nestjs/config quando a dependência for instalada.
 */
export const appConfig = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
} as const;
