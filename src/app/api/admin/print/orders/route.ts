import prisma from "@/lib/prisma";
import { ok, fail } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/routeAuth";
import { isMissingTableError } from "@/lib/prismaError";

export async function GET(request: Request) {
    const auth = await requireAdmin();
    if (!auth) return fail("Unauthorized", 401);

    const url = new URL(request.url);
    const status = url.searchParams.get("status") || undefined;
    const userId = url.searchParams.get("userId") || undefined;
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    const where: any = {};
    if (status) where.status = status;
    if (userId) where.userId = userId;
    if (from || to) {
        where.createdAt = {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
        };
    }

    try {
        const orders = await prisma.order.findMany({
            where,
            include: {
                user: {
                    select: { id: true, email: true, name: true },
                },
                payment: true,
            },
            orderBy: { createdAt: "desc" },
        });

        return ok(orders, "Admin orders retrieved");
    } catch (error) {
        if (isMissingTableError(error)) {
            return fail("Print database tables belum tersedia. Jalankan sinkronisasi schema Prisma terlebih dahulu.", 503);
        }
        return fail(error instanceof Error ? error.message : "Failed to fetch admin orders", 500);
    }
}
