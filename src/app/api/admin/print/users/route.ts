import prisma from "@/lib/prisma";
import { ok, fail } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/routeAuth";
import { isMissingTableError } from "@/lib/prismaError";

export async function GET() {
    const auth = await requireAdmin();
    if (!auth) return fail("Unauthorized", 401);

    try {
        const users = await prisma.user.findMany({
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                createdAt: true,
                _count: {
                    select: {
                        orders: true,
                    },
                },
            },
        });

        return ok(users, "Users retrieved");
    } catch (error) {
        if (isMissingTableError(error)) {
            return fail("Print database tables belum tersedia. Jalankan sinkronisasi schema Prisma terlebih dahulu.", 503);
        }
        return fail(error instanceof Error ? error.message : "Failed to fetch users", 500);
    }
}
