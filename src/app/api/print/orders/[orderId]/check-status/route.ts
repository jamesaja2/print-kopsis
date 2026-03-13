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
        const result = await printOrderService.syncPaymentStatus(orderId, auth.userId);

        return ok(
            {
                orderId: result.order.id,
                orderStatus: result.order.status,
                paymentStatus: result.order.payment?.status || "PENDING",
                gatewayStatus: result.gatewayStatus,
                orderCode: result.order.orderCode,
            },
            "Payment status checked"
        );
    } catch (error) {
        return fail(error instanceof Error ? error.message : "Failed to check payment status", 400);
    }
}
