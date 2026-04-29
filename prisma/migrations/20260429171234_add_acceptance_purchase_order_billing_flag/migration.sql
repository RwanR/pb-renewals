-- AlterTable
ALTER TABLE "Acceptance" ADD COLUMN     "billingAddressDifferent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "purchaseOrderNumber" TEXT;
