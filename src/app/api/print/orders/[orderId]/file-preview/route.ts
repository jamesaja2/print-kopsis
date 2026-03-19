import prisma from "@/lib/prisma";
import { fail } from "@/lib/apiResponse";
import { requireUser } from "@/lib/routeAuth";

export async function GET(
  _request: Request,
  context: { params: Promise<{ orderId: string }> }
) {
  const auth = await requireUser();
  if (!auth) return fail("Unauthorized", 401);

  const { orderId } = await context.params;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, userId: true, filePath: true, originalFilename: true },
  });

  if (!order) return fail("Order not found", 404);

  const isAdmin = auth.role === "ADMIN";
  if (!isAdmin && order.userId !== auth.userId) {
    return fail("Order not found", 404);
  }

  if (!order.filePath) {
    return fail("File not found", 404);
  }

  try {
    const upstream = await fetch(order.filePath, { method: "GET", cache: "no-store" });
    if (!upstream.ok) {
      return fail("File not found", 404);
    }

    const contentType = upstream.headers.get("content-type") || "application/pdf";
    const arrayBuffer = await upstream.arrayBuffer();

    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${(order.originalFilename || "document.pdf").replace(/\"/g, "")}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return fail("File not found", 404);
  }
}
