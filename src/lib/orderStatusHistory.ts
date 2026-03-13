import prisma from "@/lib/prisma";

export type OrderHistoryActor = {
  type: "USER" | "ADMIN" | "SYSTEM" | "KIOSK" | "WEBHOOK";
  id?: string;
  name?: string;
};

export async function logOrderStatus(
  orderId: string,
  status: "UPLOADED" | "PAID" | "PRINTING" | "COMPLETED" | "FAILED" | "EXPIRED",
  actor: OrderHistoryActor,
  note?: string
) {
  try {
    await prisma.orderStatusHistory.create({
      data: {
        orderId,
        status,
        actorType: actor.type,
        actorId: actor.id || null,
        actorName: actor.name || null,
        note: note || null,
      },
    });
  } catch {
    // Keep core flow resilient when history table is not migrated yet.
  }
}
