# API Documentation — S3-like Object Storage

**Version:** 1.0  
**Base URL:** `https://example.com` *(replace with your actual domain)*  
**PHP:** 8.0+, no framework, no dependencies

---

## Table of Contents

1. [Authentication](#authentication)
2. [Error Format](#error-format)
3. [Upload Object](#1-upload-object)
4. [Preview / Serve File](#2-preview--serve-file)
5. [Get Object Metadata](#3-get-object-metadata)
6. [Get Object (redirect)](#4-get-object-redirect)
7. [List Objects in Bucket](#5-list-objects-in-bucket)
8. [List All Buckets](#6-list-all-buckets)
9. [Delete Object](#7-delete-object)
10. [Naming Rules](#naming-rules)
11. [Allowed File Types](#allowed-file-types)
12. [HTTP Status Code Reference](#http-status-code-reference)

---

## Authentication

> **`preview.php` is public** — no key required (so shared links open in the browser).  
> **All `/api/*` endpoints require authentication.**

### Method

Pass your API key in the `X-Api-Key` HTTP header (recommended):

```
X-Api-Key: your-secret-key
```

Or as a fallback query/body parameter `api_key` (avoid in production):

```
GET /api/list.php?bucket=docs&api_key=your-secret-key
```

### Configure the key

Open `public_html/api/config.php` and set:

```php
define('API_KEY', 'your-secret-key-here');
```

Generate a strong key:

```bash
openssl rand -hex 40
```

### Auth error responses

| Condition | Status | Message |
|---|---|---|
| Key not configured on server | `500` | `API key has not been configured on the server.` |
| Missing or wrong key | `401` | `Unauthorized. Invalid or missing API key.` |

---

## Error Format

All error responses are JSON with the following structure:

```json
{
  "status": "error",
  "message": "Human-readable error description."
}
```

Some errors include additional fields, e.g.:

```json
{
  "status": "error",
  "message": "File type not allowed.",
  "allowed": ["pdf", "png", "jpg", "..."]
}
```

---

## 1. Upload Object

Upload a file into a bucket. The bucket is created automatically if it does not exist.

### Request

```
POST /api/upload.php
Content-Type: multipart/form-data
X-Api-Key: your-secret-key
```

| Parameter | Type   | Required | Description |
|-----------|--------|----------|-------------|
| `bucket`  | string | ✅       | Target bucket name (3–63 chars, see [Naming Rules](#naming-rules)) |
| `file`    | file   | ✅       | The file to upload (max 100 MB) |

### Success Response — `200 OK`

```json
{
  "status": "success",
  "bucket": "documents",
  "key":    "6613a8f1.23456_report.pdf",
  "url":    "https://example.com/preview.php?bucket=documents&key=6613a8f1.23456_report.pdf",
  "size":   204800
}
```

| Field    | Type    | Description |
|----------|---------|-------------|
| `status` | string  | `"success"` |
| `bucket` | string  | Bucket where the file was stored |
| `key`    | string  | Auto-generated unique filename |
| `url`    | string  | Public preview URL |
| `size`   | integer | File size in bytes |

### Error Responses

| Status | Cause |
|--------|-------|
| `400`  | Missing `bucket` or `file` param, invalid bucket name |
| `401`  | Missing or wrong API key |
| `405`  | Non-POST request |
| `413`  | File exceeds 100 MB limit |
| `415`  | File extension not in whitelist, or forbidden MIME type detected |
| `500`  | Server could not create bucket or save file |

### cURL Example

```bash
curl -X POST https://example.com/api/upload.php \
  -H "X-Api-Key: your-secret-key" \
  -F "bucket=documents" \
  -F "file=@/path/to/report.pdf"
```

### JavaScript (fetch) Example

```javascript
const form = new FormData();
form.append('bucket', 'documents');
form.append('file', fileInput.files[0]);

const res = await fetch('https://example.com/api/upload.php', {
  method: 'POST',
  headers: { 'X-Api-Key': 'your-secret-key' },
  body: form,
});

const data = await res.json();
console.log(data.url); // preview link
```

---

## 2. Preview / Serve File

Serve a stored file directly in the browser (inline). No API key required — this endpoint is intentionally public so preview links can be shared freely.

### Request

```
GET /preview.php?bucket={bucket}&key={key}
```

| Parameter | Type   | Required | Description |
|-----------|--------|----------|-------------|
| `bucket`  | string | ✅       | Bucket name |
| `key`     | string | ✅       | Object key (filename) |

### Behavior

| File type | Browser behavior |
|-----------|-----------------|
| `pdf`     | Opens in PDF reader (inline) |
| `png`, `jpg`, `jpeg`, `gif`, `webp`, `svg` | Displayed as image (inline) |
| `mp4`, `webm` | Played in video player (inline, supports scrubbing) |
| `mp3`, `ogg`, `wav` | Played in audio player (inline) |
| `txt`, `html`, `htm` | Rendered as text/HTML (inline) |
| `json`, `xml` | Rendered as plain text (inline) |
| All other allowed types | Forced download (`attachment`) |

### Response Headers

```
HTTP/1.1 200 OK
Content-Type: application/pdf
Content-Disposition: inline; filename="report.pdf"
Content-Length: 204800
Accept-Ranges: bytes
Cache-Control: public, max-age=3600
ETag: "5d41402abc4b2a76b9719d911017c592"
X-Content-Type-Options: nosniff
```

### HTTP Range Requests (streaming)

Video and audio files support seeking/scrubbing via the standard `Range` header:

```
Range: bytes=0-1048575
```

The server responds with `206 Partial Content`:

```
HTTP/1.1 206 Partial Content
Content-Range: bytes 0-1048575/10485760
Content-Length: 1048576
```

### Caching

The server sets an `ETag` header. Subsequent requests with `If-None-Match` matching the ETag receive `304 Not Modified` with no body.

### Error Responses

| Status | Cause |
|--------|-------|
| `400`  | Missing `bucket` or `key`, invalid name format |
| `403`  | Path traversal attempt detected |
| `404`  | Bucket or object not found |
| `416`  | Invalid `Range` header |
| `500`  | Storage configuration error |

### Example URLs

```
# Open PDF in browser
https://example.com/preview.php?bucket=documents&key=6613a8f1.23456_report.pdf

# Display image
https://example.com/preview.php?bucket=photos&key=6613a8f1.23456_photo.jpg

# Stream video
https://example.com/preview.php?bucket=videos&key=6613a8f1.23456_clip.mp4
```

### HTML Embed Examples

```html
<!-- Image -->
<img src="https://example.com/preview.php?bucket=photos&key=abc_photo.jpg" alt="Photo">

<!-- PDF (iframe) -->
<iframe src="https://example.com/preview.php?bucket=docs&key=abc_report.pdf"
        width="100%" height="600px"></iframe>

<!-- Video -->
<video controls>
  <source src="https://example.com/preview.php?bucket=videos&key=abc_clip.mp4"
          type="video/mp4">
</video>

<!-- Audio -->
<audio controls>
  <source src="https://example.com/preview.php?bucket=audio&key=abc_song.mp3"
          type="audio/mpeg">
</audio>
```

---

## 3. Get Object Metadata

Return JSON metadata about a stored object without downloading the file.

### Request

```
GET /api/get.php?bucket={bucket}&key={key}&action=info
X-Api-Key: your-secret-key
```

| Parameter | Type   | Required | Description |
|-----------|--------|----------|-------------|
| `bucket`  | string | ✅       | Bucket name |
| `key`     | string | ✅       | Object key |
| `action`  | string | ✅       | Must be `info` to get JSON (omit to redirect instead) |

### Success Response — `200 OK`

```json
{
  "status":   "success",
  "bucket":   "documents",
  "key":      "6613a8f1.23456_report.pdf",
  "url":      "https://example.com/preview.php?bucket=documents&key=6613a8f1.23456_report.pdf",
  "size":     204800,
  "mime":     "application/pdf",
  "modified": "2026-03-12T14:00:00+00:00"
}
```

| Field      | Type    | Description |
|------------|---------|-------------|
| `status`   | string  | `"success"` |
| `bucket`   | string  | Bucket name |
| `key`      | string  | Object key |
| `url`      | string  | Public preview URL |
| `size`     | integer | File size in bytes |
| `mime`     | string  | Detected MIME type |
| `modified` | string  | Last-modified timestamp (ISO 8601 / RFC 3339) |

### Error Responses

| Status | Cause |
|--------|-------|
| `400`  | Missing or invalid `bucket` / `key` |
| `401`  | Missing or wrong API key |
| `403`  | Path traversal attempt |
| `404`  | Object not found |
| `405`  | Non-GET request |

### cURL Example

```bash
curl "https://example.com/api/get.php?bucket=documents&key=6613a8f1.23456_report.pdf&action=info" \
  -H "X-Api-Key: your-secret-key"
```

---

## 4. Get Object (redirect)

Redirect the browser to `preview.php` for a given object. Useful as a stable API URL that always resolves to the preview.

### Request

```
GET /api/get.php?bucket={bucket}&key={key}
X-Api-Key: your-secret-key
```

*(Omit `action=info` to trigger the redirect)*

### Response — `302 Found`

```
Location: https://example.com/preview.php?bucket=documents&key=6613a8f1.23456_report.pdf
```

---

## 5. List Objects in Bucket

Return a JSON list of all files stored in a bucket, sorted newest-first.

### Request

```
GET /api/list.php?bucket={bucket}
X-Api-Key: your-secret-key
```

| Parameter | Type   | Required | Description |
|-----------|--------|----------|-------------|
| `bucket`  | string | ✅       | Bucket to list |

### Success Response — `200 OK`

```json
{
  "status": "success",
  "bucket": "documents",
  "count":  2,
  "files": [
    {
      "key":      "6613a8f1.23456_report.pdf",
      "url":      "https://example.com/preview.php?bucket=documents&key=6613a8f1.23456_report.pdf",
      "size":     204800,
      "modified": "2026-03-12T14:00:00+00:00"
    },
    {
      "key":      "5502b7e0.12345_invoice.pdf",
      "url":      "https://example.com/preview.php?bucket=documents&key=5502b7e0.12345_invoice.pdf",
      "size":     98304,
      "modified": "2026-03-10T09:30:00+00:00"
    }
  ]
}
```

| Field    | Type    | Description |
|----------|---------|-------------|
| `status` | string  | `"success"` |
| `bucket` | string  | Bucket name |
| `count`  | integer | Number of files |
| `files`  | array   | Array of file objects (see below) |

**Each file object:**

| Field      | Type    | Description |
|------------|---------|-------------|
| `key`      | string  | Object key |
| `url`      | string  | Public preview URL |
| `size`     | integer | File size in bytes |
| `modified` | string  | Last-modified timestamp (ISO 8601) |

### Error Responses

| Status | Cause |
|--------|-------|
| `400`  | Invalid bucket name |
| `401`  | Missing or wrong API key |
| `404`  | Bucket does not exist |
| `405`  | Non-GET request |

### cURL Example

```bash
curl "https://example.com/api/list.php?bucket=documents" \
  -H "X-Api-Key: your-secret-key"
```

---

## 6. List All Buckets

Omit the `bucket` parameter from `list.php` to get a list of all available bucket names.

### Request

```
GET /api/list.php
X-Api-Key: your-secret-key
```

### Success Response — `200 OK`

```json
{
  "status": "success",
  "buckets": ["documents", "photos", "videos"]
}
```

### cURL Example

```bash
curl "https://example.com/api/list.php" \
  -H "X-Api-Key: your-secret-key"
```

---

## 7. Delete Object

Permanently delete a file from a bucket. If the bucket becomes empty after deletion, the bucket directory is also removed automatically.

### Request

```
POST /api/delete.php
X-Api-Key: your-secret-key
```

Accepts two content types:

**Option A — Form data:**

```
Content-Type: application/x-www-form-urlencoded

bucket=documents&key=6613a8f1.23456_report.pdf
```

**Option B — JSON body:**

```
Content-Type: application/json

{
  "bucket": "documents",
  "key":    "6613a8f1.23456_report.pdf"
}
```

| Parameter | Type   | Required | Description |
|-----------|--------|----------|-------------|
| `bucket`  | string | ✅       | Bucket containing the file |
| `key`     | string | ✅       | Object key to delete |

### Success Response — `200 OK`

```json
{
  "status": "success",
  "bucket": "documents",
  "key":    "6613a8f1.23456_report.pdf"
}
```

### Error Responses

| Status | Cause |
|--------|-------|
| `400`  | Missing or invalid `bucket` / `key`, malformed JSON |
| `401`  | Missing or wrong API key |
| `403`  | Path traversal attempt |
| `404`  | Object not found |
| `405`  | Non-POST request |
| `500`  | File deletion failed (permissions issue) |

### cURL Examples

```bash
# Form data
curl -X POST https://example.com/api/delete.php \
  -H "X-Api-Key: your-secret-key" \
  -d "bucket=documents&key=6613a8f1.23456_report.pdf"

# JSON body
curl -X POST https://example.com/api/delete.php \
  -H "X-Api-Key: your-secret-key" \
  -H "Content-Type: application/json" \
  -d '{"bucket":"documents","key":"6613a8f1.23456_report.pdf"}'
```

### JavaScript (fetch) Example

```javascript
const res = await fetch('https://example.com/api/delete.php', {
  method: 'POST',
  headers: {
    'X-Api-Key': 'your-secret-key',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ bucket: 'documents', key: '6613a8f1.23456_report.pdf' }),
});

const data = await res.json();
// { "status": "success", "bucket": "documents", "key": "..." }
```

---

## Naming Rules

### Bucket name

| Rule | Detail |
|------|--------|
| Length | 3 – 63 characters |
| Characters | Letters (`a-z`, `A-Z`), digits (`0-9`), hyphens (`-`), underscores (`_`) |
| Must start with | A letter or digit |
| Examples (valid) | `documents`, `my-bucket`, `Photos_2026` |
| Examples (invalid) | `-bucket`, `ab`, `bucket@name`, `my/bucket` |

### Object key

| Rule | Detail |
|------|--------|
| Length | 1 – 255 characters |
| Characters | Letters, digits, hyphens, underscores, dots (`.`) |
| Must start with | A letter or digit (no leading dot) |
| Note | Keys are auto-generated by `upload.php` — you never need to choose one manually |

---

## Allowed File Types

Files with extensions outside this list are rejected at upload time.

| Category | Extensions |
|----------|-----------|
| Documents | `pdf` `doc` `docx` `xls` `xlsx` `ppt` `pptx` `csv` `txt` |
| Images | `png` `jpg` `jpeg` `gif` `webp` `svg` `bmp` `ico` |
| Web / Text | `html` `htm` `json` `xml` |
| Archives | `zip` `tar` `gz` |
| Video | `mp4` `webm` |
| Audio | `mp3` `ogg` `wav` |

Executables (`php`, `cgi`, `sh`, `exe`, etc.) are **never** accepted, and disguised files (wrong MIME type for the extension) are also blocked.

---

## HTTP Status Code Reference

| Code | Meaning |
|------|---------|
| `200` | OK — request succeeded |
| `206` | Partial Content — serving a byte range (streaming) |
| `302` | Found — redirecting to preview URL |
| `304` | Not Modified — ETag matched, browser can use its cache |
| `400` | Bad Request — missing/invalid parameter |
| `401` | Unauthorized — API key missing or wrong |
| `403` | Forbidden — path traversal attempt blocked |
| `404` | Not Found — bucket or object does not exist |
| `405` | Method Not Allowed — wrong HTTP method used |
| `413` | Content Too Large — file exceeds 100 MB |
| `415` | Unsupported Media Type — file extension or MIME type not allowed |
| `416` | Range Not Satisfiable — invalid `Range` header |
| `500` | Internal Server Error — server-side failure |
