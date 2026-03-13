import { ok, fail } from "@/lib/apiResponse";
import { printOrderService } from "@/services/printOrderService";

function hasValidWebhookSignature(request: Request, body: Record<string, unknown>) {
    const configured = (process.env.PRINT_WEBHOOK_SIGNATURE || "").trim();
    if (!configured) {
        return true;
    }

    const header =
        request.headers.get("x-print-signature") ||
        request.headers.get("x-paymenku-signature") ||
        request.headers.get("x-yogateway-signature") ||
        "";
    const fallback = String(body.signature || "");
    return header === configured || fallback === configured;
}

export async function POST(request: Request) {
    try {
        const body = (await request.json()) as Record<string, unknown>;
        if (!hasValidWebhookSignature(request, body)) {
            return fail("Invalid webhook signature", 401);
        }

        const order = await printOrderService.confirmPaymentByGatewayPayload(body);
        if (!order) {
            return fail("Payment reference not found", 404);
        }

        return ok(
            {
                orderId: order.id,
                orderCode: order.orderCode,
                status: order.status,
            },
            "Webhook processed"
        );
    } catch (error) {
        return fail(error instanceof Error ? error.message : "Webhook failed", 500);
    }
}
