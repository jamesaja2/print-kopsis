import prisma from "@/lib/prisma";
import { ok, fail } from "@/lib/apiResponse";
import { requireUser } from "@/lib/routeAuth";
import { getOrderStatusLabel } from "@/lib/printStatus";

export async function GET(
    _request: Request,
    context: { params: Promise<{ orderId: string }> }
) {
    const auth = await requireUser();
    if (!auth) return fail("Unauthorized", 401);

    const { orderId } = await context.params;
    const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { payment: true },
    });

    if (!order || order.userId !== auth.userId) {
        return fail("Order not found", 404);
    }

    return ok(
        {
            ...order,
            statusLabel: getOrderStatusLabel(order.status),
        },
        "Order retrieved"
    );
}
