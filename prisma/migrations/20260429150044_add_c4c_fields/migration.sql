-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "billingAccountNumberC4C" TEXT,
ADD COLUMN     "categoryContract" TEXT,
ADD COLUMN     "contactId" TEXT,
ADD COLUMN     "currentFlammes" INTEGER,
ADD COLUMN     "echuEchoir" TEXT,
ADD COLUMN     "indexationMaterial" TEXT,
ADD COLUMN     "installAccountNumberC4C" TEXT,
ADD COLUMN     "noteContract" TEXT,
ADD COLUMN     "offerContract" TEXT,
ADD COLUMN     "ownerId" TEXT,
ADD COLUMN     "payerAccountNumberC4C" TEXT,
ADD COLUMN     "paymentMethod" TEXT,
ADD COLUMN     "pcnFlammes" TEXT,
ADD COLUMN     "salesGroup" TEXT,
ADD COLUMN     "salesOffice" TEXT,
ADD COLUMN     "soldToAccountNumberC4C" TEXT;

-- AlterTable
ALTER TABLE "Offer" ADD COLUMN     "descriptionContract" TEXT;
