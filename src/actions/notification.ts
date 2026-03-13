"use server";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createAnnouncement(title: string, message: string) {
    try {
        const cleanedTitle = title.trim();
        const cleanedMessage = message.trim();

        if (!cleanedTitle || !cleanedMessage) {
            return { error: "Title and message are required" };
        }

        await prisma.notification.create({
            data: {
                title: cleanedTitle,
                message: cleanedMessage
            }
        });
        revalidatePath("/"); // Revalidate everywhere as this affects header
        revalidatePath("/announcements");
        return { success: true };
    } catch (error) {
        return { error: "Failed to create announcement" };
    }
}

export type AnnouncementItem = {
    id: string;
    title: string;
    message: string;
    createdAt: Date;
};

export async function getAllAnnouncements(limit = 100): Promise<AnnouncementItem[]> {
    try {
        const announcements = await prisma.notification.findMany({
            orderBy: { createdAt: "desc" },
            take: limit,
        });
        return announcements;
    } catch (error) {
        return [];
    }
}

export async function updateAnnouncement(id: string, title: string, message: string) {
    try {
        const cleanedId = id.trim();
        const cleanedTitle = title.trim();
        const cleanedMessage = message.trim();

        if (!cleanedId || !cleanedTitle || !cleanedMessage) {
            return { error: "ID, title, and message are required" };
        }

        await prisma.notification.update({
            where: { id: cleanedId },
            data: {
                title: cleanedTitle,
                message: cleanedMessage,
            },
        });

        revalidatePath("/");
        revalidatePath("/announcements");
        return { success: true };
    } catch (error) {
        return { error: "Failed to update announcement" };
    }
}

export async function deleteAnnouncement(id: string) {
    try {
        const cleanedId = id.trim();
        if (!cleanedId) {
            return { error: "ID is required" };
        }

        await prisma.notification.delete({
            where: { id: cleanedId },
        });

        revalidatePath("/");
        revalidatePath("/announcements");
        return { success: true };
    } catch (error) {
        return { error: "Failed to delete announcement" };
    }
}

export async function getNotifications(limit = 5) {
    try {
        const notifications = await prisma.notification.findMany({
            orderBy: { createdAt: "desc" },
            take: limit
        });
        return notifications;
    } catch (error) {
        return [];
    }
}
