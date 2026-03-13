# Kiosk Integration API

Dokumen ini fokus untuk integrasi aplikasi kiosk dan operasional admin print.

## 1) Base

- Development: `http://localhost:3000`
- Production: sesuaikan domain deployment

Semua response API memakai format:

```json
{
  "success": true,
  "data": {},
  "message": "..."
}
```

Error:

```json
{
  "success": false,
  "data": {},
  "message": "..."
}
```

## 2) Authentication

### Kiosk

Header wajib:

```http
Authorization: Bearer <KIOSK_API_TOKEN>
```

Sumber token (prioritas):

- Admin Dashboard -> Global Settings -> `kiosk_api_token`
- Fallback env: `KIOSK_API_TOKEN`

### Admin

- Menggunakan auth session (role `ADMIN`).
- Endpoint admin tidak menggunakan bearer kiosk.

### User (untuk payment sync)

- Menggunakan auth session user login.

## 3) Status Lifecycle

Status order print:

- `UPLOADED` -> file dan opsi tercatat, belum lunas
- `PAID` -> siap dicetak di kiosk
- `PRINTING` -> kiosk sudah mulai cetak
- `COMPLETED` -> cetak sukses
- `FAILED` -> cetak gagal
- `EXPIRED` -> melewati batas waktu

Transisi kiosk:

- `PAID -> PRINTING` via endpoint `start`
- `PRINTING -> COMPLETED` via endpoint `complete`
- `PRINTING -> FAILED` via endpoint `fail`

## 4) Endpoint Kiosk (Core)

Prefix: `/api/kiosk/order`

### 4.1 Get Order by Code

- Method: `GET`
- Path: `/api/kiosk/order/{orderCode}`
- Auth: bearer kiosk

Kegunaan:

- Validasi order code
- Cek order siap cetak
- Ambil file PDF (`filePath`) + semua parameter cetak

Contoh request:

```bash
curl -X GET "https://your-domain.com/api/kiosk/order/A1B2C3" \
  -H "Authorization: Bearer YOUR_KIOSK_TOKEN"
```

Contoh sukses:

```json
{
  "success": true,
  "data": {
    "id": "cm8x...",
    "orderCode": "A1B2C3",
    "filePath": "https://files.example.com/preview.php?bucket=orders-user123&key=1741846000-doc.pdf",
    "originalFilename": "doc.pdf",
    "pages": 8,
    "paperSize": "A4",
    "colorMode": "GRAYSCALE",
    "duplexMode": "LONG_EDGE",
    "orientation": "PORTRAIT",
    "previewZoom": 100,
    "previewMargin": 12,
    "copies": 2,
    "totalPrice": "8000",
    "status": "PAID",
    "expiresAt": "2026-03-13T09:55:00.000Z",
    "statusLabel": "Paid"
  },
  "message": "Order ready"
}
```

Kemungkinan error:

- `401`: Unauthorized (token salah/tidak ada)
- `404`: Order not found
- `400`: Order is not ready for printing
- `410`: Order expired

### 4.2 Start Printing

- Method: `POST`
- Path: `/api/kiosk/order/{orderCode}/start`
- Auth: bearer kiosk

Contoh sukses:

```json
{
  "success": true,
  "data": {
    "orderId": "cm8x...",
    "status": "PRINTING"
  },
  "message": "Printing started"
}
```

### 4.3 Complete Printing

- Method: `POST`
- Path: `/api/kiosk/order/{orderCode}/complete`
- Auth: bearer kiosk

Contoh sukses:

```json
{
  "success": true,
  "data": {
    "orderId": "cm8x...",
    "status": "COMPLETED"
  },
  "message": "Printing completed"
}
```

### 4.4 Fail Printing

- Method: `POST`
- Path: `/api/kiosk/order/{orderCode}/fail`
- Auth: bearer kiosk

Contoh sukses:

```json
{
  "success": true,
  "data": {
    "orderId": "cm8x...",
    "status": "FAILED"
  },
  "message": "Printing marked as failed"
}
```

## 5) Payment Sync (Tanpa Mengandalkan Webhook)

Endpoint ini dipakai aplikasi user/frontend agar status payment tersinkron langsung ke gateway Paymenku.

### 5.1 Check Payment Status

- Method: `POST`
- Path: `/api/print/orders/{orderId}/check-status`
- Auth: user session

Fungsi:

- Memanggil Paymenku `GET /api/v1/check-status/{order_id}`
- Jika `paid`, sistem akan:
  - update payment ke `PAID`
  - update order ke `PAID`
  - generate `orderCode`

