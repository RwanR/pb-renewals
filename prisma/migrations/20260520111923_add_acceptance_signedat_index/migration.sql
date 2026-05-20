-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "emailReceptionFacture" TEXT;

-- CreateIndex
CREATE INDEX "Acceptance_signedAt_adobeSignStatus_idx" ON "Acceptance"("signedAt", "adobeSignStatus");
