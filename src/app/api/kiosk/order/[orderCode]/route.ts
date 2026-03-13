import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { ok, fail } from "@/lib/apiResponse";
import { isValidKioskToken } from "@/lib/kioskAuth";
import { getOrderStatusLabel } from "@/lib/printStatus";
import { logOrderStatus } from "@/lib/orderStatusHistory";

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ orderCode: string }> }
) {
    if (!(await isValidKioskToken(request))) {
        return fail("Unauthorized", 401);
    }

    const { orderCode } = await context.params;
    const order = await prisma.order.findUnique({
        where: { orderCode },
    });

    if (!order) {
        return fail("Order not found", 404);
    }

    if (order.status !== "PAID") {
        return fail("Order is not ready for printing", 400);
    }

    if (order.expiresAt && order.expiresAt.getTime() < Date.now()) {
        await prisma.order.update({
            where: { id: order.id },
            data: { status: "EXPIRED" },
        });
        await logOrderStatus(order.id, "EXPIRED", { type: "SYSTEM", name: "Kiosk API" }, "Order expired before print start");
        return fail("Order expired", 410);
    }

    return ok(
        {
            ...order,
            statusLabel: getOrderStatusLabel(order.status),
        },
        "Order ready"
    );
}
