import prisma from "@/lib/prisma";
import { ok, fail } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/routeAuth";
import { isMissingTableError } from "@/lib/prismaError";

export async function GET(
    _request: Request,
    context: { params: Promise<{ orderId: string }> }
) {
    const auth = await requireAdmin();
    if (!auth) return fail("Unauthorized", 401);

    try {
        const { orderId } = await context.params;
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
                payment: true,
                user: {
                    select: { id: true, email: true, name: true, role: true },
                },
            },
        });

        if (!order) return fail("Order not found", 404);

        let statusHistories: any[] = [];
        try {
            statusHistories = await (prisma as any).orderStatusHistory.findMany({
                where: { orderId },
                orderBy: { createdAt: "asc" },
            });
        } catch (historyError) {
            if (!isMissingTableError(historyError)) {
                throw historyError;
            }
        }

        return ok({ ...order, statusHistories }, "Order detail retrieved");
    } catch (error) {
        if (isMissingTableError(error)) {
            return fail("Print database tables belum tersedia. Jalankan sinkronisasi schema Prisma terlebih dahulu.", 503);
        }
        return fail(error instanceof Error ? error.message : "Failed to fetch order detail", 500);
    }
}
