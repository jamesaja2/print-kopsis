> You are a senior full-stack Laravel engineer.
> I already have a working Laravel application with authentication, role-based access control (`admin`, `user`), and a TailAdmin UI template already integrated. Do **NOT** generate any UI layout, Blade views, or frontend code.
> I want you to **build the backend** for a **web-to-print kiosk system** with the following requirements:

---

#### 1. User Flow

* User uploads a PDF file
* System reads the PDF and extracts the **page count** automatically
* User selects print options:

  * `paper_size`: `A4` or `F4`
  * `color_mode`: `grayscale` or `color`
  * `duplex_mode`: `single`, `long_edge`, or `short_edge`
  * `copies`: integer, minimum 1
* System calculates **total price** based on page count, copies, and color mode
* User proceeds to **payment**
* After payment is confirmed, system generates a **unique 6-character uppercase order code**
* User enters the code at the physical kiosk to trigger printing

---

#### 2. Pricing Logic

* Price is configurable by admin (stored in database, not hardcoded)
* Pricing fields:

  * `price_per_page_grayscale`
  * `price_per_page_color`
* Formula:

  ```
  total_price = pages × copies × price_per_page_{color_mode}
  ```
* Pricing config must be updatable via Admin Panel without code changes

---

#### 3. Order Lifecycle

Order statuses (in order):

| Status | Description |
|---|---|
| `uploaded` | PDF uploaded, options not yet confirmed |
| `paid` | Payment confirmed |
| `printing` | Kiosk has started printing |
| `completed` | Printing finished successfully |
| `failed` | Printing failed at kiosk |
| `expired` | Order not printed within allowed time window |

* An order can **only be printed once** — once status moves to `printing`, it cannot be reset
* Orders with status `paid` that are older than **24 hours** should be auto-expired

---

#### 4. Database Tables

Generate migrations for the following tables:

**`users`** — already exists, extend if needed (do not recreate)

**`price_configs`**

* `id`
* `price_per_page_grayscale` (decimal)
* `price_per_page_color` (decimal)
* `updated_at`, `created_at`

**`orders`**

* `id`
* `order_code` — unique, 6 uppercase characters, generated after payment
* `user_id` — foreign key to users
* `file_path` — path in Laravel storage
* `original_filename` — original uploaded filename
* `pages` — integer, extracted from PDF
* `paper_size` — enum: `A4`, `F4`
* `color_mode` — enum: `grayscale`, `color`
* `duplex_mode` — enum: `single`, `long_edge`, `short_edge`
* `copies` — integer
* `total_price` — decimal
* `status` — enum: `uploaded`, `paid`, `printing`, `completed`, `failed`, `expired`
* `expires_at` — timestamp (set to 24h after payment)
* `created_at`, `updated_at`

**`payments`**

* `id`
* `order_id` — foreign key to orders
* `payment_gateway` — string (e.g., `YoGateway`)
* `gateway_transaction_id` — string, nullable
* `amount` — decimal
* `status` — enum: `pending`, `paid`, `failed`
* `payload` — JSON (raw gateway response, for debugging)
* `paid_at` — timestamp, nullable
* `created_at`, `updated_at`

---

#### 5. Models

Generate Eloquent models with:

* Proper `$fillable` fields
* Relationships:

  * `Order` belongsTo `User`
  * `Order` hasOne `Payment`
  * `Payment` belongsTo `Order`
  * `User` hasMany `Orders`
* Casts for enums and JSON fields
* Accessor for `status_label` (human-readable status)

---

#### 6. Services

Create an `OrderService` class in `app/Services/` with the following methods:

* `createOrder(User $user, UploadedFile $file, array $options): Order`

  * Validates PDF
  * Extracts page count using shell or library
  * Stores file in `storage/app/private/orders/{user_id}/`
  * Calculates total price from `PriceConfig`
  * Creates order with status `uploaded`

* `generateOrderCode(): string`

  * Generates a unique 6-character uppercase alphanumeric string
  * Retries if collision occurs

* `confirmPayment(Order $order, array $gatewayPayload): Order`

  * Marks payment as `paid`
  * Generates and assigns `order_code`
  * Sets `expires_at` to now + 24 hours
  * Updates order status to `paid`

* `calculatePrice(int $pages, int $copies, string $colorMode): float`

  * Reads from latest `PriceConfig`
  * Returns calculated total

---

#### 7. Controllers

Generate the following controllers (no views, JSON responses only for API, redirect/session for web):

**`OrderController`** (web, auth-protected)

* `store` — handles PDF upload + option selection, creates order, returns order details
* `show` — returns order details for authenticated user
* `index` — lists all orders for authenticated user

