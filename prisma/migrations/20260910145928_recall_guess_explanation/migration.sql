/*
  Warnings:

  - You are about to drop the column `text` on the `self_explanations` table. All the data in the column will be lost.
  - Added the required column `explanation` to the `self_explanations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `guess` to the `self_explanations` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "self_explanations" DROP COLUMN "text",
ADD COLUMN     "explanation" TEXT NOT NULL,
ADD COLUMN     "guess" TEXT NOT NULL;
