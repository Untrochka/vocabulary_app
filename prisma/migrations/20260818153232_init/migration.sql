-- CreateTable
CREATE TABLE "daily_activity" (
    "date" TEXT NOT NULL,
    "activeReviews" INTEGER NOT NULL DEFAULT 0,
    "passiveReviews" INTEGER NOT NULL DEFAULT 0,
    "newWords" INTEGER NOT NULL DEFAULT 0,
    "minimumMet" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_activity_pkey" PRIMARY KEY ("date")
);

-- CreateTable
CREATE TABLE "streak_state" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "current" INTEGER NOT NULL DEFAULT 0,
    "best" INTEGER NOT NULL DEFAULT 0,
    "lastActiveDate" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "streak_state_pkey" PRIMARY KEY ("id")
);
