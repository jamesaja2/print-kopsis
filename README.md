# Print Kopsis

Sistem manajemen print order berbasis Next.js untuk admin panel, user order flow, dan integrasi kiosk.

## Fitur Utama

- Manajemen order print end-to-end: upload, pricing, payment, hingga status cetak.
- Dashboard admin untuk monitoring order, users, sales summary, dan override status.
- Integrasi payment gateway (Paymenku) dengan check-status sinkron tanpa bergantung penuh pada webhook.
- Integrasi kiosk API berbasis bearer token untuk alur start/complete/fail printing.
- Global settings di admin untuk payment gateway, registration fee, dan kiosk token.

## Stack

- Next.js (App Router) + TypeScript
- Prisma ORM + PostgreSQL
- NextAuth untuk autentikasi
- Tailwind CSS untuk UI

## Menjalankan Lokal

1. Clone repository:

```bash
git clone https://github.com/jamesaja2/print-kopsis.git
cd print-kopsis
```

2. Install dependency:

```bash
npm install
```

3. Buat file environment:

```bash
cp .env.example .env
```

4. Isi variabel penting di `.env` minimal:

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `FILE_SERVER_BASE_URL` (jika digunakan)
- `PAYMENKU_API_KEY` (opsional jika tidak disimpan di Global Settings)
- `KIOSK_API_TOKEN` (fallback jika belum diset di Global Settings)

5. Sinkronkan schema database:

```bash
npx prisma db push
```

6. Jalankan aplikasi:

```bash
npm run dev
```

## Build Production

```bash
npm run build
npm run start
```

## Catatan Operasional

- Kiosk token bisa diatur dari halaman admin Global Settings.
- Payment status user dapat disinkronkan aktif lewat endpoint check-status (selain webhook callback).
