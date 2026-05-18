-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "PbisImportRun" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rowCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "errorLog" TEXT,

    CONSTRAINT "PbisImportRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PbisClient" (
    "shipTo" TEXT NOT NULL,
    "compteClientBillTo" TEXT NOT NULL,
    "soldTo" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "customerNameShipTo" TEXT,
    "street" TEXT NOT NULL,
    "postcode" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "streetShipTo" TEXT,
    "postcodeShipTo" TEXT,
    "cityShipTo" TEXT,
    "siren" TEXT NOT NULL,
    "siret" TEXT NOT NULL,
    "vatNumber" TEXT,
    "contactFirstName" TEXT,
    "contactLastName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "vendeur" TEXT,
    "employees" INTEGER,
    "codeNaf" TEXT,
    "nafDescription" TEXT,
    "sectionDescription" TEXT,
    "plis2024" INTEGER,
    "plis2025" INTEGER,
    "flagPaperless" BOOLEAN NOT NULL DEFAULT false,
    "contractsCount" INTEGER NOT NULL DEFAULT 1,
    "totalLoyerAnnual" DOUBLE PRECISION,
    "importRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PbisClient_pkey" PRIMARY KEY ("shipTo")
);

-- CreateTable
CREATE TABLE "PbisAcceptance" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "offerCode" TEXT NOT NULL,
    "companyName" TEXT,
    "siret" TEXT,
    "vatNumber" TEXT,
    "billingStreet" TEXT,
    "billingPostcode" TEXT,
    "billingCity" TEXT,
    "contactFirstName" TEXT,
    "contactLastName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "receptionEmail" TEXT,
    "orderReference" TEXT,
    "signatoryFirstName" TEXT,
    "signatoryLastName" TEXT,
    "signatoryEmail" TEXT,
    "signatoryFunction" TEXT,
    "signatoryPower" TEXT,
    "cgvAcceptedAt" TIMESTAMP(3),
    "privacyAcceptedAt" TIMESTAMP(3),
    "yousignProcedureId" TEXT,
    "yousignStatus" TEXT,
    "signedPdfUrl" TEXT,
    "generixRedirectedAt" TIMESTAMP(3),
    "formalAgreementStatus" TEXT,
    "shopifyCustomerId" TEXT,
    "shopifyDraftOrderId" TEXT,
    "shopifyCheckoutUrl" TEXT,
    "paymentStatus" TEXT,
    "paidAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'draft',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PbisAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PbisLead" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "offerCode" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "siret" TEXT,
    "contactFirstName" TEXT NOT NULL,
    "contactLastName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "invoiceVolume" TEXT,
    "accountingSoftware" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PbisLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PbisAccessToken" (
    "token" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PbisAccessToken_pkey" PRIMARY KEY ("token")
);

-- CreateIndex
CREATE UNIQUE INDEX "PbisAcceptance_clientId_key" ON "PbisAcceptance"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "PbisAccessToken_clientId_key" ON "PbisAccessToken"("clientId");

-- AddForeignKey
ALTER TABLE "PbisClient" ADD CONSTRAINT "PbisClient_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "PbisImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PbisAcceptance" ADD CONSTRAINT "PbisAcceptance_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "PbisClient"("shipTo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PbisLead" ADD CONSTRAINT "PbisLead_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "PbisClient"("shipTo") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PbisAccessToken" ADD CONSTRAINT "PbisAccessToken_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "PbisClient"("shipTo") ON DELETE CASCADE ON UPDATE CASCADE;

