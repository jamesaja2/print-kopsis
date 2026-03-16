"use client";

import { useEffect, useState } from "react";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { getGlobalSettings, updateContentSettings } from "@/actions/settings";

export default function GlobalSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [paymentGatewayId, setPaymentGatewayId] = useState("");
  const [paymentGatewayKey, setPaymentGatewayKey] = useState("");
  const [registrationFee, setRegistrationFee] = useState("");
  const [kioskApiToken, setKioskApiToken] = useState("");
  const [defaultPrinter, setDefaultPrinter] = useState("");

  const generateKioskToken = () => {
    const randomBytes = new Uint8Array(24);
    if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
      window.crypto.getRandomValues(randomBytes);
    } else {
      for (let i = 0; i < randomBytes.length; i += 1) {
        randomBytes[i] = Math.floor(Math.random() * 256);
      }
    }

    const token = Array.from(randomBytes)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");

    setKioskApiToken(`kiosk_${token}`);
  };

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);

    const result = await getGlobalSettings();
    if (!result.success || !result.data) {
      setError(result.error || "Failed to load global settings");
      setLoading(false);
      return;
    }

    setPaymentGatewayId(result.data.payment_gateway_id || "");
    setPaymentGatewayKey(result.data.payment_gateway_key || "");
    setRegistrationFee(result.data.registration_fee || "");
    setKioskApiToken(result.data.kiosk_api_token || "");
    setDefaultPrinter(result.data.print_default_printer || "");
    setLoading(false);
  };

  useEffect(() => {
    void loadSettings();
  }, []);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    const formData = new FormData();
    formData.append("setting_payment_gateway_id", paymentGatewayId.trim());
    formData.append("setting_payment_gateway_key", paymentGatewayKey.trim());
    formData.append("setting_registration_fee", registrationFee.trim());
    formData.append("setting_kiosk_api_token", kioskApiToken.trim());
    formData.append("setting_print_default_printer", defaultPrinter.trim());

    const result = await updateContentSettings(formData);
    if (result.success) {
      setMessage("Global settings updated");
      await loadSettings();
    } else {
      setError(result.error || "Failed to update global settings");
    }

    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">Global Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Atur konfigurasi payment gateway dan biaya registrasi yang disimpan di database.
        </p>
      </div>

      <form
        onSubmit={handleSave}
        className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]"
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <Label>Payment Gateway ID</Label>
            <Input
              value={paymentGatewayId}
              onChange={(e) => setPaymentGatewayId(e.target.value)}
              placeholder="Optional merchant id"
            />
          </div>

          <div>
            <Label>Payment Gateway Key</Label>
            <Input
              value={paymentGatewayKey}
              onChange={(e) => setPaymentGatewayKey(e.target.value)}
              placeholder="Bearer API key"
              type="password"
            />
          </div>

          <div>
            <Label>Registration Fee (IDR)</Label>
            <Input
              value={registrationFee}
              onChange={(e) => setRegistrationFee(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="e.g. 50000"
            />
          </div>

          <div>
            <Label>Default Printer (Admin Only)</Label>
            <Input
              value={defaultPrinter}
              onChange={(e) => setDefaultPrinter(e.target.value)}
              placeholder="Contoh: Printer-Lab-A"
            />
            <p className="mt-1 text-xs text-gray-500">
              Printer dipilih oleh admin. Customer tidak bisa memilih printer sendiri.
            </p>
          </div>

          <div className="md:col-span-2">
            <Label>Kiosk API Token</Label>
            <div className="flex flex-col gap-3 md:flex-row">
              <div className="flex-1">
                <Input
                  value={kioskApiToken}
                  onChange={(e) => setKioskApiToken(e.target.value)}
                  placeholder="Bearer token untuk endpoint kiosk"
                />
              </div>
              <button
                type="button"
                onClick={generateKioskToken}
                disabled={saving || loading}
                className="rounded border border-brand-300 px-4 py-2.5 text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50 dark:border-brand-800 dark:text-brand-300 dark:hover:bg-brand-900/30"
              >
                Generate Token
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Token ini dipakai sebagai header Authorization Bearer untuk semua endpoint kiosk.
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="submit"
            disabled={saving || loading}
            className="rounded bg-brand-500 px-6 py-2.5 font-medium text-white hover:bg-opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>

          <button
            type="button"
            onClick={() => void loadSettings()}
            disabled={saving || loading}
            className="rounded border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Refresh
          </button>
        </div>

        {loading && <p className="mt-4 text-sm text-gray-500">Loading settings...</p>}
        {message && <p className="mt-4 text-sm text-green-600">{message}</p>}
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </form>
    </div>
  );
}
