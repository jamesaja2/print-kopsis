"use server";

import prisma from "@/lib/prisma";

type CreatePaymentParams = {
  referenceId: string;
  amount: number;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  channelCode?: string;
  returnUrl: string;
};

const PAYMENKU_BASE_URL = "https://paymenku.com/api/v1";

async function getPaymentGatewayKey() {
  const settings = await prisma.globalSettings.findMany({
    where: {
      key: { in: ["payment_gateway_id", "payment_gateway_key"] },
    },
  });

  const dbKey = settings.find((s) => s.key === "payment_gateway_key")?.value?.trim() || "";
  const envKey = (process.env.PAYMENKU_API_KEY || process.env.PAYMENT_GATEWAY_KEY || "").trim();
  return dbKey || envKey;
}

/**
 * Creates a payment transaction via Paymenku API.
 * @param amount Amount in IDR (min 1000)
 * @returns { success: boolean, data?: any, error?: string }
 */
export async function createYoGatewayPayment(params: CreatePaymentParams) {
  try {
    const apiKey = await getPaymentGatewayKey();

    if (!apiKey) {
      console.error("Paymenku API Key missing");
      return { success: false, error: "Payment Gateway configuration missing" };
    }

    const body = {
      reference_id: params.referenceId,
      amount: Math.round(params.amount),
      customer_name: params.customerName,
      customer_email: params.customerEmail,
      customer_phone: params.customerPhone,
      channel_code: params.channelCode || "qris",
      return_url: params.returnUrl,
    };

    const response = await fetch(`${PAYMENKU_BASE_URL}/transaction/create`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const result = await response.json();

    if (response.ok && result?.status === "success" && result?.data) {
      return { success: true, data: result.data };
    }

    console.error("Paymenku Error:", result);
    return {
      success: false,
      error: result?.message || result?.error || "Failed to create payment link",
    };

  } catch (error) {
    console.error("Paymenku Exception:", error);
    return { success: false, error: "Exception calling Payment Gateway" };
  }
}

/**
 * Checks payment status via Paymenku API.
 * @param orderId Transaction ID (trx_id) or merchant reference_id
 */
export async function checkYoGatewayPaymentStatus(orderId: string) {
  try {
    const apiKey = await getPaymentGatewayKey();

    if (!apiKey) return { success: false, error: "API Key missing" };

    const apiUrl = `${PAYMENKU_BASE_URL}/check-status/${encodeURIComponent(orderId)}`;
    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      cache: "no-store",
    });
    const result = await response.json();

    if (response.ok && result?.data) {
      const status = String(result.data.status || "").toLowerCase();
      return { success: true, status, data: result.data };
    }

    return {
      success: false,
      error: result?.message || result?.error || "Invalid response from gateway",
    };

  } catch (error) {
    console.error("Paymenku Check Exception:", error);
    return { success: false, error: "Exception calling Check Status" };
  }
}
