import ExcelJS from "exceljs";
import prisma from "~/db.server";

function clean(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  const s = String(val).trim().replace(/\xa0/g, " ");
  if (s === "" || s === "None") return null;
  return s;
}

function toFloat(val: unknown): number | null {
  const s = clean(val);
  if (!s) return null;
  const n = parseFloat(s.replace(",", "."));
  return isNaN(n) ? null : n;
}

function toInt(val: unknown): number | null {
  const s = clean(val);
  if (!s) return null;
  const n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}

function toBool(val: unknown, trueVal = "Yes"): boolean {
  const s = clean(val);
  return s?.toLowerCase() === trueVal.toLowerCase();
}

function toDate(val: unknown): Date | null {
  if (val instanceof Date) return val;
  const s = clean(val);
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export interface ImportResult {
  importRunId: string;
  rowCount: number;
  errors: string[];
  clientsWithEmail: number;
  clientsWithoutEmail: number;
  newClients: number;
  updatedClients: number;
}

export interface ImportJobStatus {
  status: "uploading" | "parsing" | "importing" | "success" | "error";
  message: string;
  progress: number;
  total: number;
  offersProgress: number;
  offersTotal: number;
  clientsWithEmail: number;
  clientsWithoutEmail: number;
  errorCount: number;
  result?: ImportResult;
}

const importJobs = new Map<string, ImportJobStatus>();

export function getImportStatus(jobId: string) {
  return importJobs.get(jobId);
}

function updateJob(jobId: string, update: Partial<ImportJobStatus>) {
  const job = importJobs.get(jobId);
  if (job) Object.assign(job, update);
}

export function startImportJob(buffer: ArrayBuffer, filename: string): string {
  const jobId = crypto.randomUUID();
  importJobs.set(jobId, {
    status: "parsing",
    message: "Lecture du fichier Excel...",
    progress: 0,
    total: 0,
    offersProgress: 0,
    offersTotal: 0,
    clientsWithEmail: 0,
    clientsWithoutEmail: 0,
    errorCount: 0,
  });
  console.log(`[IMPORT] Job ${jobId} started`);

  runImport(buffer, filename, jobId)
    .then((result) => {
      console.log(`[IMPORT] Job ${jobId} completed`);
      importJobs.set(jobId, {
        status: result.errors.length > 0 ? "error" : "success",
        message: result.errors.length > 0 ? "Import terminé avec erreurs" : "Import terminé",
        progress: result.rowCount,
        total: result.rowCount,
        offersProgress: 0,
        offersTotal: 0,
        clientsWithEmail: result.clientsWithEmail,
        clientsWithoutEmail: result.clientsWithoutEmail,
        errorCount: result.errors.length,
        result,
      });

      // Trigger Shopify Customer sync (async, non-blocking)
      if (result.clientsWithEmail > 0) {
        import("~/lib/shopify-admin.server")
          .then(({ syncAllCustomersToShopify }) => {
            console.log(`[SHOPIFY] Starting customer sync for import ${result.importRunId}`);
            return syncAllCustomersToShopify(result.importRunId);
          })
          .then((syncResult) => {
            console.log(`[SHOPIFY] Customer sync done: ${syncResult.synced} synced, ${syncResult.skipped} skipped, ${syncResult.errors} errors`);
          })
          .catch((err) => {
            console.error(`[SHOPIFY] Customer sync failed:`, err);
          });
      }

      // Archive customers in Shopify (async, non-blocking)
      import("~/lib/shopify-admin.server")
        .then(async ({ archiveCustomerInShopify }) => {
          const archivedClients = await prisma.client.findMany({
            where: { archived: true, shopifyCustomerId: { not: null } },
            select: { accountNumber: true, shopifyCustomerId: true },
          });
          for (const c of archivedClients) {
            await archiveCustomerInShopify(c.shopifyCustomerId!, c.accountNumber);
          }
          if (archivedClients.length > 0) {
            console.log(`[SHOPIFY] Archived ${archivedClients.length} customers`);
          }
        })
        .catch((err) => console.error(`[SHOPIFY] Archive sync failed:`, err));
    })
    .catch((err) => {
      console.error(`[IMPORT] Job ${jobId} failed:`, err);
      const current = importJobs.get(jobId);
      importJobs.set(jobId, {
        status: "error",
        message: "Erreur fatale",
        progress: current?.progress ?? 0,
        total: current?.total ?? 0,
        offersProgress: current?.offersProgress ?? 0,
        offersTotal: current?.offersTotal ?? 0,
        clientsWithEmail: current?.clientsWithEmail ?? 0,
        clientsWithoutEmail: current?.clientsWithoutEmail ?? 0,
        errorCount: 1,
        result: {
          importRunId: "",
          rowCount: 0,
          errors: [err instanceof Error ? err.message : String(err)],
          clientsWithEmail: 0,
          clientsWithoutEmail: 0,
          newClients: 0,
          updatedClients: 0,
        },
      });
    });

  return jobId;
}

async function runImport(buffer: ArrayBuffer, filename: string, jobId: string) {
  // === PHASE 1: Parse Excel ===
  updateJob(jobId, { status: "parsing", message: "Lecture du fichier Excel..." });

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);

  const sheet = workbook.getWorksheet("FR_ELEASE_FINAL") ?? workbook.worksheets.find(s => s !== undefined);
  if (!sheet) throw new Error("No worksheet found");

  const headers: Record<string, number> = {};
  sheet.getRow(1).eachCell((cell, colNumber) => {
    const val = String(cell.value ?? "").trim();
    if (val) headers[val] = colNumber;
  });

  function get(row: ExcelJS.Row, col: string): unknown {
    const idx = headers[col];
    if (!idx) return null;
    return row.getCell(idx).value;
  }

  const clients: any[] = [];
  const offers: any[] = [];
  let clientsWithEmail = 0;
  let clientsWithoutEmail = 0;

  updateJob(jobId, { message: "Analyse des lignes..." });

  for (let i = 2; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i);
    const accountNumber = clean(get(row, "INSTALLACCOUNTNUMBER"));
    if (!accountNumber) continue;

    const contactEmail = clean(get(row, "CONTACTEMAIL"));
    const email = contactEmail;

    if (email) clientsWithEmail++;
    else clientsWithoutEmail++;

    clients.push({
      accountNumber,
      sfdcAccountId: null,
      customerName: clean(get(row, "INSTALLCUSTOMERNAME")) ?? "Unknown",
      currentModel: clean(get(row, "CURRENTEQUIPMENTMODEL")),
      currentPcn: clean(get(row, "CURRENTEQUIPMENTPCN")),
      currentDescription: null,
      leaseNumber: clean(get(row, "LEASENUMBER")),
      serialNumber: clean(get(row, "_SERIAL")),
      installDate: toDate(get(row, "INSTALLDATE")),
      leaseExpiryDate: toDate(get(row, "LEASEEXPIRYDATE")),
      leaseAgeing: null,
      eolPhase: null,
      currentMonthlyPayment: toFloat(get(row, "CURRENTMONTHLYPAYMENT")),
      currentEquipmentPayment: toFloat(get(row, "CURRENTEQUIPMENTPAYMENT")),
      billingFrequency: null,
      connectionType: clean(get(row, "CONNECTIONTYPE")),
      installAddress1: clean(get(row, "INSTALLADDRESS1")),
      installStreet: clean(get(row, "INSTALLSTREET")),
      installCity: clean(get(row, "INSTALLCITY")),
      installPostcode: clean(get(row, "INSTALLPOSTALCODE")),
      installPhone: clean(get(row, "INSTALLPHONE")),
      installEmail: null,
      billingCustomerName: clean(get(row, "BILLINGCUSTOMERNAME")),
      billingAddress1: clean(get(row, "BILLINGADDRESS1")),
      billingStreet: clean(get(row, "BILLINGSTREET")),
      billingCity: clean(get(row, "BILLINGCITY")),
      billingPostcode: clean(get(row, "BILLINGPOSTALCODE")),
      billingPhone: null,
      billingEmail: null,
      bestEmail: contactEmail,
      contactFirstName: clean(get(row, "CONTACTFIRSTNAME")),
      contactLastName: clean(get(row, "CONTACTLASTNAME")),
      contactPosition: null,
      siret: clean(get(row, "INSTALLCOMPANYREGISTRATIONNUMBER")),
      vatNumber: clean(get(row, "INSTALLVAT")),
      ownerName: clean(get(row, "OWNER_NAME__C")),
      ownerEmail: clean(get(row, "OWNEREMAIL")),
      ownerTeam: clean(get(row, "OWNERTEAM")),
      ownerTerritoryCode: clean(get(row, "OWNERTERRITORYCODE")),
      badPayerFlag: false,
      regulated: false,
      offerExpirationDate: clean(get(row, "OFFEREXPIRATIONDATE")),
      soldToCustomerName: clean(get(row, "SOLDTOCUSTOMERNAME")),
      soldToCompanyRegistrationNumber: clean(get(row, "SOLDTOCOMPANYREGISTRATIONNUMBER")),
      contactPhone: clean(get(row, "CONTACTPHONE")),
      activationDate: toDate(get(row, "ACTIVATIONDATE")),
      paymentTerms: clean(get(row, "PAYMENT_TERMS")),
      pieceCountLast12m: toInt(get(row, "TOTALPIECECOUNTLAST12MONTHS")),
      resetValueLast12m: toInt(get(row, "TOTALRESETVALUELAST12MONTHS")),
    });

    // Offer 1
    const offer1Code = clean(get(row, "OFFER1CODE"));
    if (offer1Code) {
      offers.push({
        clientAccountNumber: accountNumber,
        offerPosition: 1,
        offerCode: offer1Code,
        template: clean(get(row, "OFFER1TEMPLATE")),
        recommended: toBool(get(row, "OFFER1RECOMMENDED"), "YES"),
        contractTerm: clean(get(row, "OFFER1CONTRACTTERM")),
        headline: clean(get(row, "OFFER1HEADLINE")),
        modelName: clean(get(row, "OFFER1MODEL")),
        modelPcn: clean(get(row, "OFFER1PCN")),
        modelDescription: clean(get(row, "OFFER1MODELDESCRIPTION")),
        imageUrl: clean(get(row, "OFFER1IMAGE")),
        brochureUrl: clean(get(row, "OFFER1BROCHUREPDFURL")),
        pcn2: clean(get(row, "OFFER1PCN2")),
        description2: clean(get(row, "OFFER1MODELDESCRIPTION2")),
        pcn3: clean(get(row, "OFFER1PCN3")),
        description3: clean(get(row, "OFFER1MODELDESCRIPTION3")),
        pcn4: clean(get(row, "OFFER1PCN4")),
        description4: clean(get(row, "OFFER1MODELDESCRIPTION4")),
        valueProp1: clean(get(row, "OFFER1VALUEPROP1")),
        valueProp2: clean(get(row, "OFFER1VALUEPROP2")),
        valueProp3: clean(get(row, "OFFER1VALUEPROP3")),
        marketingMessage: clean(get(row, "OFFER1MARKETINGMESSAGE")),
        benefit1: clean(get(row, "OFFER1BENEFIT1")),
        benefit2: clean(get(row, "OFFER1BENEFIT2")),
        benefit3: clean(get(row, "OFFER1BENEFIT3")),
        monthly60: toFloat(get(row, "OFFER1NEWMONTHLYPAYMENT_60")),
        billing60: toFloat(get(row, "OFFER1BILLINGPAYMENT_60")),
        billingTax60: toFloat(get(row, "OFFER1BILLINGPAYMENTTAX_60")),
        billingTotal60: toFloat(get(row, "OFFER1BILLINGPAYMENTTOTAL_60")),
        monthly48: toFloat(get(row, "OFFER1NEWMONTHLYPAYMENT_48")),
        billing48: toFloat(get(row, "OFFER1BILLINGPAYMENT_48")),
        billingTax48: toFloat(get(row, "OFFER1BILLINGPAYMENTTAX_48")),
        billingTotal48: toFloat(get(row, "OFFER1BILLINGPAYMENTTOTAL_48")),
        monthly36: toFloat(get(row, "OFFER1NEWMONTHLYPAYMENT_36")),
        billing36: toFloat(get(row, "OFFER1BILLINGPAYMENT_36")),
        billingTax36: toFloat(get(row, "OFFER1BILLINGPAYMENTTAX_36")),
        billingTotal36: toFloat(get(row, "OFFER1BILLINGPAYMENTTOTAL_36")),
        monthly24: toFloat(get(row, "OFFER1NEWMONTHLYPAYMENT_24")),
        billing24: toFloat(get(row, "OFFER1BILLINGPAYMENT_24")),
        billingTax24: toFloat(get(row, "OFFER1BILLINGPAYMENTTAX_24")),
        billingTotal24: toFloat(get(row, "OFFER1BILLINGPAYMENTTOTAL_24")),
        billingFrequency: clean(get(row, "OFFER1BILLINGFREQUENCY")),
        paymentMessage: clean(get(row, "OFFER1NEWPAYMENTMESSAGE")),
        discount: clean(get(row, "OFFER1DISCOUNT")),
        autoInk: toBool(get(row, "OFFER1AUTOINK")),
        autoInkPcn: clean(get(row, "OFFER1AUTOINKPCN")),
        autoInkDescription: clean(get(row, "OFFER1AUTOINKDESCRIPTION")),
        installAvailable: toBool(get(row, "OFFER1INSTALL")),
        installPcn: clean(get(row, "OFFER1INSTALLPCN")),
        installDescription: clean(get(row, "OFFER1INSTALLDESCRIPTION")),
        starterKit: toBool(get(row, "OFFER1STARTERKIT"), "YES"),
        starterKitPcn: clean(get(row, "OFFER1STARTERKITPCN")),
        starterKitDescription: clean(get(row, "OFFER1STARTERKITDESCRIPTION")),
        confirmationWhatsNext: clean(get(row, "OFFER1CONFIRMATIONWHATSNEXT")),
        orderReason: clean(get(row, "OFFER1ORDERREASON")),
      });
    }

    // Offer 2
    const offer2Code = clean(get(row, "OFFER2CODE"));
    if (offer2Code) {
      offers.push({
        clientAccountNumber: accountNumber,
        offerPosition: 2,
        offerCode: offer2Code,
        template: clean(get(row, "OFFER2TEMPLATE")),
        recommended: toBool(get(row, "OFFER2RECOMMENDED"), "YES"),
        contractTerm: clean(get(row, "OFFER2CONTRACTTERM")),
        headline: clean(get(row, "OFFER2HEADLINE")),
        modelName: clean(get(row, "OFFER2MODEL")),
        modelPcn: clean(get(row, "OFFER2PCN")),
        modelDescription: clean(get(row, "OFFER2MODELDESCRIPTION")),
        imageUrl: clean(get(row, "OFFER2IMAGE")),
        brochureUrl: clean(get(row, "OFFER2BROCHUREPDFURL")),
        pcn2: clean(get(row, "OFFER2PCN2")),
        description2: clean(get(row, "OFFER2MODELDESCRIPTION2")),
        pcn3: clean(get(row, "OFFER2PCN3")),
        description3: clean(get(row, "OFFER2MODELDESCRIPTION3")),
        pcn4: clean(get(row, "OFFER2PCN4")),
        description4: clean(get(row, "OFFER2MODELDESCRIPTION4")),
        valueProp1: clean(get(row, "OFFER2VALUEPROP1")),
        valueProp2: clean(get(row, "OFFER2VALUEPROP2")),
        valueProp3: clean(get(row, "OFFER2VALUEPROP3")),
        marketingMessage: clean(get(row, "OFFER2MARKETINGMESSAGE")),
        benefit1: clean(get(row, "OFFER2BENEFIT1")),
        benefit2: clean(get(row, "OFFER2BENEFIT2")),
        benefit3: clean(get(row, "OFFER2BENEFIT3")),
        monthly60: toFloat(get(row, "OFFER2NEWMONTHLYPAYMENT_60")),
        billing60: toFloat(get(row, "OFFER2BILLINGPAYMENT_60")),
        billingTax60: toFloat(get(row, "OFFER2BILLINGPAYMENTTAX_60")),
        billingTotal60: toFloat(get(row, "OFFER2BILLINGPAYMENTTOTAL_60")),
        monthly48: toFloat(get(row, "OFFER2NEWMONTHLYPAYMENT_48")),
        billing48: toFloat(get(row, "OFFER2BILLINGPAYMENT_48")),
        billingTax48: toFloat(get(row, "OFFER2BILLINGPAYMENTTAX_48")),
        billingTotal48: toFloat(get(row, "OFFER2BILLINGPAYMENTTOTAL_48")),
        monthly36: toFloat(get(row, "OFFER2NEWMONTHLYPAYMENT_36")),
        billing36: toFloat(get(row, "OFFER2BILLINGPAYMENT_36")),
        billingTax36: toFloat(get(row, "OFFER2BILLINGPAYMENTTAX_36")),
        billingTotal36: toFloat(get(row, "OFFER2BILLINGPAYMENTTOTAL_36")),
        monthly24: toFloat(get(row, "OFFER2NEWMONTHLYPAYMENT_24")),
        billing24: toFloat(get(row, "OFFER2BILLINGPAYMENT_24")),
        billingTax24: toFloat(get(row, "OFFER2BILLINGPAYMENTTAX_24")),
        billingTotal24: toFloat(get(row, "OFFER2BILLINGPAYMENTTOTAL_24")),
        billingFrequency: clean(get(row, "OFFER2BILLINGFREQUENCY")),
        paymentMessage: clean(get(row, "OFFER2NEWPAYMENTMESSAGE")),
        discount: clean(get(row, "OFFER2DISCOUNT")),
        autoInk: toBool(get(row, "OFFER2AUTOINK")),
        autoInkPcn: clean(get(row, "OFFER2AUTOINKPCN")),
        autoInkDescription: clean(get(row, "OFFER2AUTOINKDESCRIPTION")),
        installAvailable: toBool(get(row, "OFFER2INSTALL")),
        installPcn: clean(get(row, "OFFER2INSTALLPCN")),
        installDescription: clean(get(row, "OFFER2INSTALLDESCRIPTION")),
        starterKit: toBool(get(row, "OFFER2STARTERKIT"), "YES"),
        starterKitPcn: clean(get(row, "OFFER2STARTERKITPCN")),
        starterKitDescription: clean(get(row, "OFFER2STARTERKITDESCRIPTION")),
        confirmationWhatsNext: clean(get(row, "OFFER2CONFIRMATIONWHATSNEXT")),
        orderReason: clean(get(row, "OFFER2ORDERREASON")),
      });
    }
  }

