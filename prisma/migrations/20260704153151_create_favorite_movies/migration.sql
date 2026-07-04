-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "favorite_movies" (
    "id" SERIAL NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "overview" TEXT NOT NULL,
    "releaseYear" INTEGER NOT NULL,
    "posterPath" TEXT,
    "voteAverage" REAL NOT NULL,
    "watched" BOOLEAN NOT NULL DEFAULT false,
    "watchedAt" TIMESTAMP(3),
    "rating" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "favorite_movies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "favorite_movies_tmdbId_key" ON "favorite_movies"("tmdbId");
