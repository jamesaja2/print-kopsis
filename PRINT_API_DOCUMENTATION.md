# Print API Documentation

Dokumentasi ini mencakup seluruh endpoint print (user, admin, kiosk, payment webhook, dan cron cleanup) pada aplikasi ini.

Untuk dokumen integrasi kiosk yang lebih fokus dan siap implementasi, lihat:

- `KIOSK_INTEGRATION_API.md`

## Base URL

- Development: http://localhost:3000
- Production: sesuaikan domain deployment

## Response Standard

Semua endpoint menggunakan format berikut:

```json
{
  "success": true,
  "data": {},
  "message": "..."
}
```

Jika gagal:

```json
{
  "success": false,
  "data": {},
  "message": "Error message"
}
```

## Authentication

### User/Auth Session

Endpoint user/admin memakai session (NextAuth).

- User endpoint: butuh user login
- Admin endpoint: butuh role ADMIN

### Kiosk Bearer Token

Endpoint kiosk memakai header:

```http
Authorization: Bearer <KIOSK_API_TOKEN>
```

Env:

- KIOSK_API_TOKEN

### Webhook Signature

Jika `PRINT_WEBHOOK_SIGNATURE` terisi, webhook wajib valid via:

- Header: `x-print-signature` atau `x-yogateway-signature`
- Atau field body: `signature`

### Cron Secret

Endpoint cron cleanup wajib:

```http
Authorization: Bearer <CRON_SECRET>
```

Env:

- CRON_SECRET

## Data Model (Print)

### Order Fields Penting

- id
- orderCode
- userId
- filePath
- originalFilename
- pages
- paperSize: A4 | F4
- colorMode: GRAYSCALE | COLOR
- duplexMode: SINGLE | LONG_EDGE | SHORT_EDGE
- orientation: PORTRAIT | LANDSCAPE
- previewZoom: integer (60..200)
- previewMargin: integer (0..40)
- copies
- totalPrice
- status: UPLOADED | PAID | PRINTING | COMPLETED | FAILED | EXPIRED
- expiresAt
- createdAt
- updatedAt

## Business Rules

1. Duplex hanya boleh untuk grayscale.
- Jika `color_mode = color`, maka `duplex_mode` wajib `single`.

2. Orientation/zoom/margin menjadi bagian opsi order.
- Disimpan di tabel order.
- Dikembalikan di API order dan kiosk order.

3. Payment URL flow.
- Setelah order dibuat di UI user, sistem auto memanggil endpoint pay dan redirect ke gateway.

4. Expiry.
- Order status PAID yang lewat 24 jam akan menjadi EXPIRED.

## Kiosk App Integration (Fokus)

Bagian ini adalah endpoint minimum yang biasanya dipakai aplikasi kiosk.

### A) Ambil order + file untuk dicetak

- Method: GET
- Path: `/api/kiosk/order/{orderCode}`
- Auth: `Authorization: Bearer <KIOSK_API_TOKEN>`

Tujuan:

- Validasi order code
- Pastikan order siap cetak (`PAID`)
- Dapatkan metadata print + URL file PDF

Contoh sukses:

```json
{
  "success": true,
  "data": {
    "id": "cma1...",
    "orderCode": "A1B2C3",
    "filePath": "https://.../preview.php?bucket=orders-xxx&key=...pdf",
    "originalFilename": "dokumen.pdf",
    "pages": 12,
    "copies": 2,
    "paperSize": "A4",
    "colorMode": "GRAYSCALE",
    "duplexMode": "LONG_EDGE",
    "orientation": "PORTRAIT",
    "previewZoom": 100,
    "previewMargin": 12,
    "status": "PAID",
    "expiresAt": "2026-03-13T10:10:00.000Z"
  },
  "message": "Order ready"
}
```

Catatan:

- `filePath` adalah URL file PDF yang bisa langsung dipakai app kiosk untuk render/print.
- Jika order tidak valid/expired, endpoint akan mengembalikan error.

### B) Tandai mulai cetak

- Method: POST
- Path: `/api/kiosk/order/{orderCode}/start`
- Auth: kiosk bearer token

Efek:

- Status order: `PAID -> PRINTING`