// NOUVEAU
  console.log(`[IMPORT] Parsed ${clients.length} clients, ${offers.length} offers`);

  // Ensure Shopify products exist for all model+term pairs
  try {
    const { ensureShopifyProducts } = await import("~/lib/shopify-admin.server");
    const productPairs = offers.map((o) => ({
      modelName: o.modelName,
      term: (o.monthly60 ?? o.billing60) ? "60" : (o.monthly48 ?? o.billing48) ? "48" : (o.monthly36 ?? o.billing36) ? "36" : "24",
    }));
    const productResult = await ensureShopifyProducts(productPairs);
    console.log(`[IMPORT] Shopify products: ${productResult.created} created, ${productResult.existing} existing, ${productResult.errors.length} errors`);
  } catch (err) {
    console.error(`[IMPORT] Shopify product sync failed (non-blocking):`, err);
  }

  updateJob(jobId, {
    status: "importing",
    message: `${clients.length} clients analysés. Écriture en base...`,
    total: clients.length,
    offersTotal: offers.length,
    clientsWithEmail,
    clientsWithoutEmail,
  });

  // === PHASE 2: Create import run ===
  const importRun = await prisma.importRun.create({
    data: { filename, rowCount: 0, status: "processing" },
  });

  // === PHASE 3: Upsert clients, replace offers, preserve tokens/acceptances ===
  const errors: string[] = [];
  let newClients = 0;
  let updatedClients = 0;

  try {
    // --- Upsert clients one by one ---
    updateJob(jobId, { message: "Import des clients..." });
    for (let i = 0; i < clients.length; i++) {
      const c = clients[i];
      const { accountNumber, ...clientData } = c;
      try {
        const existing = await prisma.client.findUnique({
          where: { accountNumber },
          select: { accountNumber: true, shopifyCustomerId: true },
        });

        if (existing) {
          // Update — preserve shopifyCustomerId
          await prisma.client.update({
            where: { accountNumber },
            data: { ...clientData, importRunId: importRun.id },
          });
          updatedClients++;
        } else {
          // Create
          await prisma.client.create({
            data: { accountNumber, ...clientData, importRunId: importRun.id },
          });
          newClients++;
        }
      } catch (err) {
        const msg = `Client ${accountNumber}: ${err instanceof Error ? err.message : String(err)}`;
        console.error(`[IMPORT] ${msg}`);
        errors.push(msg);
      }

      if ((i + 1) % 50 === 0 || i === clients.length - 1) {
        updateJob(jobId, {
          progress: i + 1,
          message: `Import des clients... ${i + 1} / ${clients.length}`,
        });
        console.log(`[IMPORT] Clients: ${i + 1} / ${clients.length} (${newClients} new, ${updatedClients} updated)`);
      }
    }

    // --- Replace offers for all clients in the file ---
    // Only delete offers for clients that are in this import (not all offers globally)
    updateJob(jobId, { message: "Mise à jour des offres..." });
    const accountNumbers = clients.map((c) => c.accountNumber);
    await prisma.offer.deleteMany({
      where: { clientAccountNumber: { in: accountNumbers } },
    });
    console.log(`[IMPORT] Deleted offers for ${accountNumbers.length} clients`);

    // Insert new offers in chunks
    const CHUNK = 500;
    for (let i = 0; i < offers.length; i += CHUNK) {
      const chunk = offers.slice(i, i + CHUNK);
      await prisma.offer.createMany({ data: chunk });

      const progress = Math.min(i + CHUNK, offers.length);
      updateJob(jobId, {
        offersProgress: progress,
        message: `Import des offres... ${progress} / ${offers.length}`,
      });
      console.log(`[IMPORT] Offers: ${progress} / ${offers.length}`);
    }

    // --- Tokens: create only for clients that don't have one yet ---
    updateJob(jobId, { message: "Génération des liens d'accès..." });
    const tokenExpiry = new Date();
    tokenExpiry.setDate(tokenExpiry.getDate() + 90);

    const clientsNeedingTokens = clients.filter((c) => c.bestEmail);
    const existingTokens = await prisma.accessToken.findMany({
      where: { clientAccountNumber: { in: clientsNeedingTokens.map((c) => c.accountNumber) } },
      select: { clientAccountNumber: true },
    });
    const hasToken = new Set(existingTokens.map((t) => t.clientAccountNumber));

    const newTokenData = clientsNeedingTokens
      .filter((c) => !hasToken.has(c.accountNumber))
      .map((c) => ({
        clientAccountNumber: c.accountNumber,
        expiresAt: tokenExpiry,
      }));

    if (newTokenData.length > 0) {
      for (let i = 0; i < newTokenData.length; i += CHUNK) {
        const chunk = newTokenData.slice(i, i + CHUNK);
        await prisma.accessToken.createMany({ data: chunk });
      }
      console.log(`[IMPORT] Generated ${newTokenData.length} new access tokens (${hasToken.size} existing preserved)`);
    } else {
      console.log(`[IMPORT] All ${hasToken.size} clients already have tokens — none created`);
    }

  } catch (err) {
    console.error(`[IMPORT] Import failed:`, err);
    errors.push(err instanceof Error ? err.message : String(err));
  }

  // --- Archive clients not in this import ---
  updateJob(jobId, { message: "Archivage des clients obsolètes..." });
  const archiveResult = await prisma.client.updateMany({
    where: {
      importRunId: { not: importRun.id },
      archived: false,
    },
    data: { archived: true },
  });
  if (archiveResult.count > 0) {
    console.log(`[IMPORT] Archived ${archiveResult.count} clients not in current import`);
  }

  // Unarchive clients that are back in the file
  await prisma.client.updateMany({
    where: {
      importRunId: importRun.id,
      archived: true,
    },
    data: { archived: false },
  });

  // === PHASE 4: Finalize ===
  await prisma.importRun.update({
    where: { id: importRun.id },
    data: {
      rowCount: clients.length,
      status: errors.length > 0 ? "error" : "success",
      errorLog: errors.length > 0 ? errors.join("\n") : null,
    },
  });

  const result: ImportResult = {
    importRunId: importRun.id,
    rowCount: clients.length,
    errors,
    clientsWithEmail,
    clientsWithoutEmail,
    newClients,
    updatedClients,
  };

  console.log(`[IMPORT] Done: ${clients.length} clients (${newClients} new, ${updatedClients} updated), ${offers.length} offers, ${errors.length} errors`);

  return result;
}