import prisma from "@/lib/prisma";
import { ok, fail } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/routeAuth";
import { isMissingTableError } from "@/lib/prismaError";

const REPORT_TIME_ZONE = "Asia/Jakarta";

function toDateKey(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) return "";
  return `${year}-${month}-${day}`;
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth) return fail("Unauthorized", 401);

  try {
    const now = new Date();
    const todayKey = toDateKey(now, REPORT_TIME_ZONE);
    const currentMonthKey = todayKey.slice(0, 7);
    const lookbackStart = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000);

    const paidPayments = await prisma.payment.findMany({
      where: {
        status: "PAID",
        OR: [{ paidAt: { gte: lookbackStart } }, { updatedAt: { gte: lookbackStart } }],
      },
      select: { amount: true, paidAt: true, updatedAt: true, orderId: true },
    });

    const fallbackOrders = await prisma.order.findMany({
      where: {
        status: { in: ["PAID", "PRINTING", "COMPLETED"] },
        updatedAt: { gte: lookbackStart },
        OR: [{ payment: null }, { payment: { isNot: { status: "PAID" } } }],
      },
      select: { id: true, totalPrice: true, updatedAt: true },
    });

    const saleEvents = [
      ...paidPayments.map((payment) => ({
        amount: Number(payment.amount),
        occurredAt: payment.paidAt || payment.updatedAt,
      })),
      ...fallbackOrders.map((order) => ({
        amount: Number(order.totalPrice),
        occurredAt: order.updatedAt,
      })),
    ];

    const monthSales = saleEvents.filter((event) => {
      if (!event.occurredAt) return false;
      return toDateKey(event.occurredAt, REPORT_TIME_ZONE).startsWith(currentMonthKey);
    });

    const todaySales = monthSales.filter((event) => {
      if (!event.occurredAt) return false;
      return toDateKey(event.occurredAt, REPORT_TIME_ZONE) === todayKey;
    });

    const todayRevenue = todaySales.reduce((sum, item) => sum + item.amount, 0);
    const monthRevenue = monthSales.reduce((sum, item) => sum + item.amount, 0);

    const byDayMap = new Map<string, { date: string; revenue: number; orders: number }>();
    for (const event of monthSales) {
      if (!event.occurredAt) continue;
      const key = toDateKey(event.occurredAt, REPORT_TIME_ZONE);
      const current = byDayMap.get(key) || { date: key, revenue: 0, orders: 0 };
      current.revenue += event.amount;
      current.orders += 1;
      byDayMap.set(key, current);
    }

    const dailyBreakdown = Array.from(byDayMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    return ok(
      {
        today: {
          orders: todaySales.length,
          revenue: todayRevenue,
          from: `${todayKey}T00:00:00+07:00`,
          to: now.toISOString(),
        },
        month: {
          orders: monthSales.length,
          revenue: monthRevenue,
          from: `${currentMonthKey}-01T00:00:00+07:00`,
          to: now.toISOString(),
        },
        dailyBreakdown,
      },
      "Sales summary retrieved"
    );
  } catch (error) {
    if (isMissingTableError(error)) {
      return fail("Print database tables belum tersedia. Jalankan sinkronisasi schema Prisma terlebih dahulu.", 503);
    }
    return fail(error instanceof Error ? error.message : "Failed to fetch sales summary", 500);
  }
}
