import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import UserPromoCarousel from "@/components/print/UserPromoCarousel";

export const metadata: Metadata = {
  title: "KOPSIS Dashboard | Print Management",
  description: "Dashboard for print order operations",
};

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/signin");
  }

  const role = (session.user as any)?.role ?? "PARTICIPANT";

  if (role !== "ADMIN") {
    const [ordersCount, pendingCount, paidCount] = await Promise.all([
      prisma.order.count({ where: { userId: (session.user as any).id as string } }),
      prisma.order.count({ where: { userId: (session.user as any).id as string, status: "UPLOADED" } }),
      prisma.order.count({ where: { userId: (session.user as any).id as string, status: "PAID" } }),
    ]);

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
            <UserPromoCarousel />
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">Print Orders</h1>
            <p className="mt-2 text-sm text-gray-500">Upload PDF, atur opsi cetak, lalu bayar untuk mendapatkan order code.</p>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/print/create" className="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-brand-600">
                Mulai Order Baru
              </Link>
              <Link href="/print/my-orders" className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
                Cek Pesanan Saya
              </Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
            <p className="text-sm text-gray-500">Total Orders</p>
            <p className="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">{ordersCount}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
            <p className="text-sm text-gray-500">Pending Payment</p>
            <p className="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">{pendingCount}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
            <p className="text-sm text-gray-500">Paid Orders</p>
            <p className="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">{paidCount}</p>
          </div>
        </div>
      </div>
    );
  }

  let totalOrders = 0;
  let activeOrders = 0;
  let paidOrders = 0;

  try {
    if (role === "ADMIN") {
      const [total, active, paid] = await Promise.all([
        prisma.order.count(),
        prisma.order.count({ where: { status: { in: ["UPLOADED", "PAID", "PRINTING"] } } }),
        prisma.order.count({ where: { status: "PAID" } }),
      ]);
      totalOrders = total;
      activeOrders = active;
      paidOrders = paid;
    } else {
      const userId = (session.user as any).id as string;
      const [total, active, paid] = await Promise.all([
        prisma.order.count({ where: { userId } }),
        prisma.order.count({ where: { userId, status: { in: ["UPLOADED", "PAID", "PRINTING"] } } }),
        prisma.order.count({ where: { userId, status: "PAID" } }),
      ]);
      totalOrders = total;
      activeOrders = active;
      paidOrders = paid;
    }
  } catch {
    // Keep dashboard available even when print tables are not synced yet.
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">Print Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          {role === "ADMIN"
            ? "Pantau transaksi print, kelola status order, dan atur harga halaman."
            : "Kelola pesanan print Anda dan lanjutkan pembayaran dari satu tempat."}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <p className="text-sm text-gray-500">Total Orders</p>
          <p className="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">{totalOrders}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <p className="text-sm text-gray-500">Active Orders</p>
          <p className="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">{activeOrders}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <p className="text-sm text-gray-500">Paid Orders</p>
          <p className="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">{paidOrders}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/print/orders" className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
          Open Print Orders
        </Link>
        {role === "ADMIN" && (
          <>
            <Link href="/print/price-config" className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-white/80 dark:hover:bg-white/[0.04]">
              Manage Pricing
            </Link>
            <Link href="/announcements" className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-white/80 dark:hover:bg-white/[0.04]">
              Open Announcements
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
