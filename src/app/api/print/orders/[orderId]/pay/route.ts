import { ok, fail } from "@/lib/apiResponse";
import { requireUser } from "@/lib/routeAuth";
import { printOrderService } from "@/services/printOrderService";

export async function POST(
    _request: Request,
    context: { params: Promise<{ orderId: string }> }
) {
    const auth = await requireUser();
    if (!auth) return fail("Unauthorized", 401);

    try {
        const { orderId } = await context.params;
        const result = await printOrderService.initiatePayment(orderId, auth.userId);

        return ok(
            {
                orderId: result.order.id,
                paymentId: result.payment.id,
                paymentUrl: result.paymentUrl,
                qrUrl: result.qrUrl,
                gatewayTransactionId: result.payment.gatewayTransactionId,
            },
            "Payment initiated"
        );
    } catch (error) {
        return fail(error instanceof Error ? error.message : "Failed to initiate payment", 400);
    }
}
