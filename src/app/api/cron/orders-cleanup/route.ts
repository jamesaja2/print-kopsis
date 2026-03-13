import prisma from "@/lib/prisma";
import { ok, fail } from "@/lib/apiResponse";
import { printOrderService } from "@/services/printOrderService";
import { deleteFromFileServerLegacy } from "@/lib/fileServer";

function isAuthorizedCron(request: Request) {
    const configured = (process.env.CRON_SECRET || "").trim();
    if (!configured) return false;

    const bearer = request.headers.get("authorization") || "";
    const token = bearer.startsWith("Bearer ") ? bearer.slice(7) : "";
    return token === configured;
}

export async function GET(request: Request) {
    if (!isAuthorizedCron(request)) {
        return fail("Unauthorized", 401);
    }

    const expired = await printOrderService.expirePaidOrders();

    const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const staleOrders = await prisma.order.findMany({
        where: {
            status: { in: ["COMPLETED", "EXPIRED", "FAILED"] },
            createdAt: { lt: cutoff },
            filePath: { not: null },
        },
        select: { id: true, filePath: true },
    });

    if (staleOrders.length > 0) {
        for (const order of staleOrders) {
            if (!order.filePath) continue;
            try {
                await deleteFromFileServerLegacy(order.filePath);
            } catch {
                // Keep cleanup resilient; DB nulling still proceeds.
            }
        }

        await prisma.order.updateMany({
            where: { id: { in: staleOrders.map((o: { id: string }) => o.id) } },
            data: { filePath: null },
        });
    }

    return ok(
        {
            expiredOrders: expired.count,
            cleanedFiles: staleOrders.length,
        },
        "Cleanup completed"
    );
}
