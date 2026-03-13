POST
Create Transaction
Endpoint:
https://paymenku.com/api/v1/transaction/create
Headers:
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
Request Body Parameters:
Parameter	Type	Required	Description
reference_id	string	✓	ID unik dari sistem Anda
amount	number	✓	Jumlah pembayaran (min: 1000)
customer_name	string	✓	Nama customer
customer_email	email	✓	Email customer
customer_phone	string	-	No. HP customer (wajib utk OVO)
channel_code	string	✓	Kode payment channel
return_url	url	✓	URL redirect stlh pembayaran


GET
Get Payment Channels
Endpoint:
https://paymenku.com/api/v1/payment-channels
Headers:
Authorization: Bearer YOUR_API_KEY
cURL:
curl -X GET https://paymenku.com/api/v1/payment-channels \
  -H "Authorization: Bearer YOUR_API_KEY"


GET
Check Transaction Status
Endpoint:
https://paymenku.com/api/v1/check-status/{order_id}
Headers:
Authorization: Bearer YOUR_API_KEY
Path Parameters:
Parameter	Type	Description
order_id	string	Transaction ID (IDP...) atau Reference ID dari sistem Anda
cURL:
curl -X GET https://paymenku.com/api/v1/check-status/IDP202602271039768990 \
  -H "Authorization: Bearer YOUR_API_KEY"
Payment Channels Tersedia
Code	Nama	Type	Fee
bri_va	BRI Virtual Account	va	Rp 4.440 + 0.20%
bni_va	BNI Virtual Account	va	Rp 4.440 + 0.20%
cimb_va	CIMB Virtual Account	va	Rp 4.440 + 0.20%
qris	QRIS	qris	Rp 200 + 0.70%
danamon_va	Danamon Virtual Account	va	Rp 4.440 + 0.70%
dana	DANA	ewallet	Rp 200 + 3.00%
bsi_va	BSI Virtual Account	va	Rp 4.440 + 0.20%
mandiri_va	Mandiri Virtual Account	va	Rp 4.440 + 0.20%
linkaja	LinkAja	ewallet	Rp 200 + 3.00%
bjb_va	BJB Virtual Account	va	Rp 4.440 + 0.20%
permata_va	Permata Virtual Account	va	Rp 4.440 + 0.20%
WEBHOOK
Webhook Notification
Kami akan mengirim notifikasi ke Callback URL Anda saat status transaksi berubah.

Callback URL Anda:
Belum diset - Atur di halaman Merchant
Webhook Payload (POST request content):
{
  "event": "payment.status_updated",
  "trx_id": "IDP202602271039768990",
  "reference_id": "INV-001",
  "status": "paid",
  "amount": "100000.00",
  "total_fee": "4000.00",
  "amount_received": "96000.00",
  "payment_channel": "bca_va",
  "customer_name": "John Doe",
  "customer_email": "john@example.com",
  "paid_at": "2026-01-18T03:33:18.000000Z",
  "created_at": "2026-01-18T03:31:30.000000Z"
}
Status Values:
pending
paid
expired
cancelled
Contoh cURL & Response

Virtual Account

E-Wallet

QRIS

Get Channels

Check Status
Create Virtual Account Transaction
curl -X POST https://paymenku.com/api/v1/transaction/create \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "reference_id": "INV-001",
    "amount": 100000,
    "customer_name": "John Doe",
    "customer_email": "john@example.com",
    "customer_phone": "08123456789",
    "channel_code": "bca_va",
    "return_url": "https://yoursite.com/payment-done"
  }'
Response:
{
  "status": "success",
  "data": {
    "trx_id": "IDP202602271039768990",
    "reference_id": "INV-001",
    "amount": "104000.00",
    "status": "pending",
    "pay_url": "https://paymenku.com/pay/IDP202602271039768990",
    "payment_info": {
      "transaction_id": "eafe8add-3758-4296-xxxx",
      "transaction_status": "pending",
      "bank": "BCA",
      "va_number": "381659999814525",
      "expiration_date": "2026-01-19T03:43:30.000Z"
    }
  }
}
© 2026 Paymenku.com. All rights reserved.

