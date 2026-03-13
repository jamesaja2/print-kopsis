"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/button/Button";

type PriceConfig = {
  id: string;
  pricePerPageGrayscale: string;
  pricePerPageColor: string;
  updatedAt: string;
};

type ApiResponse<T> = {
  success: boolean;
  data: T;
  message: string;
};

function formatCurrency(amount: number | string | undefined) {
  const value = Number(amount || 0);
  if (Number.isNaN(value)) return "Rp 0";
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
}

export default function PrintPriceConfigPage() {
  const [gray, setGray] = useState("0");
  const [color, setColor] = useState("0");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadConfig = async () => {
    setError(null);
    try {
      const res = await fetch("/api/admin/print/price-config", { cache: "no-store" });
      const json = (await res.json()) as ApiResponse<PriceConfig | null>;
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load config");
      }
      if (json.data) {
        setGray(String(json.data.pricePerPageGrayscale));
        setColor(String(json.data.pricePerPageColor));
        setLastUpdated(json.data.updatedAt);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load config");
    }
  };

  useEffect(() => {
    void loadConfig();
  }, []);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/print/price-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          price_per_page_grayscale: Number(gray),
          price_per_page_color: Number(color),
        }),
      });
      const json = (await res.json()) as ApiResponse<PriceConfig>;
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to save config");
      }
      setMessage("Price config updated");
      await loadConfig();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save config");
    } finally {
      setSaving(false);
    }
  };

  const spread = useMemo(() => Number(color || 0) - Number(gray || 0), [color, gray]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">Print Pricing</h1>
        <p className="mt-1 text-sm text-gray-500">Atur harga per halaman agar kalkulasi order selalu real-time.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <p className="text-sm text-gray-500">Grayscale</p>
          <p className="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">{formatCurrency(gray)}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <p className="text-sm text-gray-500">Color</p>
          <p className="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">{formatCurrency(color)}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <p className="text-sm text-gray-500">Selisih Color vs Gray</p>
          <p className="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">{formatCurrency(spread)}</p>
        </div>
      </div>

      <form onSubmit={save} className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] space-y-5 max-w-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">Update Price Configuration</h2>
            <p className="mt-1 text-sm text-gray-500">Perubahan akan langsung dipakai pada order berikutnya.</p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => void loadConfig()}>
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Price per page (grayscale)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={gray}
              onChange={(e) => setGray(e.target.value)}
              className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Price per page (color)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Price Config"}</Button>
          {lastUpdated ? <p className="text-xs text-gray-500">Last updated: {new Date(lastUpdated).toLocaleString("id-ID")}</p> : null}
        </div>

        {message && <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      </form>
    </div>
  );
}