### C) Tandai selesai cetak

- Method: POST
- Path: `/api/kiosk/order/{orderCode}/complete`
- Auth: kiosk bearer token

Efek:

- Status order: `PRINTING -> COMPLETED`

### D) Tandai gagal cetak

- Method: POST
- Path: `/api/kiosk/order/{orderCode}/fail`
- Auth: kiosk bearer token

Efek:

- Status order: `PRINTING -> FAILED`

### E) Kiosk Flow yang direkomendasikan

1. User input `orderCode` di kiosk
2. Kiosk call GET `/api/kiosk/order/{orderCode}`
3. Jika sukses: download/render PDF dari `filePath`
4. Kiosk call POST `/start`
5. Jalankan proses printing di mesin
6. Jika sukses call POST `/complete`, jika gagal call POST `/fail`

## User Endpoints

### 1) List My Orders

- Method: GET
- Path: `/api/print/orders`
- Auth: user

Contoh sukses:

```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "status": "UPLOADED",
      "statusLabel": "Uploaded"
    }
  ],
  "message": "Orders retrieved"
}
```

### 2) Create Order

- Method: POST
- Path: `/api/print/orders`
- Auth: user
- Content-Type: multipart/form-data

Form fields:

- file: PDF file, required
- paper_size: A4 | F4
- color_mode: grayscale | color
- duplex_mode: single | long_edge | short_edge
- orientation: portrait | landscape
- preview_zoom: integer (60..200)
- preview_margin: integer (0..40)
- copies: integer (1..100)

Validasi penting:

- File wajib PDF
- Jika `color_mode = color`, `duplex_mode` harus `single`

Contoh response:

```json
{
  "success": true,
  "data": {
    "id": "cmm...",
    "status": "UPLOADED",
    "orientation": "PORTRAIT",
    "previewZoom": 100,
    "previewMargin": 12,
    "statusLabel": "Uploaded"
  },
  "message": "Order created"
}
```

### 3) Get My Order Detail

- Method: GET
- Path: `/api/print/orders/{orderId}`
- Auth: user

### 4) Initiate Payment

- Method: POST
- Path: `/api/print/orders/{orderId}/pay`
- Auth: user

Response data:

- orderId
- paymentId
- paymentUrl
- qrUrl
- gatewayTransactionId

### 4b) Check Payment Status (tanpa webhook)

- Method: POST
- Path: `/api/print/orders/{orderId}/check-status`
- Auth: user

Tujuan:

- Sinkron status transaksi langsung ke Paymenku via `check-status/{order_id}`
- Tidak perlu menunggu webhook

Contoh sukses:

```json
{
  "success": true,
  "data": {
    "orderId": "cma1...",
    "orderStatus": "PAID",
    "paymentStatus": "PAID",
    "gatewayStatus": "paid",
    "orderCode": "A1B2C3"
  },
  "message": "Payment status checked"
}
```

## Payment Webhook

### 5) Handle Payment Webhook

- Method: POST
- Path: `/api/print/payment/webhook`
- Auth: signature-based

Body umum (gateway):

- trxid
- status (SUCCESS/FAILED)
- signature (opsional jika tidak pakai header)

Efek:

- SUCCESS: payment -> PAID, order -> PAID, generate `orderCode`, set `expiresAt`
- selain SUCCESS: payment -> FAILED

## Kiosk Endpoints (Ringkas)

Prefix: `/api/kiosk/order`

- GET `/api/kiosk/order/{orderCode}`
- POST `/api/kiosk/order/{orderCode}/start`
- POST `/api/kiosk/order/{orderCode}/complete`
- POST `/api/kiosk/order/{orderCode}/fail`

## Admin Endpoints

Bagian ini yang paling relevan untuk operasional kiosk (monitoring dan kontrol).

### 10) List All Orders (with filter)

- Method: GET
- Path: `/api/admin/print/orders`
- Auth: admin

Query params:

- status
- userId
- from (ISO datetime)
- to (ISO datetime)

Kegunaan untuk kiosk ops:

- Monitor antrian order
- Filter status `PAID`/`PRINTING`/`FAILED`

### 11) Order Detail

