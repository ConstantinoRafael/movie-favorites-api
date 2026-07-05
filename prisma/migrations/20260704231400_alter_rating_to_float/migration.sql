-- AlterTable
ALTER TABLE "favorite_movies" ALTER COLUMN "rating" SET DATA TYPE REAL USING "rating"::real;
