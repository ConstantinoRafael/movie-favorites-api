import { EnvironmentValidationException } from '../common/exceptions';
import { plainToInstance, Type } from 'class-transformer';
import { IsInt, IsString, IsUrl, Min, validateSync } from 'class-validator';

export class EnvironmentVariables {
  @IsString()
  DATABASE_URL: string;

  @IsString()
  TMDB_API_KEY: string;

  @IsUrl({ require_tld: false })
  TMDB_BASE_URL: string;

  @IsString()
  REDIS_URL: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  APP_PORT: number;
}

export function validateEnvironment(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new EnvironmentValidationException(
      `Invalid environment variables:\n${errors
        .map((error) => Object.values(error.constraints ?? {}).join(', '))
        .join('\n')}`,
    );
  }

  return validatedConfig;
}
