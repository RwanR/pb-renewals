/**
 * Shopify Admin API — standalone client (outside iframe context)
 *
 * Reads the offline session token from Prisma Session table
 * Uses GraphQL Admin API for:
 * - Customer creation at import
 * - Draft Order creation at signature
 */

import prisma from "~/db.server";

const API_VERSION = "2026-04";

// Shopify field limits (defensive truncation to avoid customerCreate errors)
const NAME_MAX = 255;
const ADDRESS_MAX = 255;
const ZIP_MAX = 50;
const TAG_MAX = 40;

const WARNING_PHONE_OMITTED = "Phone omitted (duplicate)";

interface ShopifySession {
  shop: string;
  accessToken: string;
}

// ─── HELPERS ───────────────────────────────────────────────────────

function truncate(s: string | null | undefined, max: number): string | undefined {
  if (!s) return undefined;
  const trimmed = s.trim();
  if (!trimmed) return undefined;
  return trimmed.length > max ? trimmed.slice(0, max).trim() : trimmed;
}

/**
 * Sanitize phone for Shopify Admin API.
 * Shopify accepts E.164 and tolerant national formats (e.g. "01 60 92 41 44").
 * We strip junk chars and require at least 5 digits, else return undefined.
 */
function sanitizePhone(phone: string | null | undefined): string | undefined {
  if (!phone) return undefined;
  const cleaned = phone.replace(/[^\d+\s().\-]/g, "").trim();
  const digits = cleaned.replace(/\D/g, "");
  if (digits.length < 5) return undefined;
  return cleaned;
}

function truncateTag(tag: string): string {
  return tag.length > TAG_MAX ? tag.slice(0, TAG_MAX) : tag;
}

function hasFieldError(
  userErrors: any[],
  field: string,
  messageRegex: RegExp
): boolean {
  return userErrors?.some(
    (e: any) =>
      Array.isArray(e.field) &&
      e.field.includes(field) &&
      messageRegex.test(e.message || "")
  );
}

const isPhoneDuplicateError = (errs: any[]) =>
  hasFieldError(errs, "phone", /already been taken/i);

const isEmailDuplicateError = (errs: any[]) =>
  hasFieldError(errs, "email", /already been taken/i);

function summarizeErrors(userErrors: any[]): string {
  if (!userErrors?.length) return "Unknown error";
  return userErrors
    .map(
      (e: any) =>
        `${Array.isArray(e.field) ? e.field.join(".") : e.field || "?"}: ${e.message}`
    )
    .join(" | ");
}

// ─── SESSION ───────────────────────────────────────────────────────

async function getOfflineSession(): Promise<ShopifySession> {
  const session = await prisma.session.findFirst({
    where: { isOnline: false, accessToken: { not: null } },
    select: { shop: true, accessToken: true },
  });

  if (!session?.accessToken) {
    throw new Error("[SHOPIFY] No offline session found. Install the app on the store first.");
  }

  return { shop: session.shop, accessToken: session.accessToken };
}

