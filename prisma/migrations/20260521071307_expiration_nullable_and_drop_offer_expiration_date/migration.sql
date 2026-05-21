/*
  Warnings:

  - You are about to drop the column `offerExpirationDate` on the `Client` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "AccessToken" ALTER COLUMN "expiresAt" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Client" DROP COLUMN "offerExpirationDate";
