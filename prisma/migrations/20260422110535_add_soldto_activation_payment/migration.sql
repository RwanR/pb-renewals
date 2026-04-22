-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "activationDate" TIMESTAMP(3),
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "paymentTerms" TEXT,
ADD COLUMN     "soldToCompanyRegistrationNumber" TEXT,
ADD COLUMN     "soldToCustomerName" TEXT;

-- AlterTable
ALTER TABLE "Offer" ADD COLUMN     "orderReason" TEXT;
