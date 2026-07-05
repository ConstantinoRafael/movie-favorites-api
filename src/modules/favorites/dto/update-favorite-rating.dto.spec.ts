import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateFavoriteRatingDto } from './update-favorite-rating.dto';

describe('UpdateFavoriteRatingDto', () => {
  describe('nota inválida', () => {
    it.each([
      { rating: -1, description: 'negativa' },
      { rating: 10.5, description: 'acima do máximo (10)' },
      { rating: 'abc', description: 'não numérica' },
    ])('deve falhar na validação quando a nota é $description', async ({ rating }) => {
      const dto = plainToInstance(UpdateFavoriteRatingDto, { rating });

      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]?.property).toBe('rating');
    });
  });

  describe('nota válida', () => {
    it.each([0, 5, 8.5, 10])(
      'deve aceitar nota %s dentro do intervalo 0–10',
      async (rating) => {
        const dto = plainToInstance(UpdateFavoriteRatingDto, { rating });

        const errors = await validate(dto);

        expect(errors).toHaveLength(0);
      },
    );
  });
});
