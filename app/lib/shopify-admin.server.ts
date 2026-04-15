/**
 * Shopify Admin API — standalone client (outside iframe context)
 * 
 * Reads the offline session token from Prisma Session table
 * Uses GraphQL Admin API for:
 * - Customer creation at import
 * - Draft Order creation at signature
 */

import prisma from "~/db.server";

const API_VERSION = "2025-01";

interface ShopifySession {
  shop: string;
  accessToken: string;
}

/**
 * Get the offline Shopify session from DB
 */
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

/**
 * Execute a Shopify Admin GraphQL query
 */
// NOUVEAU
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

/**
 * Create or update a Shopify Customer for a PB client
 * Returns the Shopify Customer GID
 */
export async function syncCustomerToShopify(data: CustomerData): Promise<string | null> {
  const { accountNumber, email } = data;
  
  if (!email) {
    console.log(`[SHOPIFY] Skipping customer ${accountNumber} — no email`);
    return null;
  }

  try {
    // Check if customer already exists
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
    const firstName = data.firstName || nameParts[0] || "Client";
    const lastName = data.lastName || nameParts.slice(1).join(" ") || accountNumber;

    const input: any = {
      email,
      firstName,
      lastName,
      phone: data.phone || undefined,
      tags: ["pb-renewals", `account-${accountNumber}`],
      metafields,
    };

    if (data.address1 || data.city) {
      input.addresses = [{
        address1: data.address1 || "",
        address2: data.address2 || "",
        city: data.city || "",
        zip: data.zip || "",
        country: data.country || "FR",
      }];
    }

    if (existingCustomer) {
      // Update
      input.id = existingCustomer.id;
      const result = await shopifyGraphQL(CUSTOMER_UPDATE_MUTATION, { input });
      if (result.customerUpdate?.userErrors?.length) {
        console.error(`[SHOPIFY] Customer update errors for ${accountNumber}:`, result.customerUpdate.userErrors);
        return existingCustomer.id;
      }
      console.log(`[SHOPIFY] Updated customer ${accountNumber}: ${existingCustomer.id}`);
      return existingCustomer.id;
    } else {
      // Create
      const result = await shopifyGraphQL(CUSTOMER_CREATE_MUTATION, { input });
      if (result.customerCreate?.userErrors?.length) {
        console.error(`[SHOPIFY] Customer create errors for ${accountNumber}:`, result.customerCreate.userErrors);
        return null;
      }
      const customerId = result.customerCreate?.customer?.id;
      console.log(`[SHOPIFY] Created customer ${accountNumber}: ${customerId}`);
      return customerId;
    }
  } catch (err) {
    console.error(`[SHOPIFY] Failed to sync customer ${accountNumber}:`, err);
    return null;
  }
}

/**
 * Sync all clients with emails to Shopify (async, in chunks)
 * Called after Excel import
 */
