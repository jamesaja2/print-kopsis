"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import path from "path";
import { uploadToFileServerLegacy as uploadToFileServer, getPublicFileUrl, deleteFromFileServerLegacy as deleteFromFileServer, extractFileKey } from "@/lib/fileServer";
import { requireAdmin } from "@/lib/routeAuth";

type SliderRecord = {
    key: string;
    link?: string;
};

type SliderResponseRecord = SliderRecord & {
    url: string;
};

function normalizeSliderRecord(raw: any): SliderRecord | null {
    if (!raw) return null;
    if (typeof raw === "string") {
        return { key: raw, link: "" };
    }
    if (typeof raw === "object") {
        const key = raw.key || raw.image || raw.path || raw.url || "";
        if (!key) return null;
        return { key, link: raw.link || "" };
    }
    return null;
}

export async function getGlobalSettings() {
    try {
        const auth = await requireAdmin();
        if (!auth) {
            return { success: false, error: "Unauthorized" };
        }

        const settings = await prisma.globalSettings.findMany();
        // Convert array to object for easier access { key: value }
        const settingsMap: Record<string, string> = {};
        
        for (const s of settings) {
             let val = s.value;
             try {
                // Parse and sign slider image records only.
                if (s.key === "slider_images" && val.startsWith("[") && val.endsWith("]")) {
                    const arr = JSON.parse(val);
                    if (Array.isArray(arr)) {
                        const signedArr: SliderResponseRecord[] = [];
                        for (const item of arr) {
                            const normalized = normalizeSliderRecord(item);
                            if (!normalized) continue;
                                const url = normalized.key ? getPublicFileUrl(normalized.key) || "" : "";
                            signedArr.push({ ...normalized, url });
                        }
                        val = JSON.stringify(signedArr);
                    }
                } else if (!val.startsWith('http') && !val.startsWith('/') && val.includes("content/")) {
                    const resolved = getPublicFileUrl(val);
                    if (resolved) val = resolved;
                }
             } catch (e) {
                 // ignore parse errors
             }
             settingsMap[s.key] = val;
        }

        return { success: true, data: settingsMap };
    } catch (error) {
        console.error("Error fetching settings:", error);
        return { success: false, error: "Failed to fetch settings" };
    }
}

export async function updateContentSettings(formData: FormData) {
    try {
        const auth = await requireAdmin();
        if (!auth) {
            return { success: false, error: "Unauthorized" };
        }

        // Handle files and plain text
        // We will loop through keys. If value is File, we "upload" it.
        
        const entries = Array.from(formData.entries());

        // Slider metadata (existing records) and new uploads
        const sliderMetadataRaw = formData.get("setting_slider_images_metadata") as string | null;
        let sliderRecords: SliderRecord[] = [];
        if (sliderMetadataRaw) {
            try {
                const parsed = JSON.parse(sliderMetadataRaw);
                if (Array.isArray(parsed)) {
                    sliderRecords = parsed
                        .map(normalizeSliderRecord)
                        .filter((item): item is SliderRecord => !!item && !!item.key);
                }
            } catch (error) {
                console.warn("Failed to parse slider metadata", error);
            }
        }

        const sliderNewMetadataRaw = formData.getAll("setting_slider_images_new_metadata");
        const sliderNewFilesRaw = formData.getAll("setting_slider_images_new_files");
        const sliderNewItems: Array<{ file: File; link: string }> = [];

        for (let i = 0; i < sliderNewFilesRaw.length; i++) {
            const value = sliderNewFilesRaw[i];
            if (!(value instanceof File) || value.size === 0) continue;
            let link = "";
            const metaRaw = sliderNewMetadataRaw[i];
            if (typeof metaRaw === "string") {
                try {
                    const parsed = JSON.parse(metaRaw);
                    if (parsed && typeof parsed === "object" && typeof parsed.link === "string") {
                        link = parsed.link;
                    }
                } catch (error) {
                    console.warn("Invalid slider metadata", error);
                }
            }
            sliderNewItems.push({ file: value, link });
        }

        for (const [key, value] of entries) {
            if (key === "setting_slider_images_metadata" ||
                key === "setting_slider_images_new_metadata" ||
                key === "setting_slider_images_new_files") {
                continue;
            }

            if (!key.startsWith("setting_")) continue;
            
            const settingKey = key.replace("setting_", "");
            
            let storedValue = "";

            if (value instanceof File) {
                if (value.size === 0) continue; // Skip empty files
                
                let filePath = "";
                try {
                     const fileName = `${Date.now()}-${value.name.replaceAll(" ", "_")}`;
                     filePath = await uploadToFileServer(value, fileName, "content");
                } catch (e) {
                     console.error("Upload failed", e);
                     continue;
                }

                storedValue = filePath;
            } else {
                storedValue = value as string;
            }

            if (storedValue) {
                await prisma.globalSettings.upsert({
                    where: { key: settingKey },
                    update: { value: storedValue },
                    create: { key: settingKey, value: storedValue }
                });
            }
        }

        const sliderMetadataProvided = sliderMetadataRaw !== null;

        if (sliderMetadataProvided || sliderNewItems.length > 0) {
            const finalSlider: SliderRecord[] = sliderRecords.filter(item => item.key);

            for (const item of sliderNewItems) {
                try {
                    const ext = path.extname(item.file.name || "") || ".png";
                    const baseName = path
                        .basename(item.file.name || "slider", ext)
                        .replace(/\s+/g, "-") || "slider";
                    const uniqueSuffix = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
                    const filename = `${uniqueSuffix}-${baseName}${ext}`;
                    const key = await uploadToFileServer(item.file, filename, "content");
                    finalSlider.push({ key, link: item.link || "" });
                } catch (error) {
                    console.error("Slider upload failed", error);
                }
            }

            await prisma.globalSettings.upsert({
                where: { key: "slider_images" },
                update: { value: JSON.stringify(finalSlider) },
                create: { key: "slider_images", value: JSON.stringify(finalSlider) }
            });
        }

        revalidatePath("/content");
        return { success: true };
    } catch (error) {
        console.error("Error updating settings:", error);
        return { success: false, error: "Failed to update settings" };
    }
}

export async function deleteSliderImage(imagePath: string) {
    try {
        const auth = await requireAdmin();
        if (!auth) {
            return { success: false };
        }

        const normalizedKey = extractFileKey(imagePath);
        if (!normalizedKey) return { success: false };
        const currentSetting = await prisma.globalSettings.findUnique({ where: { key: "slider_images" } });
        if (!currentSetting?.value) return { success: false };
        
        let images: any[] = [];
        try {
            images = JSON.parse(currentSetting.value);
        } catch (e) {
            return { success: false };
        }

        const newImages: SliderRecord[] = [];
        for (const item of images) {
            const normalized = normalizeSliderRecord(item);
            if (!normalized) continue;
            if (normalized.key === normalizedKey) continue;
            newImages.push(normalized);
        }

        if (newImages.length === images.length) return { success: false };

        await deleteFromFileServer(normalizedKey);
        
        await prisma.globalSettings.update({
            where: { key: "slider_images" },
            data: { value: JSON.stringify(newImages) }
        });
        
        revalidatePath("/content");
        return { success: true };
    } catch (error) {
         return { success: false };
    }
}
