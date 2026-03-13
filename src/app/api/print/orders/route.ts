import { z } from "zod";
import prisma from "@/lib/prisma";
import { ok, fail } from "@/lib/apiResponse";
import { requireUser } from "@/lib/routeAuth";
import { getOrderStatusLabel } from "@/lib/printStatus";
import { printOrderService } from "@/services/printOrderService";
import { isMissingTableError } from "@/lib/prismaError";

const createOrderSchema = z.object({
    paperSize: z.enum(["A4", "F4"]),
    colorMode: z.enum(["grayscale", "color"]),
    duplexMode: z.enum(["single", "long_edge", "short_edge"]),
    orientation: z.enum(["portrait", "landscape"]),
    previewZoom: z.coerce.number().int().min(60).max(200),
    previewMargin: z.coerce.number().int().min(0).max(40),
    copies: z.coerce.number().int().min(1).max(100),
}).superRefine((value, context) => {
    if (value.colorMode === "color" && value.duplexMode !== "single") {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["duplexMode"],
            message: "Duplex is only available for grayscale printing",
        });
    }
});

export async function GET() {
    const auth = await requireUser();
    if (!auth) return fail("Unauthorized", 401);

    try {
        const orders = await prisma.order.findMany({
            where: { userId: auth.userId },
            include: { payment: true },
            orderBy: { createdAt: "desc" },
        });

        return ok(
            orders.map((order: any) => ({
                ...order,
                statusLabel: getOrderStatusLabel(order.status),
            })),
            "Orders retrieved"
        );
    } catch (error) {
        if (isMissingTableError(error)) {
            return fail("Print database tables belum tersedia. Jalankan sinkronisasi schema Prisma terlebih dahulu.", 503);
        }
        return fail(error instanceof Error ? error.message : "Failed to fetch orders", 500);
    }
}

export async function POST(request: Request) {
    const auth = await requireUser();
    if (!auth) return fail("Unauthorized", 401);

    try {
        const formData = await request.formData();
        const file = formData.get("file");
        const parsed = createOrderSchema.safeParse({
            paperSize: formData.get("paper_size"),
            colorMode: formData.get("color_mode"),
            duplexMode: formData.get("duplex_mode"),
            orientation: formData.get("orientation"),
            previewZoom: formData.get("preview_zoom"),
            previewMargin: formData.get("preview_margin"),
            copies: formData.get("copies"),
        });

        if (!parsed.success) {
            return fail("Invalid order options", 422, parsed.error.flatten());
        }

        if (!(file instanceof File)) {
            return fail("PDF file is required", 422);
        }

        const order = await printOrderService.createOrder(auth.userId, file, parsed.data);
        return ok(
            {
                ...order,
                statusLabel: getOrderStatusLabel(order.status),
            },
            "Order created",
            201
        );
    } catch (error) {
        if (isMissingTableError(error)) {
            return fail("Print database tables belum tersedia. Jalankan sinkronisasi schema Prisma terlebih dahulu.", 503);
        }
        return fail(error instanceof Error ? error.message : "Failed to create order", 500);
    }
}