Contoh sukses:

```json
{
  "success": true,
  "data": {
    "orderId": "cm8x...",
    "orderStatus": "PAID",
    "paymentStatus": "PAID",
    "gatewayStatus": "paid",
    "orderCode": "A1B2C3"
  },
  "message": "Payment status checked"
}
```

## 6) Admin Operational API

Endpoint admin untuk monitoring kiosk, setting harga, dan override status.

### 6.1 List Orders (filter)

- Method: `GET`
- Path: `/api/admin/print/orders`
- Query:
  - `status`
  - `userId`
  - `from` (ISO datetime)
  - `to` (ISO datetime)

Use case:

- Monitor order aktif (`PAID`, `PRINTING`)
- Lihat order gagal (`FAILED`)

### 6.2 Order Detail

- Method: `GET`
- Path: `/api/admin/print/orders/{orderId}`

Mengembalikan:

- order detail
- payment object
- user object
- `statusHistories` (timeline)

### 6.3 Manual Override Status

- Method: `PATCH`
- Path: `/api/admin/print/orders/{orderId}/status`
- Body:

```json
{
  "status": "PAID"
}
```

Allowed value:

- `UPLOADED`, `PAID`, `PRINTING`, `COMPLETED`, `FAILED`, `EXPIRED`

Use case:

- Recovery saat perangkat kiosk error
- Koreksi status saat troubleshooting

### 6.4 Price Config (Admin Setting)

Get current config:

- Method: `GET`
- Path: `/api/admin/print/price-config`

Update config:

- Method: `PATCH`
- Path: `/api/admin/print/price-config`
- Body:

```json
{
  "price_per_page_grayscale": 500,
  "price_per_page_color": 1000
}
```

### 6.5 Print Users

List users:

- Method: `GET`
- Path: `/api/admin/print/users`

User detail + order list:

- Method: `GET`
- Path: `/api/admin/print/users/{userId}`

Delete user:

- Method: `DELETE`
- Path: `/api/admin/print/users/{userId}`

### 6.6 Sales Summary

- Method: `GET`
- Path: `/api/admin/print/sales-summary`

## 7) End-to-End Flow (Recommended)

### Flow kiosk printing

1. Kiosk input kode order (`orderCode`).
2. Call `GET /api/kiosk/order/{orderCode}`.
3. Jika sukses, download/render PDF dari `filePath`.
4. Call `POST /api/kiosk/order/{orderCode}/start`.
5. Cetak dokumen.
6. Jika sukses call `POST /complete`, jika gagal call `POST /fail`.

### Flow payment sampai siap kiosk

1. User create order -> status `UPLOADED`.
2. User initiate pay -> dapat `qrUrl`.
3. Frontend polling `POST /api/print/orders/{orderId}/check-status`.
4. Saat gateway `paid`, sistem set order `PAID` + generate `orderCode`.
5. Kiosk bisa akses order via kode tersebut.

## 8) Quick Route Index

### Kiosk

- `GET /api/kiosk/order/{orderCode}`
- `POST /api/kiosk/order/{orderCode}/start`
- `POST /api/kiosk/order/{orderCode}/complete`
- `POST /api/kiosk/order/{orderCode}/fail`

### User print

- `GET /api/print/orders`
- `POST /api/print/orders`
- `GET /api/print/orders/{orderId}`
- `POST /api/print/orders/{orderId}/pay`
- `POST /api/print/orders/{orderId}/check-status`

### Admin print

- `GET /api/admin/print/orders`
- `GET /api/admin/print/orders/{orderId}`
- `PATCH /api/admin/print/orders/{orderId}/status`
- `GET /api/admin/print/price-config`
- `PATCH /api/admin/print/price-config`
- `GET /api/admin/print/users`
- `GET /api/admin/print/users/{userId}`
- `DELETE /api/admin/print/users/{userId}`
- `GET /api/admin/print/sales-summary`

## 9) Troubleshooting

### Kiosk selalu 401

- Cek `KIOSK_API_TOKEN` di environment backend
- Pastikan header `Authorization: Bearer ...` terkirim

### Kode benar tapi dapat 400 "Order is not ready for printing"

- Order belum `PAID`
- Jalankan sinkron payment dari sisi user (`check-status`)

### Kode dapat 410 expired

- Order sudah melewati batas waktu `expiresAt`
- User harus buat order/payment baru

### filePath kosong/null

- Kemungkinan file sudah dibersihkan oleh cleanup job
- Minta user upload ulang
