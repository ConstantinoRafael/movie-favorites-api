import { BadRequestException, ValidationError } from '@nestjs/common';
import { InvalidMovieRatingException } from '../exceptions';

const extractValidationMessages = (errors: ValidationError[]): string[] =>
  errors.flatMap((error) => {
    const constraints = Object.values(error.constraints ?? {});

    if (constraints.length > 0) {
      return constraints;
    }

    if (error.children?.length) {
      return extractValidationMessages(error.children);
    }

    return [];
  });

export const validationExceptionFactory = (
  errors: ValidationError[],
): BadRequestException | InvalidMovieRatingException => {
  const ratingError = errors.find((error) => error.property === 'rating');

  if (ratingError) {
    const messages = Object.values(ratingError.constraints ?? {});

    return new InvalidMovieRatingException(
      messages[0] ?? 'Invalid movie rating',
    );
  }

  const messages = extractValidationMessages(errors);

  return new BadRequestException(messages);
};
