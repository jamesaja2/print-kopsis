import prisma from "@/lib/prisma";
import { uploadToFileServer } from "@/lib/fileServer";
import { checkYoGatewayPaymentStatus, createYoGatewayPayment } from "@/lib/yogateway";
import { logOrderStatus } from "@/lib/orderStatusHistory";
import { pdfService } from "@/services/pdfService";
import type { Prisma } from "@prisma/client";

const ALPHANUMERIC = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

type CreateOrderOptions = {
    paperSize: "A4" | "F4";
    colorMode: "grayscale" | "color";
    duplexMode: "single" | "long_edge" | "short_edge";
    orientation: "portrait" | "landscape";
    previewZoom: number;
    previewMargin: number;
    copies: number;
};

type PaymentWebhookPayload = {
    trx_id?: string;
    reference_id?: string;
    trxid?: string;
    status?: string;
    [key: string]: unknown;
};

export class PrintOrderService {
    private toJsonValue(payload: unknown): Prisma.InputJsonValue {
        return JSON.parse(JSON.stringify(payload ?? {})) as Prisma.InputJsonValue;
    }

    async createOrder(userId: string, file: File, options: CreateOrderOptions) {
        this.validatePdf(file);

        if (options.colorMode === "color" && options.duplexMode !== "single") {
            throw new Error("Duplex is only available for grayscale printing");
        }

        const pages = await pdfService.extractPageCount(file);
        const totalPrice = await this.calculatePrice(pages, options.copies, options.colorMode);

        const safeFilename = `${Date.now()}-${(file.name || "document.pdf").replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const uploadResult = await uploadToFileServer(file, safeFilename, `orders-${userId}`);

        const order = await prisma.order.create({
            data: {
                userId,
                filePath: uploadResult.url,
                originalFilename: file.name || safeFilename,
                pages,
                paperSize: options.paperSize,
                colorMode: options.colorMode === "color" ? "COLOR" : "GRAYSCALE",
                duplexMode: this.mapDuplexMode(options.duplexMode),
                orientation: options.orientation === "landscape" ? "LANDSCAPE" : "PORTRAIT",
                previewZoom: options.previewZoom,
                previewMargin: options.previewMargin,
                copies: options.copies,
                totalPrice,
                status: "UPLOADED",
            } as any,
        });

        await logOrderStatus(order.id, "UPLOADED", { type: "USER", id: userId, name: "User" }, "Order created");
        return order;
    }

    async generateOrderCode(): Promise<string> {
        for (let attempt = 0; attempt < 10; attempt++) {
            const code = this.randomCode(6);
            const existing = await prisma.order.findUnique({ where: { orderCode: code } });
            if (!existing) {
                return code;
            }
        }

        throw new Error("Unable to generate unique order code");
    }

    async calculatePrice(pages: number, copies: number, colorMode: "grayscale" | "color"): Promise<number> {
        const config = await prisma.priceConfig.findFirst({
            orderBy: { updatedAt: "desc" },
        });

        if (!config) {
            throw new Error("Price configuration is not set");
        }

        const unit = colorMode === "color" ? Number(config.pricePerPageColor) : Number(config.pricePerPageGrayscale);
        return pages * copies * unit;
    }

    async initiatePayment(orderId: string, userId: string): Promise<{ order: any; payment: any; paymentUrl: string; qrUrl: string }> {
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: { user: true },
        });
        if (!order || order.userId !== userId) {
            throw new Error("Order not found");
        }

        if (order.status !== "UPLOADED") {
            throw new Error("Only uploaded orders can be paid");
        }

        const amount = Number(order.totalPrice);
        const referenceId = `PRINT-${order.id}`;
        const appBaseUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");
        const customerName = (order.user.name || order.user.email.split("@")[0] || "Customer").trim();

        const gateway = await createYoGatewayPayment({
            referenceId,
            amount,
            customerName,
            customerEmail: order.user.email,
            channelCode: "qris",
            returnUrl: `${appBaseUrl}/print/orders?orderId=${order.id}`,
        });

        if (!gateway.success || !gateway.data) {
            throw new Error(gateway.error || "Unable to initiate payment");
        }

        const trxId = (gateway.data as any).trx_id as string | undefined;
        const paymentUrl = (gateway.data as any).pay_url as string | undefined;
        const qrUrl = (gateway.data as any)?.payment_info?.qr_url as string | undefined;

        if (!trxId || !paymentUrl || !qrUrl) {
            throw new Error("Invalid payment gateway response");
        }

        const payment = await prisma.payment.upsert({
            where: { orderId: order.id },
            create: {
                orderId: order.id,
                paymentGateway: "Paymenku",
                gatewayTransactionId: trxId,
                amount: order.totalPrice,
                status: "PENDING",
                payload: this.toJsonValue(gateway.data),
            },
            update: {
                gatewayTransactionId: trxId,
                amount: order.totalPrice,
                status: "PENDING",
                payload: this.toJsonValue(gateway.data),
                paidAt: null,
            },
        });

        return { order, payment, paymentUrl, qrUrl };
    }

    async syncPaymentStatus(orderId: string, userId: string) {
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: { payment: true },
        });

        if (!order || order.userId !== userId) {
            throw new Error("Order not found");
        }

        if (!order.payment?.gatewayTransactionId) {
            throw new Error("Payment record not found");
        }

        const check = await checkYoGatewayPaymentStatus(order.payment.gatewayTransactionId);
        if (!check.success) {
            throw new Error(check.error || "Unable to check payment status");
        }

        const gatewayStatus = String(check.status || "pending").toLowerCase();
        const payload = this.toJsonValue(check.data || {});

        if (gatewayStatus === "paid") {
            const updatedOrder = await this.confirmPayment(order.id, check.data || {}, "CHECK_STATUS");
            const refreshed = await prisma.order.findUnique({
                where: { id: updatedOrder.id },
                include: { payment: true },
            });
            return {
                gatewayStatus,
                order: refreshed || updatedOrder,
            };
        }

        if (gatewayStatus === "expired" || gatewayStatus === "cancelled" || gatewayStatus === "failed") {
            await prisma.payment.update({
                where: { id: order.payment.id },
                data: {
                    status: "FAILED",
                    payload,
                },
            });
        } else {
            await prisma.payment.update({
                where: { id: order.payment.id },
                data: {
                    payload,
                },
            });
        }

        const refreshed = await prisma.order.findUnique({
            where: { id: order.id },
            include: { payment: true },
        });

        return {
            gatewayStatus,
            order: refreshed || order,
        };
    }

    async confirmPaymentByGatewayPayload(gatewayPayload: PaymentWebhookPayload): Promise<any | null> {
        const trxId = String(gatewayPayload.trx_id || gatewayPayload.trxid || "").trim();
        const referenceId = String(gatewayPayload.reference_id || "").trim();
        const status = String(gatewayPayload.status || "").toLowerCase();

        if (!trxId && !referenceId) {
            return null;
        }

        let payment = trxId
            ? await prisma.payment.findUnique({
                  where: { gatewayTransactionId: trxId },
                  include: { order: true },
              })
            : null;

        if (!payment && referenceId.startsWith("PRINT-")) {
            const orderId = referenceId.slice("PRINT-".length);
            payment = await prisma.payment.findUnique({
                where: { orderId },
                include: { order: true },
            });
        }

        if (!payment) {
            return null;
        }

        if (status === "paid") {
            return this.confirmPayment(payment.order.id, gatewayPayload, "WEBHOOK");
        }

        if (status === "pending") {
            await prisma.payment.update({
                where: { id: payment.id },
                data: {
                    payload: this.toJsonValue(gatewayPayload),
                },
            });
            return payment.order;
        }

        if (status === "expired" || status === "cancelled" || status === "failed") {
            await prisma.payment.update({
                where: { id: payment.id },
                data: {
                    status: "FAILED",
                    payload: this.toJsonValue(gatewayPayload),
                },
            });
            return payment.order;
        }

        await prisma.payment.update({
            where: { id: payment.id },
            data: {
                payload: this.toJsonValue(gatewayPayload),
            },
        });

        return payment.order;
    }

    async confirmPayment(orderId: string, gatewayPayload: Record<string, unknown>, confirmedBy: "WEBHOOK" | "CHECK_STATUS" = "WEBHOOK") {
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: { payment: true },
        });

        if (!order) {
            throw new Error("Order not found");
        }

        if (!order.payment) {
            throw new Error("Payment record not found");
        }

        if (order.status === "PAID" || order.status === "PRINTING" || order.status === "COMPLETED") {
            return order;
        }

        const code = await this.generateOrderCode();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        const txResult = await prisma.$transaction([
            prisma.payment.update({
                where: { id: order.payment.id },
                data: {
                    status: "PAID",
                    payload: this.toJsonValue(gatewayPayload),
                    paidAt: new Date(),
                },
            }),
            prisma.order.update({
                where: { id: order.id },
                data: {
                    orderCode: code,
                    status: "PAID",
                    expiresAt,
                },
            }),
        ]);

        if (confirmedBy === "CHECK_STATUS") {
            await logOrderStatus(order.id, "PAID", { type: "SYSTEM", name: "Gateway Check Status" }, "Payment confirmed via check-status polling");
        } else {
            await logOrderStatus(order.id, "PAID", { type: "WEBHOOK", name: "Payment Webhook" }, "Payment confirmed");
        }
        return txResult[1];
    }

    async applyKioskTransition(orderCode: string, action: "start" | "complete" | "fail") {
        const order = await prisma.order.findUnique({ where: { orderCode } });
        if (!order) {
            throw new Error("Order not found");
        }

        if (order.status === "EXPIRED") {
            throw new Error("Order is expired");
        }

        if (action === "start") {
            if (order.status !== "PAID") {
                throw new Error("Order is not ready to print");
            }

            if (order.expiresAt && order.expiresAt.getTime() < Date.now()) {
                await prisma.order.update({
                    where: { id: order.id },
                    data: { status: "EXPIRED" },
                });
                throw new Error("Order is expired");
            }

            const updated = await prisma.order.update({
                where: { id: order.id },
                data: { status: "PRINTING" },
            });
            await logOrderStatus(order.id, "PRINTING", { type: "KIOSK", name: "Kiosk" }, "Kiosk started printing");
            return updated;
        }

        if (action === "complete") {
            if (order.status !== "PRINTING") {
                throw new Error("Order has not started printing");
            }
            const updated = await prisma.order.update({
                where: { id: order.id },
                data: { status: "COMPLETED" },
            });
            await logOrderStatus(order.id, "COMPLETED", { type: "KIOSK", name: "Kiosk" }, "Printing completed");
            return updated;
        }

        if (order.status !== "PRINTING") {
            throw new Error("Order has not started printing");
        }

        const updated = await prisma.order.update({
            where: { id: order.id },
            data: { status: "FAILED" },
        });
        await logOrderStatus(order.id, "FAILED", { type: "KIOSK", name: "Kiosk" }, "Printing failed");
        return updated;
    }

    async expirePaidOrders() {
        const result = await prisma.order.updateMany({
            where: {
                status: "PAID",
                expiresAt: { lt: new Date() },
            },
            data: {
                status: "EXPIRED",
            },
        });

        const recentCutoff = new Date(Date.now() - 2 * 60 * 1000);
        const expiredOrders = await prisma.order.findMany({
            where: {
                status: "EXPIRED",
                expiresAt: { lt: new Date() },
                updatedAt: { gte: recentCutoff },
            },
            select: { id: true },
            take: 500,
            orderBy: { updatedAt: "desc" },
        });

        for (const order of expiredOrders) {
            await logOrderStatus(order.id, "EXPIRED", { type: "SYSTEM", name: "Cron" }, "Auto-expired after 24 hours");
        }

        return result;
    }

    private validatePdf(file: File) {
        if (!file) {
            throw new Error("PDF file is required");
        }

        const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
        if (!isPdf) {
            throw new Error("Only PDF files are allowed");
        }

        const maxBytes = 20 * 1024 * 1024;
        if (file.size > maxBytes) {
            throw new Error("PDF exceeds 20MB limit");
        }
    }

    private randomCode(length: number) {
        let result = "";
        for (let i = 0; i < length; i++) {
            result += ALPHANUMERIC[Math.floor(Math.random() * ALPHANUMERIC.length)];
        }
        return result;
    }

    private mapDuplexMode(mode: CreateOrderOptions["duplexMode"]) {
        if (mode === "long_edge") return "LONG_EDGE";
        if (mode === "short_edge") return "SHORT_EDGE";
        return "SINGLE";
    }
}

export const printOrderService = new PrintOrderService();