export async function syncAllCustomersToShopify(importRunId: string): Promise<{ synced: number; skipped: number; errors: number }> {
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
    },
  });

  console.log(`[SHOPIFY] Starting sync of ${clients.length} clients to Shopify`);

  let synced = 0;
  let skipped = 0;
  let errors = 0;
  const CHUNK_SIZE = 3;

  for (let i = 0; i < clients.length; i += CHUNK_SIZE) {
    const chunk = clients.slice(i, i + CHUNK_SIZE);

    await Promise.all(chunk.map(async (client) => {
      const email = client.bestEmail || client.installEmail || client.billingEmail;
      if (!email) {
        skipped++;
        return;
      }

      const customerId = await syncCustomerToShopify({
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

      if (customerId) {
        await prisma.client.update({
          where: { accountNumber: client.accountNumber },
          data: { shopifyCustomerId: customerId },
        });
        synced++;
      } else {
        errors++;
      }
    }));

    // Small delay between chunks for rate limiting
    if (i + CHUNK_SIZE < clients.length) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  console.log(`[SHOPIFY] Sync complete: ${synced} synced, ${skipped} skipped (no email), ${errors} errors`);
  return { synced, skipped, errors };
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

// Variant IDs must be created manually in Shopify — map by model + term
// These will be set after products are created in the store
const VARIANT_MAP: Record<string, Record<string, string>> = {
  // "SendPro C": { "60": "gid://shopify/ProductVariant/XXX", "48": "gid://shopify/ProductVariant/XXX" },
  // "SendPro C Lite": { "60": "...", "48": "..." },
  // "DM400": { "60": "...", "48": "..." },
  // "DM50/55": { "60": "...", "48": "..." },
};

/**
 * Create a Draft Order in Shopify after contract signature
 */
/**
 * Create a Draft Order in Shopify after contract signature
 */
export async function createDraftOrder(data: DraftOrderData): Promise<string | null> {
  const { accountNumber, shopifyCustomerId, modelName, term, billingAnnualHT, installOption, installPrice, signatoryName } = data;

  try {
    const lineItems: any[] = [];

    // Main line item — equipment rental (lookup variant from DB)
    const variantId = await getVariantId(modelName, term);

    if (variantId) {
      lineItems.push({
        variantId,
        quantity: 1,
        appliedDiscount: {
          title: "Tarif client",
          valueType: "FIXED_AMOUNT",
          value: 0,
          description: `Loyer mensuel HT: ${billingAnnualHT}€`,
        },
      });
    } else {
      lineItems.push({
        title: `${modelName} — Location ${term} mois`,
        quantity: 1,
        originalUnitPrice: String(billingAnnualHT),
      });
    }

    // Installation line item (if selected and not free)
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
      tags: ["pb-renewals", `account-${accountNumber}`, `term-${term}m`],
      note: `Contrat PB Renewals — ${accountNumber}\nSignataire: ${signatoryName}\nDurée: ${term} mois\nInstallation: ${installOption || "aucune"}`,
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

/**
 * Create all PB Renewals metafield definitions on the Customer resource (one-time setup)
 */
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

/**
 * Update Customer metafields after contract signature
 */
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

/**
 * Update Customer info when client modifies email/phone/address
 */
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
    if (phone) input.phone = phone;
    if (address1 || city) {
      input.addresses = [{ address1: address1 || "", address2: address2 || "", city: city || "", zip: zip || "", country: "FR" }];
    }

    const result = await shopifyGraphQL(CUSTOMER_UPDATE_METAFIELDS, { input });
    if (result.customerUpdate?.userErrors?.length) {
      console.error(`[SHOPIFY] Customer info update errors:`, result.customerUpdate.userErrors);
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
  mutation productCreate($input: ProductInput!) {
    productCreate(input: $input) {
      product {
        id
        title
        variants(first: 5) {
          edges { node { id title } }
        }
      }
      userErrors { field message }
    }
  }
`;

/**
 * Ensure Shopify products exist for all model+term pairs found in offers.
 * Called during import, after parsing.
 * Creates products if missing, stores variant IDs in ShopifyProduct table.
 */
export async function ensureShopifyProducts(offers: Array<{ modelName: string | null; term: string }>): Promise<{ created: number; existing: number; errors: string[] }> {
  // Collect unique model+term pairs
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
      // Check if already in DB
      const exists = await prisma.shopifyProduct.findUnique({
        where: { modelName_term: { modelName, term } },
      });

      if (exists) {
        existing++;
        continue;
      }

      // Create product in Shopify
      const result = await shopifyGraphQL(PRODUCT_CREATE_MUTATION, {
        input: {
          title: `${modelName} — Location ${term} mois`,
          productType: "Location maintenance",
          vendor: "Pitney Bowes",
          tags: ["pb-renewals", `term-${term}m`],
          variants: [{
            title: `${term} mois`,
            price: "0.00",
            requiresShipping: false,
            taxable: true,
          }],
        },
      });

      if (result.productCreate?.userErrors?.length) {
        const errMsg = result.productCreate.userErrors.map((e: any) => e.message).join(", ");
        errors.push(`${modelName} ${term}m: ${errMsg}`);
        console.error(`[SHOPIFY] Product create error for ${modelName} ${term}m:`, errMsg);
        continue;
      }

      const product = result.productCreate?.product;
      const variantId = product?.variants?.edges?.[0]?.node?.id;

      if (!product?.id || !variantId) {
        errors.push(`${modelName} ${term}m: no product/variant ID returned`);
        continue;
      }

      // Store in DB
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

/**
 * Get variant ID for a model+term pair from DB
 */
export async function getVariantId(modelName: string, term: string): Promise<string | null> {
  const product = await prisma.shopifyProduct.findUnique({
    where: { modelName_term: { modelName, term } },
    select: { shopifyVariantId: true },
  });
  return product?.shopifyVariantId ?? null;
}

/**
 * Update Customer metafields after signature
 */
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