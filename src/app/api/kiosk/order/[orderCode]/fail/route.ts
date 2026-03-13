import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/apiResponse";
import { isValidKioskToken } from "@/lib/kioskAuth";
import { printOrderService } from "@/services/printOrderService";

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ orderCode: string }> }
) {
    if (!(await isValidKioskToken(request))) {
        return fail("Unauthorized", 401);
    }

    try {
        const { orderCode } = await context.params;
        const order = await printOrderService.applyKioskTransition(orderCode, "fail");
        return ok({ orderId: order.id, status: order.status }, "Printing marked as failed");
    } catch (error) {
        return fail(error instanceof Error ? error.message : "Unable to mark printing as failed", 400);
    }
}
