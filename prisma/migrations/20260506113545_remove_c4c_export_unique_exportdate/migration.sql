-- DropIndex
DROP INDEX "C4CExport_exportDate_key";

-- CreateIndex
CREATE INDEX "C4CExport_exportDate_idx" ON "C4CExport"("exportDate");