async function shopifyGraphQL(query: string, variables: Record<string, any> = {}, retries = 3): Promise<any> {
  const { shop, accessToken } = await getOfflineSession();
  const url = `https://${shop}/admin/api/${API_VERSION}/graphql.json`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (res.status === 429 || res.status === 503) {
      const delay = Math.pow(2, attempt) * 1000;
      console.warn(`[SHOPIFY] Rate limited (${res.status}), retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`);
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`[SHOPIFY] GraphQL error ${res.status}: ${text}`);
    }

    const json = await res.json();

    if (json.errors) {
      const isTransient = json.errors.some((e: any) => e.extensions?.code === "UNAVAILABLE" || e.extensions?.code === "THROTTLED");
      if (isTransient && attempt < retries) {
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`[SHOPIFY] Transient error, retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      console.error("[SHOPIFY] GraphQL errors:", JSON.stringify(json.errors));
      throw new Error(`[SHOPIFY] GraphQL errors: ${json.errors.map((e: any) => e.message).join(", ")}`);
    }

    return json.data;
  }

  throw new Error("[SHOPIFY] Max retries exceeded");
}

// ─── CUSTOMER CREATION ─────────────────────────────────────────────

const CUSTOMER_CREATE_MUTATION = `
  mutation customerCreate($input: CustomerInput!) {
    customerCreate(input: $input) {
      customer {
        id
        email
        firstName
        lastName
        metafields(first: 5) {
          edges { node { namespace key value } }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const CUSTOMER_UPDATE_MUTATION = `
  mutation customerUpdate($input: CustomerInput!) {
    customerUpdate(input: $input) {
      customer { id }
      userErrors { field message }
    }
  }
`;

const CUSTOMER_SEARCH_QUERY = `
  query customerSearch($query: String!) {
    customers(first: 1, query: $query) {
      edges {
        node {
          id
          email
        }
      }
    }
  }
`;

interface CustomerData {
  accountNumber: string;
  customerName: string;
  email: string;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  zip?: string | null;
  country?: string;
  currentModel?: string | null;
  leaseNumber?: string | null;
  currentPayment?: number | null;
}

export type SyncErrorType =
  | "no_email"
  | "email_duplicate"
  | "phone_duplicate"
  | "validation"
  | "transport"
  | "other";

export interface SyncResult {
  customerId: string | null;
  error: string | null;
  errorType: SyncErrorType | null;
  warning: string | null;
}

/**
 * Create or update a Shopify Customer for a PB client.
 *
 * Error handling:
 * - "Phone has already been taken" → retry without phone (customer created, phone dropped → WARNING)
 * - "Email has already been taken" → skip, return error (email is required to retrieve customer later)
 * - Other validation errors → skip, return error
 *
 * Field guards:
 * - firstName/lastName truncated to 255 chars
 * - address1/address2/city truncated to 255 chars
 * - zip truncated to 50 chars
 * - phone sanitized (junk chars stripped, must have ≥5 digits)
 * - tags truncated to 40 chars each
 */
export async function syncCustomerToShopify(data: CustomerData): Promise<SyncResult> {
  const { accountNumber, email } = data;

  if (!email) {
    return { customerId: null, error: "No email", errorType: "no_email", warning: null };
  }

  try {
    // Check if customer already exists by email (exact match search)
    const searchResult = await shopifyGraphQL(CUSTOMER_SEARCH_QUERY, {
      query: `email:${email}`,
    });

    const existingCustomer = searchResult.customers?.edges?.[0]?.node;

    const metafields = [
      { namespace: "pb_renewals", key: "account_number", value: accountNumber, type: "single_line_text_field" },
      ...(data.leaseNumber ? [{ namespace: "pb_renewals", key: "lease_number", value: data.leaseNumber, type: "single_line_text_field" }] : []),
      ...(data.currentModel ? [{ namespace: "pb_renewals", key: "current_model", value: data.currentModel, type: "single_line_text_field" }] : []),
      ...(data.currentPayment ? [{ namespace: "pb_renewals", key: "current_payment", value: String(data.currentPayment), type: "number_decimal" }] : []),
    ];

    const nameParts = data.customerName?.split(" ") || [];
    const firstName = truncate(data.firstName || nameParts[0] || "Client", NAME_MAX)!;
    const lastName = truncate(data.lastName || nameParts.slice(1).join(" ") || accountNumber, NAME_MAX)!;
    const phone = sanitizePhone(data.phone);

    const baseInput: any = {
      email,
      firstName,
      lastName,
      tags: [truncateTag("pb-renewals"), truncateTag(`account-${accountNumber}`)],
      metafields,
    };

    if (phone) baseInput.phone = phone;

    if (data.address1 || data.city) {
      baseInput.addresses = [{
        address1: truncate(data.address1, ADDRESS_MAX) || "",
        address2: truncate(data.address2, ADDRESS_MAX) || "",
        city: truncate(data.city, ADDRESS_MAX) || "",
        zip: truncate(data.zip, ZIP_MAX) || "",
        country: data.country || "FR",
      }];
    }

    // ─── UPDATE PATH ────────────────────────────────────────
    if (existingCustomer) {
      const input = { ...baseInput, id: existingCustomer.id };
      let result = await shopifyGraphQL(CUSTOMER_UPDATE_MUTATION, { input });
      let userErrors = result.customerUpdate?.userErrors || [];
      let warning: string | null = null;

      // Retry without phone if duplicate
      if (userErrors.length > 0 && isPhoneDuplicateError(userErrors)) {
        console.warn(`[SHOPIFY] Phone duplicate on update for ${accountNumber}, retrying without phone`);
        const { phone: _omit, ...inputNoPhone } = input;
        result = await shopifyGraphQL(CUSTOMER_UPDATE_MUTATION, { input: inputNoPhone });
        userErrors = result.customerUpdate?.userErrors || [];
        if (userErrors.length === 0) {
          warning = WARNING_PHONE_OMITTED;
        }
      }

      if (userErrors.length > 0) {
        const msg = summarizeErrors(userErrors);
        console.error(`[SHOPIFY] Customer update errors for ${accountNumber}: ${msg}`);
        return { customerId: existingCustomer.id, error: msg, errorType: "validation", warning: null };
      }

      console.log(`[SHOPIFY] Updated customer ${accountNumber}: ${existingCustomer.id}${warning ? " (phone omitted)" : ""}`);
      return { customerId: existingCustomer.id, error: null, errorType: null, warning };
    }

    // ─── CREATE PATH ────────────────────────────────────────
    let result = await shopifyGraphQL(CUSTOMER_CREATE_MUTATION, { input: baseInput });
    let userErrors = result.customerCreate?.userErrors || [];

    // Retry without phone if duplicate
    if (userErrors.length > 0 && isPhoneDuplicateError(userErrors)) {
      console.warn(`[SHOPIFY] Phone duplicate on create for ${accountNumber}, retrying without phone`);
      const { phone: _omit, ...inputNoPhone } = baseInput;
      result = await shopifyGraphQL(CUSTOMER_CREATE_MUTATION, { input: inputNoPhone });
      userErrors = result.customerCreate?.userErrors || [];

      if (userErrors.length === 0) {
        const customerId = result.customerCreate?.customer?.id;
        console.log(`[SHOPIFY] Created customer ${accountNumber}: ${customerId} (without phone, duplicate)`);
        return { customerId, error: null, errorType: null, warning: WARNING_PHONE_OMITTED };
      }
    }

    if (userErrors.length > 0) {
      const msg = summarizeErrors(userErrors);
      console.error(`[SHOPIFY] Customer create errors for ${accountNumber}: ${msg}`);
      const errorType: SyncErrorType = isEmailDuplicateError(userErrors)
        ? "email_duplicate"
        : "validation";
      return { customerId: null, error: msg, errorType, warning: null };
    }

    const customerId = result.customerCreate?.customer?.id;
    console.log(`[SHOPIFY] Created customer ${accountNumber}: ${customerId}`);
    return { customerId, error: null, errorType: null, warning: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[SHOPIFY] Failed to sync customer ${accountNumber}:`, msg);
    return { customerId: null, error: msg, errorType: "transport", warning: null };
  }
}

export interface SyncReport {
  synced: number;
  skipped: number;
  errors: number;
  warnings: number;
  errorDetails: Array<{
    accountNumber: string;
    customerName: string | null;
    email: string | null;
    error: string;
    errorType: SyncErrorType;
  }>;
  warningDetails: Array<{
    accountNumber: string;
    customerName: string | null;
    email: string | null;
    warning: string;
  }>;
}

/**
 * Sync all clients with emails to Shopify (async, in chunks).
 * Persists per-client error/warning in Client.shopifySyncError / Client.shopifySyncWarning.
 */
export async function syncAllCustomersToShopify(importRunId: string): Promise<SyncReport> {
  const clients = await prisma.client.findMany({
    where: {
      importRunId,
      bestEmail: { not: null },
    },
    select: {
      accountNumber: true,
      customerName: true,
      bestEmail: true,
      installEmail: true,
      billingEmail: true,
      installPhone: true,
      contactFirstName: true,
      contactLastName: true,
      installAddress1: true,
      installStreet: true,
      installCity: true,
      installPostcode: true,
      currentModel: true,
      leaseNumber: true,
      currentEquipmentPayment: true,
      shopifyCustomerId: true,
      shopifySyncHash: true,
    },
  });

  console.log(`[SHOPIFY] Starting sync of ${clients.length} clients to Shopify`);

  let synced = 0;
  let skipped = 0;
  let errors = 0;
  let warnings = 0;
  const errorDetails: SyncReport["errorDetails"] = [];
  const warningDetails: SyncReport["warningDetails"] = [];
  const CHUNK_SIZE = 3;

  for (let i = 0; i < clients.length; i += CHUNK_SIZE) {
    const chunk = clients.slice(i, i + CHUNK_SIZE);

    await Promise.all(chunk.map(async (client) => {
      const email = client.bestEmail || client.installEmail || client.billingEmail;
      if (!email) {
        skipped++;
        return;
      }

      const hashSource = [
        client.customerName,
        email,
        client.installPhone,
        client.contactFirstName,
        client.contactLastName,
        client.installAddress1,
        client.installStreet,
        client.installCity,
        client.installPostcode,
        client.currentModel,
        client.leaseNumber,
        client.currentEquipmentPayment,
      ].join("|");

      const hash = Buffer.from(hashSource).toString("base64");

      if (client.shopifyCustomerId && client.shopifySyncHash === hash) {
        skipped++;
        return;
      }

      const result = await syncCustomerToShopify({
        accountNumber: client.accountNumber,
        customerName: client.customerName,
        email,
        phone: client.installPhone,
        firstName: client.contactFirstName,
        lastName: client.contactLastName,
        address1: client.installAddress1,
        address2: client.installStreet,
        city: client.installCity,
        zip: client.installPostcode,
        currentModel: client.currentModel,
        leaseNumber: client.leaseNumber,
        currentPayment: client.currentEquipmentPayment,
      });

      if (result.customerId) {
        await prisma.client.update({
          where: { accountNumber: client.accountNumber },
          data: {
            shopifyCustomerId: result.customerId,
            shopifySyncHash: hash,
            shopifySyncError: null,
            shopifySyncWarning: result.warning,
          },
        });
        synced++;
        if (result.warning) {
          warnings++;
          warningDetails.push({
            accountNumber: client.accountNumber,
            customerName: client.customerName,
            email,
            warning: result.warning,
          });
        }
      } else {
        await prisma.client.update({
          where: { accountNumber: client.accountNumber },
          data: {
            shopifySyncError: result.error,
            shopifySyncWarning: null,
          },
        });
        errors++;
        errorDetails.push({
          accountNumber: client.accountNumber,
          customerName: client.customerName,
          email,
          error: result.error || "Unknown",
          errorType: result.errorType || "other",
        });
      }
    }));

    if (i + CHUNK_SIZE < clients.length) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  console.log(`[SHOPIFY] Sync complete: ${synced} synced (${warnings} with warning), ${skipped} skipped (no change), ${errors} errors`);
  if (errors > 0) {
    const byType: Record<string, number> = {};
    for (const e of errorDetails) byType[e.errorType] = (byType[e.errorType] || 0) + 1;
    console.log(`[SHOPIFY] Error breakdown:`, byType);
    for (const e of errorDetails) {
      console.log(`[SHOPIFY] Error: ${e.accountNumber} (${e.errorType}) — ${e.error}`);
    }
  }
  if (warnings > 0) {
    for (const w of warningDetails) {
      console.log(`[SHOPIFY] Warning: ${w.accountNumber} — ${w.warning}`);
    }
  }

  return { synced, skipped, errors, warnings, errorDetails, warningDetails };
}

// ─── DRAFT ORDER CREATION ──────────────────────────────────────────

const DRAFT_ORDER_CREATE_MUTATION = `
  mutation draftOrderCreate($input: DraftOrderInput!) {
    draftOrderCreate(input: $input) {
      draftOrder {
        id
        name
        totalPrice
        status
      }
      userErrors {
        field
        message
      }
    }
  }
`;

interface DraftOrderData {
  accountNumber: string;
  shopifyCustomerId: string;
  modelName: string;
  term: string; // "60" or "48"
  billingAnnualHT: number;
  installOption?: string | null;
  installPrice?: number;
  signatoryName: string;
}

/**
 * Create a Draft Order in Shopify after contract signature
 */
export async function createDraftOrder(data: DraftOrderData): Promise<string | null> {
  const { accountNumber, shopifyCustomerId, modelName, term, billingAnnualHT, installOption, installPrice, signatoryName } = data;

  try {
    const lineItems: any[] = [];

    const variantId = await getVariantId(modelName, term);

    if (variantId) {
      lineItems.push({
        variantId,
        quantity: 1,
        priceOverride: {
          amount: String(billingAnnualHT),
          currencyCode: "EUR",
        },
      });
    } else {
      lineItems.push({
        title: `${modelName} — Location ${term} mois`,
        quantity: 1,
        originalUnitPrice: String(billingAnnualHT),
      });
    }

    if (installOption && installPrice && installPrice > 0) {
      const installLabels: Record<string, string> = {
        phone: "Installation assistée en ligne",
        onsite: "Installation sur site par un technicien",
      };
      lineItems.push({
        title: installLabels[installOption] || "Installation",
        quantity: 1,
        originalUnitPrice: String(installPrice),
        taxable: true,
      });
    }

    const input: any = {
      customerId: shopifyCustomerId,
      lineItems,
      tags: [truncateTag("pb-renewals"), truncateTag(`account-${accountNumber}`), truncateTag(`term-${term}m`)],
      note: `Contrat PB Renewals — ${accountNumber}\nSignataire: ${signatoryName}\nDurée: ${term} mois\nInstallation: ${installOption || "aucune"}`.slice(0, 5000),
      shippingAddress: undefined,
    };

    const result = await shopifyGraphQL(DRAFT_ORDER_CREATE_MUTATION, { input });

    if (result.draftOrderCreate?.userErrors?.length) {
      console.error(`[SHOPIFY] Draft order errors for ${accountNumber}:`, result.draftOrderCreate.userErrors);
      return null;
    }

    const draftOrderId = result.draftOrderCreate?.draftOrder?.id;
    const draftOrderName = result.draftOrderCreate?.draftOrder?.name;
    console.log(`[SHOPIFY] Created draft order ${draftOrderName} for ${accountNumber}: ${draftOrderId}`);

    return draftOrderId;
  } catch (err) {
    console.error(`[SHOPIFY] Failed to create draft order for ${accountNumber}:`, err);
    return null;
  }
}

// ─── METAFIELD DEFINITIONS ────────────────────────────────────────

const METAFIELD_DEFINITION_CREATE = `
  mutation metafieldDefinitionCreate($definition: MetafieldDefinitionInput!) {
    metafieldDefinitionCreate(definition: $definition) {
      createdDefinition { id name namespace key }
      userErrors { field message }
    }
  }
`;

const METAFIELD_DEFINITIONS = [
  { name: "N° de compte", namespace: "pb_renewals", key: "account_number", type: "single_line_text_field" },
  { name: "N° de contrat", namespace: "pb_renewals", key: "lease_number", type: "single_line_text_field" },
  { name: "Machine actuelle", namespace: "pb_renewals", key: "current_model", type: "single_line_text_field" },
  { name: "Loyer annuel HT", namespace: "pb_renewals", key: "current_payment", type: "number_decimal" },
  { name: "Statut", namespace: "pb_renewals", key: "status", type: "single_line_text_field" },
  { name: "Offre choisie", namespace: "pb_renewals", key: "offer_selected", type: "single_line_text_field" },
  { name: "Durée", namespace: "pb_renewals", key: "term_selected", type: "single_line_text_field" },
  { name: "Installation", namespace: "pb_renewals", key: "install_option", type: "single_line_text_field" },
  { name: "Signataire", namespace: "pb_renewals", key: "signatory_name", type: "single_line_text_field" },
  { name: "Date signature", namespace: "pb_renewals", key: "signed_at", type: "single_line_text_field" },
];

export async function createMetafieldDefinitions(): Promise<{ created: number; errors: string[] }> {
  let created = 0;
  const errors: string[] = [];

  for (const def of METAFIELD_DEFINITIONS) {
    try {
      const result = await shopifyGraphQL(METAFIELD_DEFINITION_CREATE, {
        definition: {
          name: def.name,
          namespace: def.namespace,
          key: def.key,
          type: def.type,
          ownerType: "CUSTOMER",
          pin: true,
        },
      });

      if (result.metafieldDefinitionCreate?.userErrors?.length) {
        const errMsg = result.metafieldDefinitionCreate.userErrors.map((e: any) => e.message).join(", ");
        if (errMsg.includes("already exists")) {
          console.log(`[SHOPIFY] Metafield definition ${def.namespace}.${def.key} already exists`);
        } else {
          errors.push(`${def.key}: ${errMsg}`);
          console.error(`[SHOPIFY] Metafield definition error for ${def.key}:`, errMsg);
        }
      } else {
        created++;
        console.log(`[SHOPIFY] Created metafield definition: ${def.namespace}.${def.key}`);
      }
    } catch (err) {
      errors.push(`${def.key}: ${err}`);
    }
  }

  console.log(`[SHOPIFY] Metafield definitions: ${created} created, ${errors.length} errors`);
  return { created, errors };
}

// ─── CUSTOMER UPDATE (after signature) ─────────────────────────────

const CUSTOMER_UPDATE_METAFIELDS = `
  mutation customerUpdate($input: CustomerInput!) {
    customerUpdate(input: $input) {
      customer { id }
      userErrors { field message }
    }
  }
`;

export async function updateCustomerAfterSignature(params: {
  shopifyCustomerId: string;
  accountNumber: string;
  offerSelected: string;
  termSelected: string;
  installOption: string;
  signatoryName: string;
  signedAt: Date;
}): Promise<void> {
  const { shopifyCustomerId, accountNumber, offerSelected, termSelected, installOption, signatoryName, signedAt } = params;

  try {
    const result = await shopifyGraphQL(CUSTOMER_UPDATE_METAFIELDS, {
      input: {
        id: shopifyCustomerId,
        metafields: [
          { namespace: "pb_renewals", key: "status", value: "signed", type: "single_line_text_field" },
          { namespace: "pb_renewals", key: "offer_selected", value: offerSelected, type: "single_line_text_field" },
          { namespace: "pb_renewals", key: "term_selected", value: termSelected, type: "single_line_text_field" },
          { namespace: "pb_renewals", key: "install_option", value: installOption || "aucune", type: "single_line_text_field" },
          { namespace: "pb_renewals", key: "signatory_name", value: signatoryName, type: "single_line_text_field" },
          { namespace: "pb_renewals", key: "signed_at", value: signedAt.toISOString(), type: "single_line_text_field" },
        ],
      },
    });

    if (result.customerUpdate?.userErrors?.length) {
      console.error(`[SHOPIFY] Customer metafield update errors for ${accountNumber}:`, result.customerUpdate.userErrors);
    } else {
      console.log(`[SHOPIFY] Updated customer metafields for ${accountNumber} (status=signed)`);
    }
  } catch (err) {
    console.error(`[SHOPIFY] Failed to update customer metafields for ${accountNumber}:`, err);
  }
}

export async function updateCustomerInfo(params: {
  shopifyCustomerId: string;
  email?: string;
  phone?: string;
  address1?: string;
  address2?: string;
  city?: string;
  zip?: string;
}): Promise<void> {
  const { shopifyCustomerId, email, phone, address1, address2, city, zip } = params;

  try {
    const input: any = { id: shopifyCustomerId };
    if (email) input.email = email;
    const cleanPhone = sanitizePhone(phone);
    if (cleanPhone) input.phone = cleanPhone;
    if (address1 || city) {
      input.addresses = [{
        address1: truncate(address1, ADDRESS_MAX) || "",
        address2: truncate(address2, ADDRESS_MAX) || "",
        city: truncate(city, ADDRESS_MAX) || "",
        zip: truncate(zip, ZIP_MAX) || "",
        country: "FR",
      }];
    }

    let result = await shopifyGraphQL(CUSTOMER_UPDATE_METAFIELDS, { input });
    let userErrors = result.customerUpdate?.userErrors || [];

    // Retry without phone if duplicate
    if (userErrors.length > 0 && isPhoneDuplicateError(userErrors)) {
      console.warn(`[SHOPIFY] Phone duplicate on updateCustomerInfo, retrying without phone`);
      const { phone: _omit, ...inputNoPhone } = input;
      result = await shopifyGraphQL(CUSTOMER_UPDATE_METAFIELDS, { input: inputNoPhone });
      userErrors = result.customerUpdate?.userErrors || [];
    }

    if (userErrors.length > 0) {
      console.error(`[SHOPIFY] Customer info update errors:`, userErrors);
    } else {
      console.log(`[SHOPIFY] Updated customer info for ${shopifyCustomerId}`);
    }
  } catch (err) {
    console.error(`[SHOPIFY] Failed to update customer info:`, err);
  }
}

// ─── CUSTOMER METAFIELDS UPDATE ────────────────────────────────────

const CUSTOMER_METAFIELDS_SET_MUTATION = `
  mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { id namespace key value }
      userErrors { field message }
    }
  }
`;

// ─── PRODUCT CREATION (auto at import) ─────────────────────────────

const PRODUCT_CREATE_MUTATION = `
  mutation productCreate($product: ProductCreateInput!) {
    productCreate(product: $product) {
      product {
        id
        title
        variants(first: 1) {
          edges { node { id title } }
        }
      }
      userErrors { field message }
    }
  }
`;

const PRODUCT_VARIANT_BULK_UPDATE_MUTATION = `
  mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
    productVariantsBulkUpdate(productId: $productId, variants: $variants) {
      productVariants { id title }
      userErrors { field message }
    }
  }
`;

export async function ensureShopifyProducts(offers: Array<{ modelName: string | null; term: string }>): Promise<{ created: number; existing: number; errors: string[] }> {
  const pairs = new Map<string, { modelName: string; term: string }>();
  for (const offer of offers) {
    if (!offer.modelName) continue;
    const key = `${offer.modelName}__${offer.term}`;
    if (!pairs.has(key)) {
      pairs.set(key, { modelName: offer.modelName, term: offer.term });
    }
  }

  let created = 0;
  let existing = 0;
  const errors: string[] = [];

  for (const [, { modelName, term }] of pairs) {
    try {
      const exists = await prisma.shopifyProduct.findUnique({
        where: { modelName_term: { modelName, term } },
      });

      if (exists) {
        existing++;
        continue;
      }

      const result = await shopifyGraphQL(PRODUCT_CREATE_MUTATION, {
        product: {
          title: `${modelName} — Location ${term} mois`,
          productType: "Location maintenance",
          vendor: "Pitney Bowes",
          tags: [truncateTag("pb-renewals"), truncateTag(`term-${term}m`)],
        },
      });

      if (result.productCreate?.userErrors?.length) {
        const errMsg = result.productCreate.userErrors.map((e: any) => e.message).join(", ");
        errors.push(`${modelName} ${term}m: ${errMsg}`);
        console.error(`[SHOPIFY] Product create error for ${modelName} ${term}m:`, errMsg);
        continue;
      }

      const product = result.productCreate?.product;
      const defaultVariantId = product?.variants?.edges?.[0]?.node?.id;

      if (!product?.id || !defaultVariantId) {
        errors.push(`${modelName} ${term}m: no product/variant ID returned`);
        continue;
      }

      await shopifyGraphQL(PRODUCT_VARIANT_BULK_UPDATE_MUTATION, {
        productId: product.id,
        variants: [{ id: defaultVariantId, price: 0 }],
      });

      const variantId = defaultVariantId;

      await prisma.shopifyProduct.create({
        data: {
          modelName,
          term,
          shopifyProductId: product.id,
          shopifyVariantId: variantId,
        },
      });

      created++;
      console.log(`[SHOPIFY] Created product "${modelName} — ${term} mois": ${product.id}, variant: ${variantId}`);
    } catch (err) {
      const msg = `${modelName} ${term}m: ${err instanceof Error ? err.message : String(err)}`;
      errors.push(msg);
      console.error(`[SHOPIFY] Failed to create product:`, msg);
    }
  }

  console.log(`[SHOPIFY] Products: ${created} created, ${existing} already existed, ${errors.length} errors`);
  return { created, existing, errors };
}

export async function getVariantId(modelName: string, term: string): Promise<string | null> {
  const product = await prisma.shopifyProduct.findUnique({
    where: { modelName_term: { modelName, term } },
    select: { shopifyVariantId: true },
  });
  return product?.shopifyVariantId ?? null;
}

export async function updateCustomerSignatureMetafields(params: {
  shopifyCustomerId: string;
  offerSelected: string;
  termSelected: string;
  installOption: string | null;
  signatoryName: string;
  signedAt: Date;
}): Promise<boolean> {
  const { shopifyCustomerId, offerSelected, termSelected, installOption, signatoryName, signedAt } = params;

  try {
    const metafields = [
      { ownerId: shopifyCustomerId, namespace: "pb_renewals", key: "status", value: "signed", type: "single_line_text_field" },
      { ownerId: shopifyCustomerId, namespace: "pb_renewals", key: "offer_selected", value: offerSelected, type: "single_line_text_field" },
      { ownerId: shopifyCustomerId, namespace: "pb_renewals", key: "term_selected", value: termSelected, type: "single_line_text_field" },
      { ownerId: shopifyCustomerId, namespace: "pb_renewals", key: "signatory_name", value: signatoryName, type: "single_line_text_field" },
      { ownerId: shopifyCustomerId, namespace: "pb_renewals", key: "signed_at", value: signedAt.toISOString(), type: "single_line_text_field" },
    ];

    if (installOption) {
      metafields.push({ ownerId: shopifyCustomerId, namespace: "pb_renewals", key: "install_option", value: installOption, type: "single_line_text_field" });
    }

    const result = await shopifyGraphQL(CUSTOMER_METAFIELDS_SET_MUTATION, { metafields });

    if (result.metafieldsSet?.userErrors?.length) {
      console.error(`[SHOPIFY] Metafields update errors:`, result.metafieldsSet.userErrors);
      return false;
    }

    console.log(`[SHOPIFY] Updated signature metafields for ${shopifyCustomerId}`);
    return true;
  } catch (err) {
    console.error(`[SHOPIFY] Failed to update metafields:`, err);
    return false;
  }
}

export async function archiveCustomerInShopify(shopifyCustomerId: string, accountNumber: string): Promise<void> {
  try {
    await shopifyGraphQL(CUSTOMER_UPDATE_METAFIELDS, {
      input: {
        id: shopifyCustomerId,
        tags: [truncateTag("pb-renewals"), truncateTag(`account-${accountNumber}`), truncateTag("archived")],
        metafields: [
          { namespace: "pb_renewals", key: "status", value: "archived", type: "single_line_text_field" },
        ],
      },
    });
    console.log(`[SHOPIFY] Archived customer ${accountNumber}`);
  } catch (err) {
    console.error(`[SHOPIFY] Failed to archive customer ${accountNumber}:`, err);
  }
}