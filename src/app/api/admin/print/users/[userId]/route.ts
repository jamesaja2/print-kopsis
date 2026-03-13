import prisma from "@/lib/prisma";
import { ok, fail } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/routeAuth";

export async function GET(
    _request: Request,
    context: { params: Promise<{ userId: string }> }
) {
    const auth = await requireAdmin();
    if (!auth) return fail("Unauthorized", 401);

    const { userId } = await context.params;
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            orders: {
                include: { payment: true },
                orderBy: { createdAt: "desc" },
            },
        },
    });

    if (!user) return fail("User not found", 404);
    return ok(user, "User detail retrieved");
}

export async function DELETE(
    _request: Request,
    context: { params: Promise<{ userId: string }> }
) {
    const auth = await requireAdmin();
    if (!auth) return fail("Unauthorized", 401);

    const { userId } = await context.params;

    try {
        await prisma.user.delete({ where: { id: userId } });
        return ok({}, "User deleted");
    } catch (error) {
        return fail(error instanceof Error ? error.message : "Unable to delete user", 400);
    }
}
