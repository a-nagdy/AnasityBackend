import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const PAYMOB_API_BASE_URL = "https://accept.paymob.com/v1";
const PAYMOB_SECRET_KEY = process.env.PAYMOB_SECRET_KEY;
const PAYMOB_PUBLIC_KEY = process.env.PAYMOB_PUBLIC_KEY;

console.log(
  "API Key first 10 chars:",
  PAYMOB_SECRET_KEY?.substring(0, 10) + "..."
);
console.log("Public Key:", PAYMOB_PUBLIC_KEY);
/**
 * Standardizes payment status from various Paymob status values
 * @param {string} paymobStatus - Status from Paymob
 * @returns {string} - Standardized status
 */
const standardizePaymentStatus = (paymobStatus) => {
  // Convert to lowercase for consistent comparison
  const status = (paymobStatus || "").toLowerCase();

  // Map Paymob statuses to our standard statuses
  if (status === "success" || status === "paid" || status === "captured") {
    return "confirmed";
  } else if (status === "pending" || status === "unpaid") {
    return "pending";
  } else if (status === "voided" || status === "refunded") {
    return "refunded";
  } else if (status === "declined" || status === "failed") {
    return "failed";
  }

  // Default case - just pass through
  return status;
};

/**
 * Formats billing data from our address format to Paymob format
 * @param {Object} addressData - Our system's address data
 * @returns {Object} - Formatted billing data for Paymob
 */
const formatBillingData = (addressData) => {
  return {
    apartment: addressData.apartment || addressData.address2 || "NA",
    first_name:
      addressData.firstName || addressData.name?.split(" ")[0] || "NA",
    last_name:
      addressData.lastName ||
      addressData.name?.split(" ").slice(1).join(" ") ||
      "NA",
    street: addressData.street || addressData.address || "NA",
    building: addressData.building || "NA",
    phone_number: addressData.phoneNumber || addressData.phone || "NA",
    city: addressData.city || "NA",
    country: addressData.country || "EG",
    email: addressData.email || "customer@example.com",
    floor: addressData.floor || "NA",
    state: addressData.state || "NA",
  };
};

/**
 * Creates a payment intention with Paymob
 * @param {Object} orderData - The order data
 * @param {number} orderData.amount - The order amount in cents
 * @param {Object} orderData.billingData - Customer billing information
 * @param {Array} orderData.items - Order items
 * @param {string} orderData.currency - Currency code (default: EGP)
 * @param {Array} orderData.paymentMethods - Array of payment method IDs or names
 * @returns {Promise<Object>} The payment intention response
 */
export const createPaymentIntention = async (orderData) => {
  try {
    // Format billing data to ensure required fields
    const billingData = formatBillingData(orderData.billingData);

    // Format items
    const items = orderData.items.map((item) => ({
      name: item.name,
      amount: item.price, // Should be in cents
      description: item.description || item.name,
      quantity: item.quantity,
    }));

    // Add shipping and tax as separate items if provided
    if (orderData.shipping && orderData.shipping > 0) {
      items.push({
        name: "Shipping Fee",
        amount: orderData.shipping,
        description: "Shipping and handling fee",
        quantity: 1,
      });
    }

    if (orderData.tax && orderData.tax > 0) {
      items.push({
        name: "Tax",
        amount: orderData.tax,
        description: "Tax amount",
        quantity: 1,
      });
    }

    // Calculate total from items to ensure they match
    const calculatedTotal = items.reduce(
      (sum, item) => sum + item.amount * item.quantity,
      0
    );

    // If provided amount doesn't match calculated total, use calculated total
    const finalAmount =
      orderData.amount === calculatedTotal ? orderData.amount : calculatedTotal;

    console.log("Request URL:", `${PAYMOB_API_BASE_URL}/intention/`);

    // Create customer object as shown in the example
    const customer = {
      first_name: billingData.first_name,
      last_name: billingData.last_name,
      email: billingData.email,
      extras: {
        orderId: orderData.orderId,
        userId: orderData.userId,
      },
    };

    // Create request payload matching the exact structure in the documentation
    const requestPayload = {
      amount: finalAmount,
      currency: orderData.currency || "EGP",
      payment_methods: [orderData.integration_id], // Integration ID as a number
      items,
      billing_data: billingData,
      customer,
      extras: {
        orderId: orderData.orderId,
        userId: orderData.userId,
      },
    };

    console.log("Request data:", requestPayload);

    const response = await axios.post(
      `${PAYMOB_API_BASE_URL}/intention/`,
      requestPayload,
      {
        headers: {
          Authorization: `Token ${PAYMOB_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error("Paymob API Error:", error.response?.data || error.message);
    console.error("Full error:", JSON.stringify(error, null, 2));

    if (error.request) {
      console.log("Request headers sent:", error.request._header);
    }

    // Enhanced error handling with more details
    const errorData = {
      message:
        error.response?.data?.detail ||
        error.message ||
        "Unknown Paymob API Error",
      status: error.response?.status,
      data: error.response?.data,
    };

    throw errorData;
  }
};

/**
 * Generates a checkout URL for redirecting customers to Paymob's payment page
 * @param {string} clientSecret - Client secret from payment intention
 * @returns {string} The checkout URL
 */
export const generateCheckoutUrl = (clientSecret) => {
  if (!PAYMOB_PUBLIC_KEY) {
    console.warn("PAYMOB_PUBLIC_KEY is not set in environment variables!");
  }
  return `https://accept.paymob.com/unifiedcheckout/?publicKey=${PAYMOB_PUBLIC_KEY}&clientSecret=${clientSecret}`;
};

/**
 * Process payment callback from Paymob
 * @param {Object} callbackData - The callback data from Paymob
 * @returns {Object} Processed payment result
 */
export const processPaymentCallback = (callbackData) => {
  // Verify callback data integrity
  if (!callbackData || typeof callbackData !== "object") {
    console.warn("Invalid callback data received from Paymob");
    return {
      status: "failed",
      update_time: new Date().toISOString(),
      error: "Invalid callback data",
    };
  }

  // Extract relevant data
  const rawStatus =
    callbackData.status || callbackData.payment_status || "unknown";
  const standardStatus = standardizePaymentStatus(rawStatus);
  const transactionId = callbackData.id || callbackData.transaction_id || "";
  const extras = callbackData.extras?.creation_extras || {};

  // Log the payment result
  console.log(
    `Paymob payment processed: ${standardStatus} (${rawStatus}), ID: ${transactionId}`
  );

  return {
    id: transactionId,
    status: standardStatus,
    rawStatus: rawStatus,
    update_time: new Date().toISOString(),
    extras: extras,
    orderId: extras.orderId || callbackData.merchant_order_id,
    userId: extras.userId,
    amount: callbackData.amount_cents,
    currency: callbackData.currency,
    paymentMethod: callbackData.source_data?.type || "unknown",
  };
};

export default {
  createPaymentIntention,
  generateCheckoutUrl,
  processPaymentCallback,
  formatBillingData,
  standardizePaymentStatus,
};
