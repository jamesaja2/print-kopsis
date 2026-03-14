"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Button from "@/components/ui/button/Button";
import Badge from "@/components/ui/badge/Badge";
import { Modal } from "@/components/ui/modal";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";

type PaymentData = {
  id?: string;
  amount?: string | number;
  status?: string;
  channel?: string;
  providerRef?: string | null;
  rawPayload?: unknown;
  paidAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type StatusHistory = {
  id: string;
  status: PrintOrder["status"];
  actorType: "USER" | "ADMIN" | "SYSTEM" | "KIOSK" | "WEBHOOK" | string;
  actorId?: string | null;
  actorName?: string | null;
  note?: string | null;
  createdAt: string;
};

type PrintOrder = {
  id: string;
  orderCode: string | null;
  originalFilename: string;
  pages: number;
  copies: number;
  paperSize: "A4" | "F4";
  colorMode: "GRAYSCALE" | "COLOR";
  duplexMode: "SINGLE" | "LONG_EDGE" | "SHORT_EDGE";
  orientation?: "PORTRAIT" | "LANDSCAPE";
  previewZoom?: number;
  previewMargin?: number;
  totalPrice: string;
  status: "UPLOADED" | "PAID" | "PRINTING" | "COMPLETED" | "FAILED" | "EXPIRED";
  statusLabel?: string;
  createdAt: string;
  updatedAt?: string;
  user?: {
    id: string;
    email: string;
    name: string | null;
    role?: string;
  };
  payment?: PaymentData | null;
  statusHistories?: StatusHistory[];
};

type PrintUserOption = {
  id: string;
  email: string;
  name: string | null;
};

type SalesSummary = {
  today: { orders: number; revenue: number; from: string; to: string };
  month: { orders: number; revenue: number; from: string; to: string };
  dailyBreakdown: Array<{ date: string; revenue: number; orders: number }>;
};

type ApiResponse<T> = {
  success: boolean;
  data: T;
  message: string;
};

const statusOptions: PrintOrder["status"][] = [
  "UPLOADED",
  "PAID",
  "PRINTING",
  "COMPLETED",
  "FAILED",
  "EXPIRED",
];

const colorOptions = [
  {
    value: "grayscale" as const,
    title: "Grayscale",
    description: "Hitam putih, lebih hemat biaya.",
  },
  {
    value: "color" as const,
    title: "Color",
    description: "Warna penuh untuk materi presentasi / poster.",
  },
];

const duplexOptions = [
  {
    value: "single" as const,
    title: "Single Side",
    description: "Cetak 1 sisi setiap lembar.",
    visual: "[1] [2] [3]",
  },
  {
    value: "long_edge" as const,
    title: "Duplex (Long Edge)",
    description: "Balik seperti buku. Cocok untuk dokumen portrait.",
    visual: "[1|2] [3|4]",
  },
  {
    value: "short_edge" as const,
    title: "Duplex (Short Edge)",
    description: "Balik seperti kalender. Cocok untuk dokumen landscape.",
    visual: "[1↕2] [3↕4]",
  },
];

function statusBadgeColor(status: string) {
  if (status === "COMPLETED") return "success" as const;
  if (status === "PAID" || status === "PRINTING") return "info" as const;
  if (status === "UPLOADED") return "warning" as const;
  if (status === "FAILED" || status === "EXPIRED") return "error" as const;
  return "light" as const;
}

function formatDate(dateStr: string | undefined) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrency(amount: number | string | undefined) {
  const value = Number(amount || 0);
  if (Number.isNaN(value)) return "Rp 0";
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
}

function actorLabel(item: StatusHistory) {
  const name = item.actorName?.trim();
  if (name) return `${name} (${item.actorType})`;
  if (item.actorId) return `${item.actorType} #${item.actorId.slice(0, 8)}`;
  return item.actorType;
}

function DuplexSvg({
  mode,
  orientation,
}: {
  mode: "single" | "long_edge" | "short_edge";
  orientation: "portrait" | "landscape";
}) {
  const isLandscape = orientation === "landscape";
  const pageWidth = isLandscape ? 94 : 70;
  const pageHeight = isLandscape ? 64 : 92;

  const leftX = 38;
  const rightX = 194;
  const pageY = 24;
  const centerY = pageY + pageHeight / 2;

  const modeLabel = mode === "single" ? "Single Side" : mode === "long_edge" ? "Duplex Long Edge" : "Duplex Short Edge";
  const flipLabel = mode === "long_edge" ? "Balik sisi panjang" : mode === "short_edge" ? "Balik sisi pendek" : "Tanpa balik";

  return (
    <svg viewBox="0 0 320 190" className="h-36 w-full rounded-xl border border-blue-light-200 bg-white md:h-48 dark:border-blue-light-800 dark:bg-gray-900">
      <rect x="10" y="10" width="300" height="170" rx="14" fill="#F8FAFC" stroke="#E4E7EC" />

      {mode === "single" ? (
        <>
          <rect x="122" y={pageY + 8} width={pageWidth} height={pageHeight} rx="8" fill="#EEF4FF" stroke="#6172F3" strokeWidth="2" />
          <rect x="112" y={pageY} width={pageWidth} height={pageHeight} rx="8" fill="#FFFFFF" stroke="#465FFF" strokeWidth="2" />
          <circle cx="127" cy={pageY + 12} r="10" fill="#465FFF" />
          <text x="127" y={pageY + 16} textAnchor="middle" fontSize="11" fill="#FFFFFF" fontWeight="700">1</text>
          <text x="147" y={centerY - 6} textAnchor="middle" fontSize="11" fill="#344054" fontWeight="700">Front</text>
          <text x="147" y={centerY + 11} textAnchor="middle" fontSize="10" fill="#475467">Page 1</text>

          <rect x="178" y={pageY + 54} width="82" height="30" rx="7" fill="#F2F4F7" stroke="#D0D5DD" />
          <text x="219" y={pageY + 72} textAnchor="middle" fontSize="10" fill="#667085">Halaman belakang kosong</text>
        </>
      ) : (
        <>
          {mode === "long_edge" ? (
            <>
              <rect x={leftX} y={pageY} width={pageWidth} height={pageHeight} rx="8" fill="#F5F8FF" stroke="#465FFF" strokeWidth="2" />
              <circle cx={leftX + 15} cy={pageY + 12} r="10" fill="#465FFF" />
              <text x={leftX + 15} y={pageY + 16} textAnchor="middle" fontSize="11" fill="#FFFFFF" fontWeight="700">1</text>
              <text x={leftX + pageWidth / 2} y={centerY - 6} textAnchor="middle" fontSize="11" fill="#344054" fontWeight="700">Front</text>
              <text x={leftX + pageWidth / 2} y={centerY + 11} textAnchor="middle" fontSize="10" fill="#475467">Page 1</text>

              <rect x={rightX} y={pageY} width={pageWidth} height={pageHeight} rx="8" fill="#ECFDF3" stroke="#12B76A" strokeWidth="2" />
              <circle cx={rightX + 15} cy={pageY + 12} r="10" fill="#12B76A" />
              <text x={rightX + 15} y={pageY + 16} textAnchor="middle" fontSize="11" fill="#FFFFFF" fontWeight="700">2</text>
              <text x={rightX + pageWidth / 2} y={centerY - 6} textAnchor="middle" fontSize="11" fill="#027A48" fontWeight="700">Back</text>
              <text x={rightX + pageWidth / 2} y={centerY + 11} textAnchor="middle" fontSize="10" fill="#039855">Page 2</text>

              <rect x="134" y="28" width="52" height="18" rx="6" fill="#E0F2FE" stroke="#7DD3FC" />
              <text x="160" y="40" textAnchor="middle" fontSize="9" fill="#0369A1">Long edge</text>
            </>
          ) : (
            <>
              <rect x="124" y="20" width="72" height="56" rx="8" fill="#F5F8FF" stroke="#465FFF" strokeWidth="2" />
              <circle cx="139" cy="32" r="10" fill="#465FFF" />
              <text x="139" y="36" textAnchor="middle" fontSize="11" fill="#FFFFFF" fontWeight="700">1</text>
              <text x="160" y="50" textAnchor="middle" fontSize="11" fill="#344054" fontWeight="700">Front</text>
              <text x="160" y="64" textAnchor="middle" fontSize="10" fill="#475467">Page 1</text>

              <rect x="124" y="82" width="72" height="56" rx="8" fill="#ECFDF3" stroke="#12B76A" strokeWidth="2" />
              <circle cx="139" cy="94" r="10" fill="#12B76A" />
              <text x="139" y="98" textAnchor="middle" fontSize="11" fill="#FFFFFF" fontWeight="700">2</text>
              <text x="160" y="112" textAnchor="middle" fontSize="11" fill="#027A48" fontWeight="700">Back</text>
              <text x="160" y="126" textAnchor="middle" fontSize="10" fill="#039855">Page 2</text>

              <rect x="206" y="84" width="70" height="18" rx="6" fill="#FEE4E2" stroke="#FDA29B" />
              <text x="241" y="96" textAnchor="middle" fontSize="9" fill="#B42318">Short edge</text>
            </>
          )}
        </>
      )}

      <rect x="26" y="146" width="268" height="24" rx="8" fill="#FFFFFF" stroke="#D0D5DD" />
      <text x="160" y="162" textAnchor="middle" fontSize="10" fill="#475467" fontWeight="600">
        {orientation === "portrait" ? "Portrait" : "Landscape"} · {modeLabel} · {flipLabel}
      </text>
    </svg>
  );
}

function getPaperRatio(paperSize: "A4" | "F4", orientation: "portrait" | "landscape") {
  const portraitRatio = paperSize === "A4" ? 210 / 297 : 215 / 330;
  return orientation === "portrait" ? portraitRatio : 1 / portraitRatio;
}

function PdfPreviewCanvas({
  file,
  paperSize,
  orientation,
  zoom,
  margin,
  colorMode,
}: {
  file: File | null;
  paperSize: "A4" | "F4";
  orientation: "portrait" | "landscape";
  zoom: number;
  margin: number;
  colorMode: "grayscale" | "color";
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const renderPreview = async () => {
      if (!canvasRef.current) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Keep a stable paper-like frame even when no file is selected.
      const paperRatio = getPaperRatio(paperSize, orientation);
      const outputWidth = 1200;
      const outputHeight = Math.round(outputWidth / paperRatio);

      canvas.width = outputWidth;
      canvas.height = outputHeight;
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, outputWidth, outputHeight);

      if (!file) {
        return;
      }

      setLoading(true);
      setPreviewError(null);

      try {
        const fileBytes = new Uint8Array(await file.arrayBuffer());
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.mjs", import.meta.url).toString();

        const loadingTask = pdfjs.getDocument({ data: fileBytes });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);

        const viewport = page.getViewport({ scale: 1 });
        const previewScale = outputWidth / 420;
        const marginPx = Math.round(margin * previewScale);
        const printableWidth = Math.max(200, outputWidth - marginPx * 2);
        const printableHeight = Math.max(200, outputHeight - marginPx * 2);

        const fitScale = Math.min(printableWidth / viewport.width, printableHeight / viewport.height);
        const renderScale = fitScale * (zoom / 100);
        const scaledViewport = page.getViewport({ scale: renderScale });

        const renderCanvas = document.createElement("canvas");
        renderCanvas.width = Math.max(1, Math.floor(scaledViewport.width));
        renderCanvas.height = Math.max(1, Math.floor(scaledViewport.height));
        const renderCtx = renderCanvas.getContext("2d");
        if (!renderCtx) {
          throw new Error("Unable to initialize PDF preview context");
        }

        await page.render({
          canvasContext: renderCtx,
          viewport: scaledViewport,
        }).promise;

        if (cancelled) return;

        const drawX = Math.round((outputWidth - renderCanvas.width) / 2);
        const drawY = Math.round((outputHeight - renderCanvas.height) / 2);
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, outputWidth, outputHeight);
        ctx.drawImage(renderCanvas, drawX, drawY);
      } catch {
        if (!cancelled) {
          setPreviewError("Preview tidak dapat dirender. Pastikan file PDF valid.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void renderPreview();

    return () => {
      cancelled = true;
    };
  }, [file, paperSize, orientation, zoom, margin]);

  const paperAspectRatio = getPaperRatio(paperSize, orientation);

  return (
    <div className="mt-3 rounded-lg border border-gray-200 bg-gray-100 p-3 dark:border-gray-700 dark:bg-gray-950">
      <div className="mx-auto w-full max-w-[420px] overflow-hidden rounded-md bg-white shadow-inner" style={{ aspectRatio: `${paperAspectRatio}` }}>
        {file ? (
          <canvas
            ref={canvasRef}
            className="h-full w-full"
            style={{
              filter: colorMode === "grayscale" ? "grayscale(1)" : "none",
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-gray-500">Upload PDF untuk melihat preview</div>
        )}
      </div>
      {loading && <p className="mt-2 text-xs text-gray-500">Rendering preview...</p>}
      {previewError && <p className="mt-2 text-xs text-red-600">{previewError}</p>}
      {file && (
        <p className="mt-2 text-xs text-gray-500">
          Preview menampilkan halaman 1 agar layout sesuai hasil cetak (fit-to-paper, margin, orientation).
        </p>
      )}
    </div>
  );
}

export default function PrintOrdersPage() {
  const { data: session } = useSession();
  const role = ((session?.user as any)?.role ?? "PARTICIPANT") as string;
  const isAdmin = role === "ADMIN";

  const [orders, setOrders] = useState<PrintOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [file, setFile] = useState<File | null>(null);
  const [paperSize, setPaperSize] = useState<"A4" | "F4">("A4");
  const [colorMode, setColorMode] = useState<"grayscale" | "color">("grayscale");
  const [duplexMode, setDuplexMode] = useState<"single" | "long_edge" | "short_edge">("single");
  const [copies, setCopies] = useState(1);
  const [previewOrientation, setPreviewOrientation] = useState<"portrait" | "landscape">("portrait");
  const [previewZoom, setPreviewZoom] = useState(100);
  const [previewMargin, setPreviewMargin] = useState(12);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailOrder, setDetailOrder] = useState<PrintOrder | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentOrderId, setPaymentOrderId] = useState<string | null>(null);
  const [paymentQrUrl, setPaymentQrUrl] = useState<string | null>(null);
  const [paymentGatewayStatus, setPaymentGatewayStatus] = useState<string>("pending");
  const [checkingPayment, setCheckingPayment] = useState(false);
  const paymentPollRef = useRef<number | null>(null);

  const [adminUsers, setAdminUsers] = useState<PrintUserOption[]>([]);
  const [salesSummary, setSalesSummary] = useState<SalesSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const [filterStatus, setFilterStatus] = useState<"ALL" | PrintOrder["status"]>("ALL");
  const [filterUserId, setFilterUserId] = useState<string>("ALL");
  const [filterFrom, setFilterFrom] = useState<string>("");
  const [filterTo, setFilterTo] = useState<string>("");

  const canSubmit = useMemo(() => !!file && copies >= 1 && !uploading, [file, copies, uploading]);

  const loadOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      let endpoint = isAdmin ? "/api/admin/print/orders" : "/api/print/orders";
      if (isAdmin) {
        const params = new URLSearchParams();
        if (filterStatus !== "ALL") params.set("status", filterStatus);
        if (filterUserId !== "ALL") params.set("userId", filterUserId);
        if (filterFrom) params.set("from", new Date(`${filterFrom}T00:00:00`).toISOString());
        if (filterTo) params.set("to", new Date(`${filterTo}T23:59:59`).toISOString());
        const query = params.toString();
        if (query) endpoint += `?${query}`;
      }

      const res = await fetch(endpoint, { cache: "no-store" });
      const json = (await res.json()) as ApiResponse<PrintOrder[]>;
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to fetch orders");
      }
      setOrders(json.data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch orders");
    } finally {
      setLoading(false);
    }
  };

  const loadAdminUsers = async () => {
    if (!isAdmin) return;
    try {
      const res = await fetch("/api/admin/print/users", { cache: "no-store" });
      const json = (await res.json()) as ApiResponse<PrintUserOption[]>;
      if (!res.ok || !json.success) return;
      setAdminUsers(json.data || []);
    } catch {
      // Keep orders page usable even when users filter source is unavailable.
    }
  };

  const loadSalesSummary = async () => {
    if (!isAdmin) return;
    setLoadingSummary(true);
    try {
      const res = await fetch("/api/admin/print/sales-summary", { cache: "no-store" });
      const json = (await res.json()) as ApiResponse<SalesSummary>;
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to fetch summary");
      }
      setSalesSummary(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch summary");
    } finally {
      setLoadingSummary(false);
    }
  };

  useEffect(() => {
    void loadOrders();
  }, [isAdmin, filterStatus, filterUserId, filterFrom, filterTo]);

  useEffect(() => {
    if (!isAdmin) return;
    void loadAdminUsers();
    void loadSalesSummary();
  }, [isAdmin]);

  useEffect(() => {
    if (colorMode === "color" && duplexMode !== "single") {
      setDuplexMode("single");
    }
  }, [colorMode, duplexMode]);

  const stopPaymentPolling = () => {
    if (paymentPollRef.current) {
      window.clearInterval(paymentPollRef.current);
      paymentPollRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopPaymentPolling();
    };
  }, []);

  const closePaymentModal = () => {
    stopPaymentPolling();
    setPaymentModalOpen(false);
  };

  const checkPaymentStatus = async (orderIdInput?: string) => {
    const targetOrderId = orderIdInput || paymentOrderId;
    if (!targetOrderId) return;
    if (checkingPayment) return;

    setCheckingPayment(true);
    try {
      const res = await fetch(`/api/print/orders/${targetOrderId}/check-status`, {
        method: "POST",
      });
      const json = (await res.json()) as ApiResponse<{
        orderStatus: PrintOrder["status"];
        paymentStatus: string;
        gatewayStatus: string;
        orderCode?: string | null;
      }>;

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to check payment status");
      }

      const gatewayStatus = String(json.data?.gatewayStatus || "pending").toLowerCase();
      const orderStatus = json.data?.orderStatus;
      setPaymentGatewayStatus(gatewayStatus);

      if (gatewayStatus === "paid" || orderStatus === "PAID") {
        stopPaymentPolling();
        setPaymentModalOpen(false);
        await loadOrders();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to check payment status");
    } finally {
      setCheckingPayment(false);
    }
  };

  const startQrPayment = async (orderId: string) => {
    setError(null);
    const res = await fetch(`/api/print/orders/${orderId}/pay`, {
      method: "POST",
    });
    const json = (await res.json()) as ApiResponse<{ qrUrl?: string; paymentUrl?: string }>;
    if (!res.ok || !json.success) {
      throw new Error(json.message || "Failed to initiate payment");
    }

    const qrUrl = json.data?.qrUrl;
    if (!qrUrl) {
      throw new Error("QR URL not available from payment gateway");
    }

    setPaymentOrderId(orderId);
    setPaymentQrUrl(qrUrl);
    setPaymentGatewayStatus("pending");
    setPaymentModalOpen(true);

    stopPaymentPolling();
    paymentPollRef.current = window.setInterval(() => {
      void checkPaymentStatus(orderId);
    }, 5000);

    await checkPaymentStatus(orderId);
  };

  const submitOrder = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("paper_size", paperSize);
      formData.append("color_mode", colorMode);
      formData.append("duplex_mode", duplexMode);
      formData.append("orientation", previewOrientation);
      formData.append("preview_zoom", String(previewZoom));
      formData.append("preview_margin", String(previewMargin));
      formData.append("copies", String(copies));

      const result = await new Promise<{ status: number; json: ApiResponse<PrintOrder> }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.onprogress = (progressEvent) => {
          if (!progressEvent.lengthComputable) return;
          const percent = Math.min(100, Math.round((progressEvent.loaded / progressEvent.total) * 100));
          setUploadProgress(percent);
        };

        xhr.onerror = () => reject(new Error("Upload failed due to network error"));

        xhr.onload = () => {
          let parsed: ApiResponse<PrintOrder>;
          try {
            parsed = JSON.parse(xhr.responseText) as ApiResponse<PrintOrder>;
          } catch {
            reject(new Error("Invalid response from server"));
            return;
          }
          resolve({ status: xhr.status, json: parsed });
        };

        xhr.open("POST", "/api/print/orders");
        xhr.send(formData);
      });

      if (result.status < 200 || result.status >= 300 || !result.json.success) {
        throw new Error(result.json.message || "Failed to create order");
      }

      const createdOrder = result.json.data;

      if (!isAdmin && createdOrder?.id) {
        await startQrPayment(createdOrder.id);
        await loadOrders();
        return;
      }

      setFile(null);
      setCopies(1);
      setUploadProgress(100);
      await loadOrders();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create order");
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 500);
    }
  };

  const payOrder = async (orderId: string) => {
    setError(null);
    try {
      await startQrPayment(orderId);
      await loadOrders();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to initiate payment");
    }
  };

  const openOrderDetail = async (orderId: string) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setError(null);
    try {
      const endpoint = isAdmin ? `/api/admin/print/orders/${orderId}` : `/api/print/orders/${orderId}`;
      const res = await fetch(endpoint, { cache: "no-store" });
      const json = (await res.json()) as ApiResponse<PrintOrder>;
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to fetch order detail");
      }
      setDetailOrder(json.data || null);
    } catch (e) {
      setDetailOrder(null);
      setError(e instanceof Error ? e.message : "Failed to fetch order detail");
    } finally {
      setDetailLoading(false);
    }
  };

  const updateOrderStatus = async (newStatus: PrintOrder["status"]) => {
    if (!detailOrder || !isAdmin) return;

    setUpdatingStatus(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/print/orders/${detailOrder.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = (await res.json()) as ApiResponse<PrintOrder>;
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to update order status");
      }

      setDetailOrder((prev) => (prev ? { ...prev, status: newStatus, statusLabel: newStatus } : prev));
      setOrders((prev) => prev.map((item) => (item.id === detailOrder.id ? { ...item, status: newStatus } : item)));
      await openOrderDetail(detailOrder.id);
      await loadSalesSummary();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update order status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const totalOrders = orders.length;
  const activeOrders = orders.filter((item) => ["UPLOADED", "PAID", "PRINTING"].includes(item.status)).length;
  const pendingPayment = orders.filter((item) => item.status === "UPLOADED").length;
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">Print Orders</h1>
        <p className="mt-1 text-sm text-gray-500">
          {isAdmin
            ? "Pantau order, cek detail transaksi, dan update status print dari halaman ini."
            : "Upload PDF, atur opsi cetak, lalu bayar untuk mendapatkan order code."}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <p className="text-sm text-gray-500">Total Orders</p>
          <p className="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">{totalOrders}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <p className="text-sm text-gray-500">Active</p>
          <p className="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">{activeOrders}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <p className="text-sm text-gray-500">Pending Payment</p>
          <p className="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">{pendingPayment}</p>
        </div>
      </div>

      {isAdmin && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
            <p className="text-sm text-gray-500">Penjualan Hari Ini</p>
            <p className="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
              {loadingSummary ? "..." : formatCurrency(salesSummary?.today.revenue)}
            </p>
            <p className="mt-1 text-xs text-gray-500">{salesSummary?.today.orders || 0} transaksi</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
            <p className="text-sm text-gray-500">Penjualan Bulan Ini</p>
            <p className="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
              {loadingSummary ? "..." : formatCurrency(salesSummary?.month.revenue)}
            </p>
            <p className="mt-1 text-xs text-gray-500">{salesSummary?.month.orders || 0} transaksi</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
            <p className="text-sm text-gray-500">Rata-rata per Transaksi</p>
            <p className="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
              {loadingSummary
                ? "..."
                : formatCurrency(
                    (salesSummary?.month.orders || 0) > 0
                      ? (salesSummary?.month.revenue || 0) / (salesSummary?.month.orders || 1)
                      : 0
                  )}
            </p>
            <p className="mt-1 text-xs text-gray-500">Berdasarkan transaksi bulan ini</p>
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <h2 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">Daily Breakdown (Current Month)</h2>
          {!salesSummary || salesSummary.dailyBreakdown.length === 0 ? (
            <p className="text-sm text-gray-500">Belum ada transaksi paid pada bulan ini.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="text-sm">
                <TableHeader>
                  <TableRow className="border-b border-gray-200 text-left dark:border-gray-800">
                    <TableCell isHeader className="py-3 pr-4 font-medium text-gray-600 dark:text-gray-300">Tanggal</TableCell>
                    <TableCell isHeader className="py-3 pr-4 font-medium text-gray-600 dark:text-gray-300">Transaksi</TableCell>
                    <TableCell isHeader className="py-3 pr-4 font-medium text-gray-600 dark:text-gray-300">Revenue</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesSummary.dailyBreakdown.map((item) => (
                    <TableRow key={item.date} className="border-b border-gray-100 dark:border-gray-800/80">
                      <TableCell className="py-3 pr-4 text-gray-700 dark:text-gray-200">{new Date(item.date).toLocaleDateString("id-ID")}</TableCell>
                      <TableCell className="py-3 pr-4 text-gray-700 dark:text-gray-200">{item.orders}</TableCell>
                      <TableCell className="py-3 pr-4 text-gray-700 dark:text-gray-200">{formatCurrency(item.revenue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {isAdmin && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">Filter Orders</h2>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setFilterStatus("ALL");
                setFilterUserId("ALL");
                setFilterFrom("");
                setFilterTo("");
              }}
            >
              Reset
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as "ALL" | PrintOrder["status"])}
              className="h-11 rounded-lg border border-gray-300 px-3 text-sm dark:border-gray-700 dark:bg-gray-900"
            >
              <option value="ALL">All Status</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>

            <select
              value={filterUserId}
              onChange={(e) => setFilterUserId(e.target.value)}
              className="h-11 rounded-lg border border-gray-300 px-3 text-sm dark:border-gray-700 dark:bg-gray-900"
            >
              <option value="ALL">All Users</option>
              {adminUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name || user.email}
                </option>
              ))}
            </select>

            <input
              type="date"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              className="h-11 rounded-lg border border-gray-300 px-3 text-sm dark:border-gray-700 dark:bg-gray-900"
            />

            <input
              type="date"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              className="h-11 rounded-lg border border-gray-300 px-3 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
          </div>
        </div>
      )}

      <form onSubmit={submitOrder} className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] space-y-5">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">Create Order</h2>

        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Upload File PDF</p>
          <label className="flex cursor-pointer flex-col gap-2 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 transition hover:border-brand-400 hover:bg-brand-25 dark:border-gray-700 dark:bg-gray-900/40 dark:hover:border-brand-500/70">
            <span className="text-sm text-gray-700 dark:text-gray-200">
              {file ? file.name : "Klik untuk pilih file PDF"}
            </span>
            <span className="text-xs text-gray-500">
              {file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : "Maksimal 200 MB"}
            </span>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => {
                setFile(e.target.files?.[0] || null);
                setUploadProgress(0);
              }}
              className="hidden"
              required
            />
          </label>

          {(uploading || uploadProgress > 0) && (
            <div className="space-y-1">
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
                <div
                  className="h-full rounded-full bg-brand-500 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-xs text-gray-500">
                {uploadProgress < 100 ? `Mengunggah file... ${uploadProgress}%` : "Memproses order..."}
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Ukuran Kertas</label>
            <p className="text-xs text-gray-500">Pilih jenis kertas untuk proses cetak.</p>
            <select value={paperSize} onChange={(e) => setPaperSize(e.target.value as "A4" | "F4")} className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm dark:border-gray-700 dark:bg-gray-900">
              <option value="A4">A4 (210 x 297 mm)</option>
              <option value="F4">F4 / Folio (215 x 330 mm)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Jumlah Copy</label>
            <p className="text-xs text-gray-500">Masukkan berapa set dokumen yang ingin dicetak.</p>
            <input
              type="number"
              min={1}
              max={100}
              value={copies}
              onChange={(e) => setCopies(Number(e.target.value || 1))}
              className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm dark:border-gray-700 dark:bg-gray-900"
              placeholder="Contoh: 2"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Orientation Preview</label>
            <select
              value={previewOrientation}
              onChange={(e) => setPreviewOrientation(e.target.value as "portrait" | "landscape")}
              className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm dark:border-gray-700 dark:bg-gray-900"
            >
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Zoom Preview ({previewZoom}%)</label>
            <input
              type="range"
              min={60}
              max={140}
              step={5}
              value={previewZoom}
              onChange={(e) => setPreviewZoom(Number(e.target.value))}
              className="h-11 w-full"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Margin Preview ({previewMargin}px)</label>
            <input
              type="range"
              min={0}
              max={24}
              step={2}
              value={previewMargin}
              onChange={(e) => setPreviewMargin(Number(e.target.value))}
              className="h-11 w-full"
            />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Mode Warna</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {colorOptions.map((option) => {
              const active = colorMode === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setColorMode(option.value)}
                  className={`rounded-xl border p-4 text-left transition ${
                    active
                      ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
                      : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900"
                  }`}
                >
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{option.title}</p>
                  <p className="mt-1 text-xs text-gray-500">{option.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Mode Duplex</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {duplexOptions.map((option) => {
              const active = duplexMode === option.value;
              const isDisabled = colorMode === "color" && option.value !== "single";
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    if (!isDisabled) setDuplexMode(option.value);
                  }}
                  disabled={isDisabled}
                  className={`rounded-xl border p-4 text-left transition ${
                    active
                      ? "border-brand-500 bg-brand-50 shadow-sm dark:bg-brand-500/10"
                      : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900"
                  } ${isDisabled ? "cursor-not-allowed opacity-50" : ""}`}
                >
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{option.title}</p>
                  <p className="mt-1 text-xs text-gray-500">{option.description}</p>
                </button>
              );
            })}
          </div>
          {colorMode === "color" ? (
            <p className="text-xs text-orange-600">Duplex hanya tersedia untuk grayscale. Mode color akan otomatis single side.</p>
          ) : null}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="overflow-hidden rounded-xl border border-blue-light-200 bg-blue-light-25 p-4 transition-all duration-300 dark:border-blue-light-800 dark:bg-blue-light-950/20">
              <p className="text-sm font-medium text-blue-light-800 dark:text-blue-light-200">Duplex Diagram</p>
              <p className="mt-1 text-xs text-blue-light-700 dark:text-blue-light-300">
                {duplexOptions.find((item) => item.value === duplexMode)?.description}
              </p>
              <div className="mt-3">
                <DuplexSvg mode={duplexMode} orientation={previewOrientation} />
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/40">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Print Preview</p>
              <p className="mt-1 text-xs text-gray-500">Preview terkontrol sesuai ukuran kertas, orientation, zoom, margin, dan mode warna.</p>
              <PdfPreviewCanvas
                file={file}
                paperSize={paperSize}
                orientation={previewOrientation}
                zoom={previewZoom}
                margin={previewMargin}
                colorMode={colorMode}
              />
            </div>
          </div>
        </div>

        <Button type="submit" disabled={!canSubmit}>
          {uploading ? "Creating..." : "Create Print Order"}
        </Button>
      </form>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">{isAdmin ? "All Orders" : "My Orders"}</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void loadOrders();
              if (isAdmin) void loadSalesSummary();
            }}
          >
            Refresh
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : orders.length === 0 ? (
          <p className="text-sm text-gray-500">No print orders yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table className="text-sm">
              <TableHeader>
                <TableRow className="border-b border-gray-200 text-left dark:border-gray-800">
                  <TableCell isHeader className="py-3 pr-4 font-medium text-gray-600 dark:text-gray-300">File</TableCell>
                  {isAdmin && <TableCell isHeader className="py-3 pr-4 font-medium text-gray-600 dark:text-gray-300">User</TableCell>}
                  <TableCell isHeader className="py-3 pr-4 font-medium text-gray-600 dark:text-gray-300">Pages</TableCell>
                  <TableCell isHeader className="py-3 pr-4 font-medium text-gray-600 dark:text-gray-300">Copies</TableCell>
                  <TableCell isHeader className="py-3 pr-4 font-medium text-gray-600 dark:text-gray-300">Price</TableCell>
                  <TableCell isHeader className="py-3 pr-4 font-medium text-gray-600 dark:text-gray-300">Status</TableCell>
                  <TableCell isHeader className="py-3 pr-4 font-medium text-gray-600 dark:text-gray-300">Code</TableCell>
                  <TableCell isHeader className="py-3 text-right font-medium text-gray-600 dark:text-gray-300">Action</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id} className="border-b border-gray-100 dark:border-gray-800/80">
                    <TableCell className="py-3 pr-4 text-gray-700 dark:text-gray-200">{order.originalFilename}</TableCell>
                    {isAdmin && <TableCell className="py-3 pr-4 text-gray-700 dark:text-gray-200">{order.user?.name || order.user?.email || "-"}</TableCell>}
                    <TableCell className="py-3 pr-4 text-gray-700 dark:text-gray-200">{order.pages}</TableCell>
                    <TableCell className="py-3 pr-4 text-gray-700 dark:text-gray-200">{order.copies}</TableCell>
                    <TableCell className="py-3 pr-4 text-gray-700 dark:text-gray-200">{order.totalPrice}</TableCell>
                    <TableCell className="py-3 pr-4">
                      <Badge color={statusBadgeColor(order.status)}>{order.statusLabel || order.status}</Badge>
                    </TableCell>
                    <TableCell className="py-3 pr-4 text-gray-700 dark:text-gray-200">
                      {order.orderCode ? (
                        <span
                          className="inline-flex rounded-md border border-gray-300 bg-gray-50 px-2 py-1 text-xs font-semibold tracking-[0.18em] text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                          style={{ fontFamily: "Consolas, 'Liberation Mono', Menlo, Monaco, 'Courier New', monospace" }}
                        >
                          {order.orderCode}
                        </span>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => void openOrderDetail(order.id)}>
                          Detail
                        </Button>
                        {!isAdmin && order.status === "UPLOADED" ? (
                          <Button size="sm" onClick={() => void payOrder(order.id)}>
                            Pay
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Modal isOpen={detailOpen} onClose={() => setDetailOpen(false)} className="max-w-2xl p-6">
        {detailLoading ? (
          <p className="text-sm text-gray-500">Loading detail...</p>
        ) : !detailOrder ? (
          <p className="text-sm text-gray-500">Order detail unavailable.</p>
        ) : (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">Transaction Detail</h3>
                <p className="text-sm text-gray-500">Order #{detailOrder.orderCode || detailOrder.id}</p>
              </div>
              <Badge color={statusBadgeColor(detailOrder.status)}>{detailOrder.statusLabel || detailOrder.status}</Badge>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/40">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Order Code</p>
              <div className="mt-2 flex items-center gap-3">
                <span
                  className="inline-flex rounded-lg border border-brand-300 bg-white px-4 py-2 text-xl font-bold tracking-[0.28em] text-brand-700 dark:border-brand-700/60 dark:bg-gray-900 dark:text-brand-300"
                  style={{ fontFamily: "Consolas, 'Liberation Mono', Menlo, Monaco, 'Courier New', monospace" }}
                >
                  {detailOrder.orderCode || "-"}
                </span>
                {detailOrder.orderCode ? (
                  <button
                    type="button"
                    className="text-xs font-medium text-brand-600 hover:underline"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(detailOrder.orderCode || "");
                      } catch {
                        // Ignore clipboard failure to keep modal stable.
                      }
                    }}
                  >
                    Copy Code
                  </button>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 rounded-xl border border-gray-200 p-4 text-sm dark:border-gray-800 md:grid-cols-2">
              <p><span className="text-gray-500">File:</span> <span className="text-gray-800 dark:text-gray-100">{detailOrder.originalFilename}</span></p>
              <p><span className="text-gray-500">Price:</span> <span className="text-gray-800 dark:text-gray-100">{detailOrder.totalPrice}</span></p>
              <p><span className="text-gray-500">Pages:</span> <span className="text-gray-800 dark:text-gray-100">{detailOrder.pages}</span></p>
              <p><span className="text-gray-500">Copies:</span> <span className="text-gray-800 dark:text-gray-100">{detailOrder.copies}</span></p>
              <p><span className="text-gray-500">Paper:</span> <span className="text-gray-800 dark:text-gray-100">{detailOrder.paperSize}</span></p>
              <p><span className="text-gray-500">Color:</span> <span className="text-gray-800 dark:text-gray-100">{detailOrder.colorMode}</span></p>
              <p><span className="text-gray-500">Duplex:</span> <span className="text-gray-800 dark:text-gray-100">{detailOrder.duplexMode}</span></p>
              <p><span className="text-gray-500">Orientation:</span> <span className="text-gray-800 dark:text-gray-100">{detailOrder.orientation || "-"}</span></p>
              <p><span className="text-gray-500">Zoom:</span> <span className="text-gray-800 dark:text-gray-100">{detailOrder.previewZoom || "-"}%</span></p>
              <p><span className="text-gray-500">Margin:</span> <span className="text-gray-800 dark:text-gray-100">{detailOrder.previewMargin ?? "-"} px</span></p>
              <p><span className="text-gray-500">Created:</span> <span className="text-gray-800 dark:text-gray-100">{formatDate(detailOrder.createdAt)}</span></p>
              {isAdmin && (
                <p className="md:col-span-2">
                  <span className="text-gray-500">User:</span>{" "}
                  <span className="text-gray-800 dark:text-gray-100">{detailOrder.user?.name || "-"} ({detailOrder.user?.email || "-"})</span>
                </p>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 p-4 text-sm dark:border-gray-800">
              <h4 className="mb-3 font-medium text-gray-800 dark:text-gray-100">Payment Info</h4>
              {detailOrder.payment ? (
                <div className="space-y-1">
                  <p><span className="text-gray-500">Status:</span> <span className="text-gray-800 dark:text-gray-100">{detailOrder.payment.status || "-"}</span></p>
                  <p><span className="text-gray-500">Amount:</span> <span className="text-gray-800 dark:text-gray-100">{String(detailOrder.payment.amount ?? "-")}</span></p>
                  <p><span className="text-gray-500">Channel:</span> <span className="text-gray-800 dark:text-gray-100">{detailOrder.payment.channel || "-"}</span></p>
                  <p><span className="text-gray-500">Reference:</span> <span className="text-gray-800 dark:text-gray-100">{detailOrder.payment.providerRef || "-"}</span></p>
                  <p><span className="text-gray-500">Paid At:</span> <span className="text-gray-800 dark:text-gray-100">{formatDate(detailOrder.payment.paidAt || undefined)}</span></p>
                </div>
              ) : (
                <p className="text-gray-500">No payment record yet.</p>
              )}
            </div>

            {isAdmin && (
              <div className="space-y-2 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                <h4 className="font-medium text-gray-800 dark:text-gray-100">Update Status</h4>
                <div className="flex flex-wrap gap-2">
                  {statusOptions.map((status) => (
                    <Button
                      key={status}
                      size="sm"
                      variant={detailOrder.status === status ? "primary" : "outline"}
                      onClick={() => void updateOrderStatus(status)}
                      disabled={updatingStatus}
                    >
                      {status}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-xl border border-gray-200 p-4 text-sm dark:border-gray-800">
              <h4 className="mb-3 font-medium text-gray-800 dark:text-gray-100">Status Timeline</h4>
              {detailOrder.statusHistories && detailOrder.statusHistories.length > 0 ? (
                <div className="space-y-3">
                  {detailOrder.statusHistories.map((item) => (
                    <div key={item.id} className="flex items-start justify-between rounded-lg border border-gray-100 p-3 dark:border-gray-800/80">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge color={statusBadgeColor(item.status)}>{item.status}</Badge>
                          <span className="text-xs text-gray-500">{actorLabel(item)}</span>
                        </div>
                        {item.note ? <p className="mt-1 text-xs text-gray-500">{item.note}</p> : null}
                      </div>
                      <span className="text-xs text-gray-500">{formatDate(item.createdAt)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No timeline history available.</p>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={paymentModalOpen} onClose={closePaymentModal} className="max-w-md p-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">Scan QRIS untuk Bayar</h3>
            <p className="text-sm text-gray-500">Status gateway: {paymentGatewayStatus}</p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
            {paymentQrUrl ? (
              <img src={paymentQrUrl} alt="QRIS Payment" className="mx-auto h-72 w-72 object-contain" />
            ) : (
              <div className="flex h-72 items-center justify-center text-sm text-gray-500">QR URL unavailable</div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => void checkPaymentStatus()} disabled={checkingPayment}>
              {checkingPayment ? "Checking..." : "Cek Status Sekarang"}
            </Button>
            <Button size="sm" variant="outline" onClick={closePaymentModal}>
              Tutup
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
