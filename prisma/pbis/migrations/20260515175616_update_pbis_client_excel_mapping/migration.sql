/*
  Warnings:

  - The primary key for the `PbisClient` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `accountNumber` on the `PbisClient` table. All the data in the column will be lost.
  - You are about to drop the column `address1` on the `PbisClient` table. All the data in the column will be lost.
  - You are about to drop the column `address2` on the `PbisClient` table. All the data in the column will be lost.
  - You are about to drop the column `contactPosition` on the `PbisClient` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `PbisClient` table. All the data in the column will be lost.
  - You are about to drop the column `ownerEmail` on the `PbisClient` table. All the data in the column will be lost.
  - You are about to drop the column `ownerName` on the `PbisClient` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[clientId]` on the table `PbisAcceptance` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `compteClientBillTo` to the `PbisClient` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shipTo` to the `PbisClient` table without a default value. This is not possible if the table is not empty.
  - Added the required column `siren` to the `PbisClient` table without a default value. This is not possible if the table is not empty.
  - Added the required column `soldTo` to the `PbisClient` table without a default value. This is not possible if the table is not empty.
  - Added the required column `street` to the `PbisClient` table without a default value. This is not possible if the table is not empty.
  - Made the column `siret` on table `PbisClient` required. This step will fail if there are existing NULL values in that column.
  - Made the column `city` on table `PbisClient` required. This step will fail if there are existing NULL values in that column.
  - Made the column `postcode` on table `PbisClient` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "PbisAcceptance" DROP CONSTRAINT "PbisAcceptance_clientId_fkey";

-- DropForeignKey
ALTER TABLE "PbisAccessToken" DROP CONSTRAINT "PbisAccessToken_clientId_fkey";

-- DropForeignKey
ALTER TABLE "PbisLead" DROP CONSTRAINT "PbisLead_clientId_fkey";

-- DropIndex
DROP INDEX "PbisClient_accountNumber_key";

-- AlterTable
ALTER TABLE "PbisClient" DROP CONSTRAINT "PbisClient_pkey",
DROP COLUMN "accountNumber",
DROP COLUMN "address1",
DROP COLUMN "address2",
DROP COLUMN "contactPosition",
DROP COLUMN "id",
DROP COLUMN "ownerEmail",
DROP COLUMN "ownerName",
ADD COLUMN     "cityShipTo" TEXT,
ADD COLUMN     "codeNaf" TEXT,
ADD COLUMN     "compteClientBillTo" TEXT NOT NULL,
ADD COLUMN     "contractsCount" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "customerNameShipTo" TEXT,
ADD COLUMN     "employees" INTEGER,
ADD COLUMN     "flagPaperless" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nafDescription" TEXT,
ADD COLUMN     "plis2024" INTEGER,
ADD COLUMN     "plis2025" INTEGER,
ADD COLUMN     "postcodeShipTo" TEXT,
ADD COLUMN     "sectionDescription" TEXT,
ADD COLUMN     "shipTo" TEXT NOT NULL,
ADD COLUMN     "siren" TEXT NOT NULL,
ADD COLUMN     "soldTo" TEXT NOT NULL,
ADD COLUMN     "street" TEXT NOT NULL,
ADD COLUMN     "streetShipTo" TEXT,
ADD COLUMN     "totalLoyerAnnual" DOUBLE PRECISION,
ADD COLUMN     "vendeur" TEXT,
ALTER COLUMN "siret" SET NOT NULL,
ALTER COLUMN "city" SET NOT NULL,
ALTER COLUMN "postcode" SET NOT NULL,
ADD CONSTRAINT "PbisClient_pkey" PRIMARY KEY ("shipTo");

-- CreateIndex
CREATE UNIQUE INDEX "PbisAcceptance_clientId_key" ON "PbisAcceptance"("clientId");

-- AddForeignKey
ALTER TABLE "PbisAcceptance" ADD CONSTRAINT "PbisAcceptance_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "PbisClient"("shipTo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PbisLead" ADD CONSTRAINT "PbisLead_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "PbisClient"("shipTo") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PbisAccessToken" ADD CONSTRAINT "PbisAccessToken_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "PbisClient"("shipTo") ON DELETE CASCADE ON UPDATE CASCADE;
