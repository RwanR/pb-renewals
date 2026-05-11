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
    "id" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "siret" TEXT,
    "vatNumber" TEXT,
    "address1" TEXT,
    "address2" TEXT,
    "city" TEXT,
    "postcode" TEXT,
    "contactFirstName" TEXT,
    "contactLastName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "contactPosition" TEXT,
    "ownerName" TEXT,
    "ownerEmail" TEXT,
    "importRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PbisClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PbisAcceptance" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "offerCode" TEXT NOT NULL,
    "signatoryFirstName" TEXT NOT NULL,
    "signatoryLastName" TEXT NOT NULL,
    "signatoryEmail" TEXT NOT NULL,
    "signatoryFunction" TEXT,
    "signatoryPower" TEXT,
    "cgvAcceptedAt" TIMESTAMP(3),
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
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signedAt" TIMESTAMP(3),

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
CREATE UNIQUE INDEX "PbisClient_accountNumber_key" ON "PbisClient"("accountNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PbisAccessToken_clientId_key" ON "PbisAccessToken"("clientId");

-- AddForeignKey
ALTER TABLE "PbisClient" ADD CONSTRAINT "PbisClient_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "PbisImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PbisAcceptance" ADD CONSTRAINT "PbisAcceptance_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "PbisClient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PbisLead" ADD CONSTRAINT "PbisLead_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "PbisClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PbisAccessToken" ADD CONSTRAINT "PbisAccessToken_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "PbisClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
