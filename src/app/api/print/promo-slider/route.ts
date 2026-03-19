import prisma from "@/lib/prisma";
import { ok, fail } from "@/lib/apiResponse";
import { requireUser } from "@/lib/routeAuth";
import { getPublicFileUrl } from "@/lib/fileServer";

type SliderItem = {
  key: string;
  link?: string;
  url?: string;
};

export async function GET() {
  const auth = await requireUser();
  if (!auth) return fail("Unauthorized", 401);

  try {
    const setting = await prisma.globalSettings.findUnique({ where: { key: "slider_images" } });
    if (!setting?.value) {
      return ok([], "Promo slider retrieved");
    }

    let parsed: unknown = [];
    try {
      parsed = JSON.parse(setting.value);
    } catch {
      parsed = [];
    }

    const items = Array.isArray(parsed)
      ? parsed
          .map((raw) => {
            if (!raw || typeof raw !== "object") return null;
            const key = String((raw as any).key || "").trim();
            if (!key) return null;
            const link = String((raw as any).link || "").trim();
            const url = getPublicFileUrl(key) || "";
            if (!url) return null;
            return { key, link, url } as SliderItem;
          })
          .filter((item): item is SliderItem => Boolean(item))
      : [];

    return ok(items, "Promo slider retrieved");
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed to load promo slider", 500);
  }
}
