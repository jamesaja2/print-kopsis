"use client";

import { useEffect, useState } from "react";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { getGlobalSettings, updateContentSettings } from "@/actions/settings";

type SliderItem = {
  key: string;
  url?: string;
  link?: string;
};

type PendingSliderItem = {
  id: string;
  file: File;
  link: string;
  previewUrl: string;
};

type KioskClient = {
  id: string;
  name: string;
  token: string;
  isActive: boolean;
};

const createKioskClientId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const createKioskToken = () => {
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

  return `kiosk_${token}`;
};

const createDefaultKioskClient = (name?: string, token?: string): KioskClient => ({
  id: createKioskClientId(),
  name: name?.trim() || "Kiosk",
  token: token?.trim() || createKioskToken(),
  isActive: true,
});

export default function GlobalSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [paymentGatewayId, setPaymentGatewayId] = useState("");
  const [paymentGatewayKey, setPaymentGatewayKey] = useState("");
  const [registrationFee, setRegistrationFee] = useState("");
  const [kioskClients, setKioskClients] = useState<KioskClient[]>([]);
  const [defaultPrinter, setDefaultPrinter] = useState("");
  const [sliderItems, setSliderItems] = useState<SliderItem[]>([]);
  const [pendingSliderItems, setPendingSliderItems] = useState<PendingSliderItem[]>([]);

  const addKioskClient = () => {
    setKioskClients((prev) => [...prev, createDefaultKioskClient(`Kiosk ${prev.length + 1}`)]);
  };

  const updateKioskClient = (id: string, patch: Partial<KioskClient>) => {
    setKioskClients((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const removeKioskClient = (id: string) => {
    setKioskClients((prev) => prev.filter((item) => item.id !== id));
  };

  const regenerateKioskClientToken = (id: string) => {
    updateKioskClient(id, { token: createKioskToken() });
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
    setDefaultPrinter(result.data.print_default_printer || "");

    const rawKioskClients = result.data.kiosk_api_clients || "";
    const legacyKioskToken = (result.data.kiosk_api_token || "").trim();

    let parsedKioskClients: KioskClient[] = [];
    if (rawKioskClients) {
      try {
        const parsed = JSON.parse(rawKioskClients);
        if (Array.isArray(parsed)) {
          parsedKioskClients = parsed
            .map((item, index) => {
              if (!item || typeof item !== "object") return null;
              const name = String((item as any).name || "").trim() || `Kiosk ${index + 1}`;
              const token = String((item as any).token || "").trim();
              if (!token) return null;
              return {
                id: createKioskClientId(),
                name,
                token,
                isActive: Boolean((item as any).isActive ?? true),
              } as KioskClient;
            })
            .filter((item): item is KioskClient => Boolean(item));
        }
      } catch {
        parsedKioskClients = [];
      }
    }

    if (parsedKioskClients.length === 0 && legacyKioskToken) {
      parsedKioskClients = [createDefaultKioskClient("Kiosk Legacy", legacyKioskToken)];
    }

    setKioskClients(parsedKioskClients);

    const rawSlider = result.data.slider_images || "[]";
    try {
      const parsed = JSON.parse(rawSlider);
      if (Array.isArray(parsed)) {
        setSliderItems(
          parsed
            .map((item) => {
              if (!item || typeof item !== "object") return null;
              const key = String((item as any).key || "").trim();
              if (!key) return null;
              return {
                key,
                url: String((item as any).url || ""),
                link: String((item as any).link || ""),
              } as SliderItem;
            })
            .filter((item): item is SliderItem => Boolean(item))
        );
      } else {
        setSliderItems([]);
      }
    } catch {
      setSliderItems([]);
    }

    setLoading(false);
  };

  useEffect(() => {
    void loadSettings();
    return () => {
      pendingSliderItems.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSelectSliderFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const nextItems = files.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      link: "",
      previewUrl: URL.createObjectURL(file),
    }));

    setPendingSliderItems((prev) => [...prev, ...nextItems]);
    event.target.value = "";
  };

  const removePendingSliderItem = (id: string) => {
    setPendingSliderItems((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((item) => item.id !== id);
    });
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    const formData = new FormData();
    formData.append("setting_payment_gateway_id", paymentGatewayId.trim());
    formData.append("setting_payment_gateway_key", paymentGatewayKey.trim());
    formData.append("setting_registration_fee", registrationFee.trim());
    const normalizedKioskClients = kioskClients
      .map((item) => ({
        name: item.name.trim() || "Kiosk",
        token: item.token.trim(),
        isActive: item.isActive,
      }))
      .filter((item) => item.token);
    formData.append("setting_kiosk_api_clients", JSON.stringify(normalizedKioskClients));
    formData.append("setting_kiosk_api_token", normalizedKioskClients.find((item) => item.isActive)?.token || "");
    formData.append("setting_print_default_printer", defaultPrinter.trim());
    formData.append("setting_slider_images_metadata", JSON.stringify(sliderItems.map((item) => ({ key: item.key, link: item.link || "" }))));

    pendingSliderItems.forEach((item) => {
      formData.append("setting_slider_images_new_metadata", JSON.stringify({ link: item.link || "" }));
      formData.append("setting_slider_images_new_files", item.file);
    });

    const result = await updateContentSettings(formData);
    if (result.success) {
      setMessage("Global settings updated");
      pendingSliderItems.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      setPendingSliderItems([]);
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

          <div className="md:col-span-2 space-y-3 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Label>Kiosk API Clients</Label>
                <p className="mt-1 text-xs text-gray-500">
                  Anda bisa membuat banyak token kiosk. Setiap token bisa diberi nama dan diaktifkan/nonaktifkan.
                </p>
              </div>
              <button
                type="button"
                onClick={addKioskClient}
                disabled={saving || loading}
                className="rounded border border-brand-300 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50 dark:border-brand-800 dark:text-brand-300 dark:hover:bg-brand-900/30"
              >
                Tambah Kiosk Token
              </button>
            </div>

            {kioskClients.length === 0 ? (
              <p className="text-xs text-gray-500">Belum ada token kiosk. Tambahkan minimal 1 token untuk mengaktifkan API kiosk.</p>
            ) : (
              <div className="space-y-3">
                {kioskClients.map((client, index) => (
                  <div key={client.id} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                      <div className="md:col-span-3">
                        <Label>Nama Kiosk</Label>
                        <Input
                          value={client.name}
                          onChange={(e) => updateKioskClient(client.id, { name: e.target.value })}
                          placeholder={`Kiosk ${index + 1}`}
                        />
                      </div>

                      <div className="md:col-span-7">
                        <Label>Bearer Token</Label>
                        <Input
                          value={client.token}
                          onChange={(e) => updateKioskClient(client.id, { token: e.target.value })}
                          placeholder="kiosk_xxx"
                        />
                      </div>

                      <div className="md:col-span-2 flex items-end">
                        <label className="flex h-[42px] w-full items-center justify-center gap-2 rounded border border-gray-300 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-200">
                          <input
                            type="checkbox"
                            checked={client.isActive}
                            onChange={(e) => updateKioskClient(client.id, { isActive: e.target.checked })}
                          />
                          Active
                        </label>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => regenerateKioskClientToken(client.id)}
                        disabled={saving || loading}
                        className="rounded border border-brand-300 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50 dark:border-brand-800 dark:text-brand-300 dark:hover:bg-brand-900/30"
                      >
                        Regenerate Token
                      </button>
                      <button
                        type="button"
                        onClick={() => removeKioskClient(client.id)}
                        disabled={saving || loading}
                        className="rounded border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="md:col-span-2 space-y-3 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
            <div>
              <Label>Promo Slider (Admin CRUD)</Label>
              <p className="mt-1 text-xs text-gray-500">Klik banner di dashboard user akan membuka CTA URL yang Anda set di sini.</p>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {sliderItems.map((item) => (
                <div key={item.key} className="space-y-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                  {item.url ? <img src={item.url} alt="Slider" className="h-28 w-full rounded object-cover" /> : null}
                  <Input
                    value={item.link || ""}
                    onChange={(e) =>
                      setSliderItems((prev) => prev.map((x) => (x.key === item.key ? { ...x, link: e.target.value } : x)))
                    }
                    placeholder="CTA URL (https://...)"
                  />
                  <button
                    type="button"
                    onClick={() => setSliderItems((prev) => prev.filter((x) => x.key !== item.key))}
                    className="rounded border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    Hapus
                  </button>
                </div>
              ))}

              {pendingSliderItems.map((item) => (
                <div key={item.id} className="space-y-2 rounded-lg border border-dashed border-brand-300 p-3 dark:border-brand-700">
                  <img src={item.previewUrl} alt="New slider" className="h-28 w-full rounded object-cover" />
                  <Input
                    value={item.link}
                    onChange={(e) =>
                      setPendingSliderItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, link: e.target.value } : x)))
                    }
                    placeholder="CTA URL (optional)"
                  />
                  <button
                    type="button"
                    onClick={() => removePendingSliderItem(item.id)}
                    className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    Remove Upload
                  </button>
                </div>
              ))}
            </div>

            <label className="inline-flex cursor-pointer items-center gap-2 rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
              <input type="file" accept="image/*" multiple className="hidden" onChange={onSelectSliderFiles} />
              Tambah Gambar Slider
            </label>
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
