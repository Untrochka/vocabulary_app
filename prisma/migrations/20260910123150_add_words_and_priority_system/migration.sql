-- CreateTable
CREATE TABLE "words" (
    "id" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "tr1" TEXT NOT NULL DEFAULT '',
    "tr2" TEXT NOT NULL DEFAULT '',
    "ipa" TEXT NOT NULL DEFAULT '',
    "example" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'Не изучен',
    "strength" INTEGER NOT NULL DEFAULT 0,
    "learnedAt" TEXT,
    "passiveReps" INTEGER NOT NULL DEFAULT 0,
    "passiveInterval" INTEGER NOT NULL DEFAULT 0,
    "passiveEase" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "passiveDue" TEXT,
    "passiveLast" TEXT,
    "activeReps" INTEGER NOT NULL DEFAULT 0,
    "activeInterval" INTEGER NOT NULL DEFAULT 0,
    "activeEase" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "activeDue" TEXT,
    "activeLast" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "frequency" INTEGER,
    "ieltsRelevant" BOOLEAN,
    "activeWorthy" BOOLEAN,
    "gradeReason" TEXT,
    "gradedAt" TIMESTAMP(3),
    "correctStreak" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "debtSince" TEXT,
    "firstSeenAt" TEXT,
    "batchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "words_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practice_batches" (
    "id" TEXT NOT NULL,
    "source" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "practice_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "self_explanations" (
    "id" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "forDate" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "verdict" TEXT,
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "self_explanations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "words_status_idx" ON "words"("status");

-- CreateIndex
CREATE INDEX "words_batchId_idx" ON "words"("batchId");

-- CreateIndex
CREATE INDEX "self_explanations_wordId_idx" ON "self_explanations"("wordId");

-- CreateIndex
CREATE INDEX "self_explanations_forDate_idx" ON "self_explanations"("forDate");
