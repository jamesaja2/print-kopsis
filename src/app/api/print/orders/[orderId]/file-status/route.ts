import prisma from "@/lib/prisma";
import { ok, fail } from "@/lib/apiResponse";
import { requireUser } from "@/lib/routeAuth";
import { getFileMetadata, parseFileReference } from "@/lib/fileServer";

export async function GET(
  _request: Request,
  context: { params: Promise<{ orderId: string }> }
) {
  const auth = await requireUser();
  if (!auth) return fail("Unauthorized", 401);

  const { orderId } = await context.params;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, userId: true, filePath: true },
  });

  if (!order) return fail("Order not found", 404);

  const isAdmin = auth.role === "ADMIN";
  if (!isAdmin && order.userId !== auth.userId) {
    return fail("Order not found", 404);
  }

  const ref = parseFileReference(order.filePath || "");
  if (!ref) {
    return ok({ exists: false, deleted: true, reason: "invalid_file_reference" }, "File status checked");
  }

  try {
    const meta = await getFileMetadata(ref.bucket, ref.key);
    return ok(
      {
        exists: true,
        deleted: false,
        bucket: ref.bucket,
        key: ref.key,
        url: meta.url,
      },
      "File status checked"
    );
  } catch {
    return ok(
      {
        exists: false,
        deleted: true,
        bucket: ref.bucket,
        key: ref.key,
      },
      "File status checked"
    );
  }
}