**`PaymentController`** (web, auth-protected)

* `initiate(Order $order)` — creates payment record, calls YoGateway, returns payment URL or QRIS
* `webhook(Request $request)` — receives payment callback from YoGateway, validates signature, calls `OrderService::confirmPayment()`

**`KioskController`** (API, Bearer token protected)

* `GET /api/kiosk/order/{order_code}` — returns order details if status is `paid`
* `POST /api/kiosk/order/{order_code}/start` — sets status to `printing`
* `POST /api/kiosk/order/{order_code}/complete` — sets status to `completed`
* `POST /api/kiosk/order/{order_code}/fail` — sets status to `failed`

**`Admin/OrderController`** (web, admin-only)

* `index` — list all orders with filters (status, date, user)
* `show` — view order detail
* `updateStatus` — manually override order status (for support/debugging)

**`Admin/PriceConfigController`** (web, admin-only)

* `index` — show current price config
* `update` — update grayscale/color price per page

**`Admin/UserController`** (web, admin-only)

* `index` — list all users
* `show` — view user with their orders
* `destroy` — delete user

---

#### 8. API Routes

```php
// Kiosk API (protected by Bearer token via sanctum or custom middleware)
Route::prefix('api/kiosk')->middleware('auth.kiosk')->group(function () {
    Route::get('order/{order_code}', [KioskController::class, 'show']);
    Route::post('order/{order_code}/start', [KioskController::class, 'start']);
    Route::post('order/{order_code}/complete', [KioskController::class, 'complete']);
    Route::post('order/{order_code}/fail', [KioskController::class, 'fail']);
});

// Payment webhook (no auth, validated by signature)
Route::post('payment/webhook', [PaymentController::class, 'webhook']);

// Web routes (auth-protected)
Route::middleware('auth')->group(function () {
    Route::resource('orders', OrderController::class)->only(['index', 'store', 'show']);
    Route::post('orders/{order}/pay', [PaymentController::class, 'initiate']);
});

// Admin routes
Route::prefix('admin')->middleware(['auth', 'role:admin'])->group(function () {
    Route::resource('orders', Admin\OrderController::class)->only(['index', 'show']);
    Route::patch('orders/{order}/status', [Admin\OrderController::class, 'updateStatus']);
    Route::get('price-config', [Admin\PriceConfigController::class, 'index']);
    Route::patch('price-config', [Admin\PriceConfigController::class, 'update']);
    Route::resource('users', Admin\UserController::class)->only(['index', 'show', 'destroy']);
});
```

---

#### 9. Kiosk Authentication Middleware

* Create a custom middleware `AuthKiosk`
* Reads `Authorization: Bearer {token}` from request header
* Token is stored as a single value in `config/kiosk.php` or `.env` as `KIOSK_API_TOKEN`
* Returns `401` if token is missing or invalid

---

#### 10. File Cleanup — Scheduled Command

Create an Artisan command `orders:cleanup` in `app/Console/Commands/`:

* Runs daily via Laravel Scheduler
* Deletes files from storage where:

  * Order status is `completed` or `expired` or `failed`
  * `created_at` is older than **3 days**
* After deleting file, sets `file_path` to `null` on the order
* Also finds orders with status `paid` and `expires_at` < now → sets status to `expired`
* Register in `app/Console/Kernel.php`:

  ```php
  $schedule->command('orders:cleanup')->daily();
  ```

---

#### 11. Validation Rules

**PDF Upload:**

* `file_path`: required, mimes:pdf, max:20480 (20MB)
* `paper_size`: required, in:A4,F4
* `color_mode`: required, in:grayscale,color
* `duplex_mode`: required, in:single,long_edge,short_edge
* `copies`: required, integer, min:1, max:100

**Price Config Update (admin):**

* `price_per_page_grayscale`: required, numeric, min:0
* `price_per_page_color`: required, numeric, min:0

---

#### 12. Technical Expectations

* Do **not** generate any Blade views or frontend HTML
* All API responses must use consistent JSON format:

  ```json
  { "success": true, "data": {}, "message": "..." }
  ```
* Use **Form Request classes** for all validation (not inline `$request->validate()`)
* Use **Policy or Gate** to ensure users can only access their own orders
* PDF page extraction via `pdfinfo` shell command (from `poppler-utils`) or `smalot/pdfparser` — whichever is available; wrap in a `PdfService` class
* Order code generation must be **collision-safe** (use DB unique constraint + retry loop)
* All file storage must use Laravel's `Storage` facade — never hardcode paths
* Follow **Repository pattern** if adding database query abstraction; otherwise, keep logic in Service classes
* Code must be modular: Services handle business logic, Controllers handle HTTP, Models handle data