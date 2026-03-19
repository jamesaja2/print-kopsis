import { z } from "zod";
import prisma from "@/lib/prisma";
import { ok, fail } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/routeAuth";
import { logOrderStatus } from "@/lib/orderStatusHistory";
import { isMissingTableError } from "@/lib/prismaError";
import { printOrderService } from "@/services/printOrderService";

const statusSchema = z.object({
    status: z.enum(["UPLOADED", "PAID", "PRINTING", "COMPLETED", "FAILED", "EXPIRED"]),
});

export async function PATCH(
    request: Request,
    context: { params: Promise<{ orderId: string }> }
) {
    const auth = await requireAdmin();
    if (!auth) return fail("Unauthorized", 401);

    try {
        const body = await request.json();
        const parsed = statusSchema.safeParse(body);
        if (!parsed.success) return fail("Invalid status", 422, parsed.error.flatten());

        const { orderId } = await context.params;
        const previous = await prisma.order.findUnique({ where: { id: orderId } });
        if (!previous) return fail("Order not found", 404);

        const order =
            parsed.data.status === "PAID" && previous.status !== "PAID"
                ? await printOrderService.markOrderPaidByAdmin(orderId)
                : await prisma.order.update({
                      where: { id: orderId },
                      data: { status: parsed.data.status },
                  });

        await logOrderStatus(
            order.id,
            parsed.data.status,
            { type: "ADMIN", id: auth.userId, name: ((auth.session.user as any)?.name as string) || "Admin" },
            "Manual status update from admin panel"
        );

        if (parsed.data.status === "COMPLETED" && previous.status !== "COMPLETED") {
            await printOrderService.triggerStorageDeleteOnCompleted(order, "Admin Manual Complete");
        }

        return ok(order, "Order status updated");
    } catch (error) {
        if (isMissingTableError(error)) {
            return fail("Print database tables belum tersedia. Jalankan sinkronisasi schema Prisma terlebih dahulu.", 503);
        }
        return fail(error instanceof Error ? error.message : "Unable to update status", 400);
    }
}
