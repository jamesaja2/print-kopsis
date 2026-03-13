import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const trxId = String(body?.trx_id || "").trim();
    const referenceId = String(body?.reference_id || "").trim();
    const status = String(body?.status || "").toLowerCase();

    const whereClause = trxId
      ? { paymentTrxId: trxId }
      : referenceId.startsWith("TEAM-")
      ? { id: referenceId.slice("TEAM-".length) }
      : null;

    if (!whereClause) {
      return NextResponse.json({ status: false, message: "Payment reference not found" }, { status: 404 });
    }

    if (status === "paid") {
      await prisma.team.update({
        where: whereClause,
        data: {
          paymentStatus: "PAID",
          paidAt: new Date(),
        },
      });
    } else if (status === "expired" || status === "cancelled") {
       await prisma.team.update({
        where: whereClause,
        data: {
          paymentStatus: "EXPIRED",
        },
      });
    }

    return NextResponse.json({ status: true });
  } catch (error) {
    console.error("Payment Callback Error:", error);
    return NextResponse.json({ status: false }, { status: 500 });
  }
}
