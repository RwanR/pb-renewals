-- CreateTable
CREATE TABLE "C4CExport" (
    "id" TEXT NOT NULL,
    "exportDate" TIMESTAMP(3) NOT NULL,
    "signedFrom" TIMESTAMP(3) NOT NULL,
    "signedTo" TIMESTAMP(3) NOT NULL,
    "acceptanceCount" INTEGER NOT NULL,
    "fileData" BYTEA NOT NULL,
    "fileName" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedBy" TEXT NOT NULL,
    "emailSentTo" TEXT,
    "emailSentAt" TIMESTAMP(3),

    CONSTRAINT "C4CExport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "C4CExport_exportDate_key" ON "C4CExport"("exportDate");
