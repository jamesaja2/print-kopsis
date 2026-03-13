import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";

export async function isValidKioskToken(request: NextRequest) {
    const authHeader = request.headers.get("authorization") || "";
    const [scheme, token] = authHeader.split(" ");

    const tokenFromDb = await prisma.globalSettings
        .findUnique({ where: { key: "kiosk_api_token" }, select: { value: true } })
        .then((record) => record?.value?.trim() || "")
        .catch(() => "");

    const expectedToken = tokenFromDb || (process.env.KIOSK_API_TOKEN || "").trim();

    if (!expectedToken) {
        return false;
    }

    return scheme === "Bearer" && token === expectedToken;
}
