-- CreateTable
CREATE TABLE "Refusal" (
    "id" TEXT NOT NULL,
    "clientAccountNumber" TEXT NOT NULL,
    "reason" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Refusal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Refusal_clientAccountNumber_key" ON "Refusal"("clientAccountNumber");

-- AddForeignKey
ALTER TABLE "Refusal" ADD CONSTRAINT "Refusal_clientAccountNumber_fkey" FOREIGN KEY ("clientAccountNumber") REFERENCES "Client"("accountNumber") ON DELETE RESTRICT ON UPDATE CASCADE;
