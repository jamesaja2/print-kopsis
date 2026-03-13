import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

type SessionUser = {
    id?: string;
    role?: string;
};

export async function requireUser() {
    const session = await getServerSession(authOptions);
    const user = (session?.user || {}) as SessionUser;

    if (!session || !user.id) {
        return null;
    }

    return { session, userId: user.id, role: user.role || "" };
}

export async function requireAdmin() {
    const auth = await requireUser();
    if (!auth) return null;
    if (auth.role !== "ADMIN") return null;
    return auth;
}
