-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportRun" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rowCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "errorLog" TEXT,

    CONSTRAINT "ImportRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "accountNumber" TEXT NOT NULL,
    "sfdcAccountId" TEXT,
    "customerName" TEXT NOT NULL,
    "currentModel" TEXT,
    "currentPcn" TEXT,
    "currentDescription" TEXT,
    "leaseNumber" TEXT,
    "serialNumber" TEXT,
    "installDate" TIMESTAMP(3),
    "leaseExpiryDate" TIMESTAMP(3),
    "leaseAgeing" TEXT,
    "eolPhase" TEXT,
    "currentMonthlyPayment" DOUBLE PRECISION,
    "currentEquipmentPayment" DOUBLE PRECISION,
    "billingFrequency" TEXT,
    "connectionType" TEXT,
    "installAddress1" TEXT,
    "installStreet" TEXT,
    "installCity" TEXT,
    "installPostcode" TEXT,
    "installPhone" TEXT,
    "installEmail" TEXT,
    "billingCustomerName" TEXT,
    "billingAddress1" TEXT,
    "billingStreet" TEXT,
    "billingCity" TEXT,
    "billingPostcode" TEXT,
    "billingPhone" TEXT,
    "billingEmail" TEXT,
    "bestEmail" TEXT,
    "contactFirstName" TEXT,
    "contactLastName" TEXT,
    "contactPosition" TEXT,
    "siret" TEXT,
    "vatNumber" TEXT,
    "ownerName" TEXT,
    "ownerEmail" TEXT,
    "ownerTeam" TEXT,
    "ownerTerritoryCode" TEXT,
    "badPayerFlag" BOOLEAN NOT NULL DEFAULT false,
    "regulated" BOOLEAN NOT NULL DEFAULT false,
    "offerExpirationDate" TEXT,
    "pieceCountLast12m" INTEGER,
    "resetValueLast12m" INTEGER,
    "shopifyCustomerId" TEXT,
    "importRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("accountNumber")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "clientAccountNumber" TEXT NOT NULL,
    "offerPosition" INTEGER NOT NULL,
    "offerCode" TEXT,
    "template" TEXT,
    "recommended" BOOLEAN NOT NULL DEFAULT false,
    "contractTerm" TEXT,
    "headline" TEXT,
    "modelName" TEXT,
    "modelPcn" TEXT,
    "modelDescription" TEXT,
    "imageUrl" TEXT,
    "brochureUrl" TEXT,
    "pcn2" TEXT,
    "description2" TEXT,
    "pcn3" TEXT,
    "description3" TEXT,
    "pcn4" TEXT,
    "description4" TEXT,
    "valueProp1" TEXT,
    "valueProp2" TEXT,
    "valueProp3" TEXT,
    "marketingMessage" TEXT,
    "benefit1" TEXT,
    "benefit2" TEXT,
    "benefit3" TEXT,
    "monthly60" DOUBLE PRECISION,
    "billing60" DOUBLE PRECISION,
    "billingTax60" DOUBLE PRECISION,
    "billingTotal60" DOUBLE PRECISION,
    "monthly48" DOUBLE PRECISION,
    "billing48" DOUBLE PRECISION,
    "billingTax48" DOUBLE PRECISION,
    "billingTotal48" DOUBLE PRECISION,
    "monthly36" DOUBLE PRECISION,
    "billing36" DOUBLE PRECISION,
    "billingTax36" DOUBLE PRECISION,
    "billingTotal36" DOUBLE PRECISION,
    "monthly24" DOUBLE PRECISION,
    "billing24" DOUBLE PRECISION,
    "billingTax24" DOUBLE PRECISION,
    "billingTotal24" DOUBLE PRECISION,
    "billingFrequency" TEXT,
    "paymentMessage" TEXT,
    "autoInk" BOOLEAN NOT NULL DEFAULT false,
    "autoInkPcn" TEXT,
    "autoInkDescription" TEXT,
    "installAvailable" BOOLEAN NOT NULL DEFAULT false,
    "installPcn" TEXT,
    "installDescription" TEXT,
    "starterKit" BOOLEAN NOT NULL DEFAULT false,
    "starterKitPcn" TEXT,
    "starterKitDescription" TEXT,
    "confirmationWhatsNext" TEXT,
    "emailSubjectLine" TEXT,
    "emailBodyMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Acceptance" (
    "id" TEXT NOT NULL,
    "clientAccountNumber" TEXT NOT NULL,
    "offerPosition" INTEGER NOT NULL,
    "termSelected" TEXT,
    "installOptionSelected" TEXT,
    "autoInkSelected" BOOLEAN NOT NULL DEFAULT false,
    "signatoryFirstName" TEXT NOT NULL,
    "signatoryLastName" TEXT NOT NULL,
    "signatoryEmail" TEXT NOT NULL,
    "signatoryFunction" TEXT,
    "signatoryPhone" TEXT,
    "overrideEmail" TEXT,
    "overridePhone" TEXT,
    "overrideAddress" TEXT,
    "notes" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "adobeSignAgreementId" TEXT,
    "adobeSignStatus" TEXT,
    "signedPdfUrl" TEXT,
    "shopifyCustomerId" TEXT,
    "shopifyDraftOrderId" TEXT,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signedAt" TIMESTAMP(3),
    "emailSentAt" TIMESTAMP(3),
    "shopifySyncedAt" TIMESTAMP(3),

    CONSTRAINT "Acceptance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessToken" (
    "token" TEXT NOT NULL,
    "clientAccountNumber" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessToken_pkey" PRIMARY KEY ("token")
);

-- CreateTable
CREATE TABLE "ShopifyAuth" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopifyAuth_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Offer_clientAccountNumber_offerPosition_key" ON "Offer"("clientAccountNumber", "offerPosition");

-- CreateIndex
CREATE UNIQUE INDEX "Acceptance_clientAccountNumber_key" ON "Acceptance"("clientAccountNumber");

-- CreateIndex
CREATE UNIQUE INDEX "AccessToken_clientAccountNumber_key" ON "AccessToken"("clientAccountNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyAuth_shop_key" ON "ShopifyAuth"("shop");

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_clientAccountNumber_fkey" FOREIGN KEY ("clientAccountNumber") REFERENCES "Client"("accountNumber") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Acceptance" ADD CONSTRAINT "Acceptance_clientAccountNumber_fkey" FOREIGN KEY ("clientAccountNumber") REFERENCES "Client"("accountNumber") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessToken" ADD CONSTRAINT "AccessToken_clientAccountNumber_fkey" FOREIGN KEY ("clientAccountNumber") REFERENCES "Client"("accountNumber") ON DELETE CASCADE ON UPDATE CASCADE;
