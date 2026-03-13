import { z } from "zod";
import prisma from "@/lib/prisma";
import { ok, fail } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/routeAuth";
import { isMissingTableError } from "@/lib/prismaError";

const priceSchema = z.object({
    price_per_page_grayscale: z.coerce.number().min(0),
    price_per_page_color: z.coerce.number().min(0),
});

export async function GET() {
    const auth = await requireAdmin();
    if (!auth) return fail("Unauthorized", 401);

    try {
        const config = await prisma.priceConfig.findFirst({
            orderBy: { updatedAt: "desc" },
        });

        return ok(config, "Price config retrieved");
    } catch (error) {
        if (isMissingTableError(error)) {
            return fail("Print database tables belum tersedia. Jalankan sinkronisasi schema Prisma terlebih dahulu.", 503);
        }
        return fail(error instanceof Error ? error.message : "Failed to fetch price config", 500);
    }
}

export async function PATCH(request: Request) {
    const auth = await requireAdmin();
    if (!auth) return fail("Unauthorized", 401);

    try {
        const body = await request.json();
        const parsed = priceSchema.safeParse(body);
        if (!parsed.success) return fail("Invalid price config", 422, parsed.error.flatten());

        const config = await prisma.priceConfig.create({
            data: {
                pricePerPageGrayscale: parsed.data.price_per_page_grayscale,
                pricePerPageColor: parsed.data.price_per_page_color,
            },
        });

        return ok(config, "Price config updated");
    } catch (error) {
        if (isMissingTableError(error)) {
            return fail("Print database tables belum tersedia. Jalankan sinkronisasi schema Prisma terlebih dahulu.", 503);
        }
        return fail(error instanceof Error ? error.message : "Unable to update price config", 400);
    }
}
