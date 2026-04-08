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
async function shopifyGraphQL(query: string, variables: Record<string, any> = {}): Promise<any> {
  const { shop, accessToken } = await getOfflineSession();
  const url = `https://${shop}/admin/api/${API_VERSION}/graphql.json`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[SHOPIFY] GraphQL error ${res.status}: ${text}`);
  }

  const json = await res.json();

  if (json.errors) {
    console.error("[SHOPIFY] GraphQL errors:", JSON.stringify(json.errors));
    throw new Error(`[SHOPIFY] GraphQL errors: ${json.errors.map((e: any) => e.message).join(", ")}`);
  }

  return json.data;
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
  const CHUNK_SIZE = 10; // Process in batches to respect rate limits

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
      await new Promise((r) => setTimeout(r, 500));
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
export async function createDraftOrder(data: DraftOrderData): Promise<string | null> {
  const { accountNumber, shopifyCustomerId, modelName, term, billingAnnualHT, installOption, installPrice, signatoryName } = data;

  try {
    const lineItems: any[] = [];

    // Main line item — equipment rental
    const variantId = VARIANT_MAP[modelName]?.[term];

    if (variantId) {
      // Use variant with price override
      lineItems.push({
        variantId,
        quantity: 1,
        appliedDiscount: {
          title: "Tarif client",
          valueType: "FIXED_AMOUNT",
          value: 0, // Will be set properly with the variant's price vs client price
        },
      });
    } else {
      // No variant mapping — use custom line item
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
      shippingAddress: undefined, // Will be filled from customer
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