- Method: GET
- Path: `/api/admin/print/orders/{orderId}`
- Auth: admin

Berisi:

- user
- payment
- statusHistories (timeline)

### 12) Update Order Status (manual)

- Method: PATCH
- Path: `/api/admin/print/orders/{orderId}/status`
- Auth: admin

Body:

```json
{
  "status": "PAID"
}
```

Kegunaan untuk kiosk ops:

- Manual override jika ada kendala perangkat
- Recovery status order saat troubleshooting di lapangan

### 13) Price Config - Get

- Method: GET
- Path: `/api/admin/print/price-config`
- Auth: admin

### 14) Price Config - Update

- Method: PATCH
- Path: `/api/admin/print/price-config`
- Auth: admin

Body:

```json
{
  "price_per_page_grayscale": 500,
  "price_per_page_color": 1000
}
```

Kegunaan untuk kiosk ops:

- Setting harga cetak per mode warna tanpa deploy ulang

### 15) Users List

- Method: GET
- Path: `/api/admin/print/users`
- Auth: admin

### 16) User Detail

- Method: GET
- Path: `/api/admin/print/users/{userId}`
- Auth: admin

### 17) Delete User

- Method: DELETE
- Path: `/api/admin/print/users/{userId}`
- Auth: admin

### 18) Sales Summary

- Method: GET
- Path: `/api/admin/print/sales-summary`
- Auth: admin

Mengembalikan:

- today: orders, revenue, from, to
- month: orders, revenue, from, to
- dailyBreakdown[]

Catatan:

- Timezone reporting: Asia/Jakarta
- Data source robust: payment PAID + fallback order status untuk data legacy yang belum sinkron

## Admin + Kiosk Operational Matrix

- Kiosk app print execution:
  - GET `/api/kiosk/order/{orderCode}`
  - POST `/api/kiosk/order/{orderCode}/start`
  - POST `/api/kiosk/order/{orderCode}/complete`
  - POST `/api/kiosk/order/{orderCode}/fail`

- Admin monitoring & control:
  - GET `/api/admin/print/orders`
  - GET `/api/admin/print/orders/{orderId}`
  - PATCH `/api/admin/print/orders/{orderId}/status`

- Admin settings:
  - GET `/api/admin/print/price-config`
  - PATCH `/api/admin/print/price-config`

- User payment sync (tanpa webhook):
  - POST `/api/print/orders/{orderId}/check-status`

## Cron Endpoint

### 19) Cleanup Orders

- Method: GET
- Path: `/api/cron/orders-cleanup`
- Auth: bearer CRON_SECRET

Aksi:

- Expire paid order yang lewat 24 jam
- Hapus file lama (>3 hari) untuk status COMPLETED/EXPIRED/FAILED
- Set `filePath = null` setelah cleanup

## Suggested Route Map (Ringkas)

- User:
  - GET `/api/print/orders`
  - POST `/api/print/orders`
  - GET `/api/print/orders/{orderId}`
  - POST `/api/print/orders/{orderId}/pay`
  - POST `/api/print/orders/{orderId}/check-status`

- Admin:
  - GET `/api/admin/print/orders`
  - GET `/api/admin/print/orders/{orderId}`
  - PATCH `/api/admin/print/orders/{orderId}/status`
  - GET `/api/admin/print/price-config`
  - PATCH `/api/admin/print/price-config`
  - GET `/api/admin/print/users`
  - GET `/api/admin/print/users/{userId}`
  - DELETE `/api/admin/print/users/{userId}`
  - GET `/api/admin/print/sales-summary`

- Kiosk:
  - GET `/api/kiosk/order/{orderCode}`
  - POST `/api/kiosk/order/{orderCode}/start`
  - POST `/api/kiosk/order/{orderCode}/complete`
  - POST `/api/kiosk/order/{orderCode}/fail`

- Webhook:
  - POST `/api/print/payment/webhook`

- Cron:
  - GET `/api/cron/orders-cleanup`

## Migration Required

Karena ada field baru pada `Order`, jalankan migrasi:

```bash
npx prisma migrate dev --name add_print_layout_settings
npx prisma generate
```

Jika production:

```bash
npx prisma migrate deploy
npx prisma generate
```
