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
  rowCount: number;
  errors: string[];
  clientsWithEmail: number;
  clientsWithoutEmail: number;
}

async function importExcelWithProgress(
  buffer: ArrayBuffer,
  filename: string,
  jobId: string
): Promise<ImportResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);

  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("No worksheet found");

  const headers: Record<string, number> = {};
  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell, colNumber) => {
    const val = String(cell.value ?? "").trim();
    if (val) headers[val] = colNumber;
  });

  // Count valid rows first
  const validRows: number[] = [];
  for (let i = 2; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i);
    const idx = headers["INSTALLACCOUNTNUMBER"];
    if (!idx) continue;
    const val = row.getCell(idx).value;
    if (val !== null && val !== undefined && String(val).trim() !== "" && String(val).trim() !== "None") {
      validRows.push(i);
    }
  }

  // Update total
  const job = importJobs.get(jobId);
  if (job) job.total = validRows.length;
  console.log(`[IMPORT] ${validRows.length} rows to process`);

  const importRun = await prisma.importRun.create({
    data: { filename, rowCount: 0, status: "processing" },
  });

  const errors: string[] = [];
  let rowCount = 0;
  let clientsWithEmail = 0;
  let clientsWithoutEmail = 0;

  function get(row: ExcelJS.Row, col: string): unknown {
    const idx = headers[col];
    if (!idx) return null;
    return row.getCell(idx).value;
  }

  for (const i of validRows) {
    const row = sheet.getRow(i);
    const accountNumber = clean(get(row, "INSTALLACCOUNTNUMBER"))!;

    try {
      const billingEmail = clean(get(row, "BILLINGEMAIL"));
      const bestEmail = clean(get(row, "BESTEMAIL"));
      const installEmail = clean(get(row, "INSTALLEMAIL"));
      const email = billingEmail || bestEmail || installEmail;

      if (email) clientsWithEmail++;
      else clientsWithoutEmail++;

      const clientData = {
        sfdcAccountId: clean(get(row, "SFDCACCOUNTID")),
        customerName: clean(get(row, "SFDCCUSTOMERNAME")) ?? "Unknown",
        currentModel: clean(get(row, "CURRENTEQUIPMENTMODEL")),
        currentPcn: clean(get(row, "CURRENTEQUIPMENTPCN")),
        currentDescription: clean(get(row, "CURRENTEQUIPMENTDESCRIPTION")),
        leaseNumber: clean(get(row, "LEASENUMBER")),
        serialNumber: clean(get(row, "_SERIAL")),
        installDate: toDate(get(row, "INSTALLDATE")),
        leaseExpiryDate: toDate(get(row, "LEASEEXPIRYDATE")),
        leaseAgeing: clean(get(row, "LEASEAGEING")),
        eolPhase: clean(get(row, "EOL_PHASE")),
        currentMonthlyPayment: toFloat(get(row, "CURRENTMONTHLYPAYMENT")),
        currentEquipmentPayment: toFloat(get(row, "CURRENTEQUIPMENTPAYMENT")),
        billingFrequency: clean(get(row, "BILLING_FREQUENCY")),
        connectionType: clean(get(row, "CONNECTIONTYPE")),
        installAddress1: clean(get(row, "INSTALLADDRESS1")),
        installStreet: clean(get(row, "INSTALLSTREET")),
        installCity: clean(get(row, "INSTALLCITY")),
        installPostcode: clean(get(row, "INSTALLPOSTCODE")),
        installPhone: clean(get(row, "INSTALLPHONE")),
        installEmail,
        billingCustomerName: clean(get(row, "BILLINGCUSTOMERNAME")),
        billingAddress1: clean(get(row, "BILLINGADDRESS1")),
        billingStreet: clean(get(row, "BILLINGSTREET")),
        billingCity: clean(get(row, "BILLINGCITY")),
        billingPostcode: clean(get(row, "BILLINGPOSTCODE")),
        billingPhone: clean(get(row, "BILLINGPHONE")),
        billingEmail,
        bestEmail,
        contactFirstName: clean(get(row, "CONTACTFIRSTNAME")),
        contactLastName: clean(get(row, "CONTACTLASTNAME")),
        contactPosition: clean(get(row, "CONTACTPOSITION")),
        siret: clean(get(row, "COMPANYREGISTRATIONNUMBER")),
        vatNumber: clean(get(row, "VATREGISTRATIONNUMBER")),
        ownerName: clean(get(row, "OWNER_NAME__C")),
        ownerEmail: clean(get(row, "OWNER_EMAIL")),
        ownerTeam: clean(get(row, "OWNERTEAM")),
        ownerTerritoryCode: clean(get(row, "OWNERTERRITORYCODE")),
        badPayerFlag: toBool(get(row, "BAD PAYER FLAG")),
        regulated: toBool(get(row, "_REGULATED"), "True"),
        offerExpirationDate: clean(get(row, "OFFEREXPIRATIONDATE")),
        pieceCountLast12m: toInt(get(row, "TOTALPIECECOUNTLAST12MONTHS")),
        resetValueLast12m: toInt(get(row, "TOTALRESETVALUELAST12MONTHS")),
        importRunId: importRun.id,
      };

      await prisma.client.upsert({
        where: { accountNumber },
        create: { accountNumber, ...clientData },
        update: clientData,
      });

      await prisma.offer.deleteMany({
        where: { clientAccountNumber: accountNumber },
      });

      const offer1Code = clean(get(row, "OFFER1CODE"));
      if (offer1Code) {
        await prisma.offer.create({
          data: {
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
            emailSubjectLine: clean(get(row, "OFFER1EMAILSUBJECTLINE")),
            emailBodyMessage: clean(get(row, "OFFER1EMAILBODYMESSAGE")),
          },
        });
      }

      const offer2Code = clean(get(row, "OFFER2CODE"));
      if (offer2Code) {
        await prisma.offer.create({
          data: {
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
            emailSubjectLine: clean(get(row, "OFFER2EMAILSUBJECTLINE")),
            emailBodyMessage: clean(get(row, "OFFER2EMAILBODYMESSAGE")),
          },
        });
      }

      rowCount++;

      // Update progress every 50 rows
      if (rowCount % 50 === 0) {
        const job = importJobs.get(jobId);
        if (job) {
          job.progress = rowCount;
          job.clientsWithEmail = clientsWithEmail;
          job.clientsWithoutEmail = clientsWithoutEmail;
          job.errorCount = errors.length;
        }
        console.log(`[IMPORT] Progress: ${rowCount} / ${validRows.length}`);
      }
    } catch (err) {
      errors.push(`Row ${i} (${accountNumber}): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  await prisma.importRun.update({
    where: { id: importRun.id },
    data: {
      rowCount,
      status: errors.length > 0 ? "error" : "success",
      errorLog: errors.length > 0 ? errors.join("\n") : null,
    },
  });

  console.log(`[IMPORT] Done: ${rowCount} rows, ${errors.length} errors, ${clientsWithEmail} with email, ${clientsWithoutEmail} without`);

  return { rowCount, errors, clientsWithEmail, clientsWithoutEmail };
}

// In-memory job tracking
export interface ImportJobStatus {
  status: "processing" | "success" | "error";
  progress: number;      // rows processed
  total: number;         // total rows
  clientsWithEmail: number;
  clientsWithoutEmail: number;
  errorCount: number;
  result?: ImportResult;
}

const importJobs = new Map<string, ImportJobStatus>();

export function getImportStatus(jobId: string) {
  return importJobs.get(jobId);
}

export function startImportJob(buffer: ArrayBuffer, filename: string): string {
  const jobId = crypto.randomUUID();
  importJobs.set(jobId, {
    status: "processing",
    progress: 0,
    total: 0,
    clientsWithEmail: 0,
    clientsWithoutEmail: 0,
    errorCount: 0,
  });
  console.log(`[IMPORT] Job ${jobId} started`);

  importExcelWithProgress(buffer, filename, jobId)
    .then((result) => {
      console.log(`[IMPORT] Job ${jobId} completed`);
      importJobs.set(jobId, {
        status: result.errors.length > 0 ? "error" : "success",
        progress: result.rowCount,
        total: result.rowCount,
        clientsWithEmail: result.clientsWithEmail,
        clientsWithoutEmail: result.clientsWithoutEmail,
        errorCount: result.errors.length,
        result,
      });
    })
    .catch((err) => {
      console.error(`[IMPORT] Job ${jobId} failed:`, err);
      const current = importJobs.get(jobId);
      importJobs.set(jobId, {
        status: "error",
        progress: current?.progress ?? 0,
        total: current?.total ?? 0,
        clientsWithEmail: current?.clientsWithEmail ?? 0,
        clientsWithoutEmail: current?.clientsWithoutEmail ?? 0,
        errorCount: 1,
        result: {
          rowCount: 0,
          errors: [err instanceof Error ? err.message : String(err)],
          clientsWithEmail: 0,
          clientsWithoutEmail: 0,
        },
      });
    });

  return jobId;
}