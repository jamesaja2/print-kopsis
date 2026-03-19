import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";

type KioskClientRecord = {
    name?: string;
    token?: string;
    isActive?: boolean;
};

export async function isValidKioskToken(request: NextRequest) {
    const authHeader = request.headers.get("authorization") || "";
    const [scheme, token] = authHeader.split(" ");

    const presentedToken = (token || "").trim();
    if (scheme !== "Bearer" || !presentedToken) {
        return false;
    }

    const settings = await prisma.globalSettings
        .findMany({
            where: { key: { in: ["kiosk_api_clients", "kiosk_api_token"] } },
            select: { key: true, value: true }
        })
        .catch(() => [] as Array<{ key: string; value: string }>);

    const clientsRaw = settings.find((record) => record.key === "kiosk_api_clients")?.value || "";
    const legacySingleToken = settings
        .find((record) => record.key === "kiosk_api_token")
        ?.value
        ?.trim() || "";

    let allowedTokens: string[] = [];
    if (clientsRaw) {
        try {
            const parsed = JSON.parse(clientsRaw);
            if (Array.isArray(parsed)) {
                allowedTokens = parsed
                    .filter((item): item is KioskClientRecord => !!item && typeof item === "object")
                    .filter((item) => item.isActive !== false)
                    .map((item) => (typeof item.token === "string" ? item.token.trim() : ""))
                    .filter(Boolean);
            }
        } catch {
            // Ignore malformed JSON and continue with fallback token.
        }
    }

    if (legacySingleToken) {
        allowedTokens.push(legacySingleToken);
    }

    const envToken = (process.env.KIOSK_API_TOKEN || "").trim();
    if (envToken) {
        allowedTokens.push(envToken);
    }

    if (allowedTokens.length === 0) {
        return false;
    }

    const dedupedAllowedTokens = [...new Set(allowedTokens)];

    return dedupedAllowedTokens.includes(presentedToken);
}
