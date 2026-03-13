# File Server Migration Guide

## Overview

The file server implementation has been updated to use the new S3-like object storage API. This document outlines the changes made and how to migrate existing code.

## API Changes

### Authentication

**Before:**
```
Authorization: Bearer {token}
```

**After:**
```
X-Api-Key: {api-key}
```

### Upload Endpoint

**Before:**
```
PUT /files/{key}
Content-Type: multipart/form-data
```

**After:**
```
POST /api/upload.php
Content-Type: multipart/form-data
Fields: bucket, file
```

**Response changed from:**
- Simple success/failure

**To:**
```json
{
  "status": "success",
  "bucket": "documents",
  "key": "6613a8f1.23456_report.pdf",
  "url": "https://example.com/preview.php?bucket=documents&key=6613a8f1.23456_report.pdf",
  "size": 204800
}
```

### File Access

**Before:**
```
/files/{key}
```

**After:**
```
/preview.php?bucket={bucket}&key={key}
```

### Delete Endpoint

**Before:**
```
DELETE /files/{key}
```

**After:**
```
POST /api/delete.php
Content-Type: application/json
Body: { "bucket": "...", "key": "..." }
```

## Environment Variables

### Required Update

Update your `.env` file:

```env
# Before
FILE_SERVER_TOKEN=your-token-here

# After
FILE_SERVER_API_KEY=your-api-key-here
```

The `FILE_SERVER_URL` remains the same.

## Code Changes

### 1. File Server Library (`src/lib/fileServer.ts`)

**Major Changes:**
- Bucket-based storage instead of folder-based keys
- Auto-generated file keys (server-side)
- New response format with full metadata
- Added backward compatibility wrappers

**New Functions:**
- `uploadToFileServer()` - Returns full metadata object
- `deleteFromFileServer(bucket, key)` - Requires both bucket and key
- `listFilesInBucket(bucket)` - List all files in a bucket
- `getFileMetadata(bucket, key)` - Get file metadata
- `parseFileReference(urlOrRef)` - Parse bucket and key from URL
- `getPublicFileUrl(input)` - Build preview URL

**Legacy Wrappers (for backward compatibility):**
- `uploadToFileServerLegacy()` - Returns just URL string
- `deleteFromFileServerLegacy()` - Accepts URL or bucket:key format

### 2. Function Signature Changes

**Upload:**
```typescript
// Before
uploadToFileServer(file: File, filename: string, folder: string): Promise<string>

// After (new)
uploadToFileServer(file: File, filename: string, bucket: string): Promise<{
  bucket: string;
  key: string;
  url: string;
  size: number;
}>

// After (legacy wrapper - use this for easy migration)
uploadToFileServerLegacy(file: File, filename: string, bucket: string): Promise<string>
```

**Delete:**
```typescript
// Before
deleteFromFileServer(key: string): Promise<void>

// After (new)
deleteFromFileServer(bucket: string, key: string): Promise<void>

// After (legacy wrapper - use this for easy migration)
deleteFromFileServerLegacy(urlOrRef: string): Promise<void>
```

### 3. Updated Files

The following action files were updated to use legacy wrappers:
- `src/actions/settings.ts`
- `src/actions/resource.ts`
- `src/actions/profile.ts`
- `src/actions/linkInBio.ts`
- `src/actions/dashboard.ts`

They now use:
```typescript
import { 
  uploadToFileServerLegacy as uploadToFileServer,
  deleteFromFileServerLegacy as deleteFromFileServer,
  getPublicFileUrl 
} from "@/lib/fileServer";
```

### 4. Presign Route Changes

The presign route (`src/app/api/upload/presign/route.ts`) has been updated:
- No longer returns pre-generated keys (server auto-generates them)
- Returns bucket and upload endpoint info
- Client must handle the response to extract bucket, key, and URL after upload

## Migration Path

### Immediate (Using Legacy Wrappers)

The legacy wrappers provide backward compatibility:
```typescript
// Your existing code continues to work
const url = await uploadToFileServer(file, filename, "documents");
await deleteFromFileServer(url);
```

### Recommended (New API)

For new code, use the full API:
```typescript
// Upload
const result = await uploadToFileServer(file, filename, "documents");
console.log(result.bucket);  // "documents"
console.log(result.key);     // "6613a8f1.23456_report.pdf"
console.log(result.url);     // Full preview URL
console.log(result.size);    // File size in bytes

// Store the URL or bucket:key format
await saveToDatabase({ fileUrl: result.url });

// Delete
const { bucket, key } = parseFileReference(fileUrl);
await deleteFromFileServer(bucket, key);
```

## New Features

### 1. List Files in Bucket

```typescript
const { bucket, count, files } = await listFilesInBucket("documents");

files.forEach(file => {
  console.log(file.key);      // "6613a8f1.23456_report.pdf"
  console.log(file.url);      // Preview URL
  console.log(file.size);     // Size in bytes
  console.log(file.modified); // ISO 8601 timestamp
});
```

### 2. Get File Metadata

```typescript
const metadata = await getFileMetadata("documents", "6613a8f1.23456_report.pdf");

console.log(metadata.mime);     // "application/pdf"
console.log(metadata.size);     // 204800
console.log(metadata.modified); // "2026-03-12T14:00:00+00:00"
```

### 3. Parse File References

```typescript
// From URL
const ref = parseFileReference("https://example.com/preview.php?bucket=docs&key=file.pdf");
// Returns: { bucket: "docs", key: "file.pdf" }

// From bucket:key format
const ref = parseFileReference("documents:6613a8f1.23456_report.pdf");
// Returns: { bucket: "documents", key: "6613a8f1.23456_report.pdf" }
```

## Bucket Naming Rules

Buckets must follow these rules (enforced by `sanitizeBucket()`):
- 3-63 characters
- Letters, digits, hyphens, underscores only
- Must start with letter or digit
- Automatically normalized and sanitized

Common bucket names:
- `default` - Default bucket (when folder name not provided)
- `content` - Settings and content files
- `resources` - Resource files
- `users` - User profile images
- `submissions` - Submission files
- `linkinbio` - Link-in-bio images

## Testing

After migration, test:

1. **Upload:** Verify files upload successfully and return correct metadata
2. **Preview:** Verify preview URLs work in browser
3. **Delete:** Verify files are deleted correctly
4. **List:** Verify listing returns all files in bucket
5. **Metadata:** Verify metadata retrieval works

## Rollback

If you need to rollback:

1. Revert `src/lib/fileServer.ts` to previous version
2. Update `.env` to use `FILE_SERVER_TOKEN` instead of `FILE_SERVER_API_KEY`
3. Revert action file imports to remove "Legacy" wrappers
4. Revert presign route to previous version

## Support

For questions about the new file server API, refer to [File Server.md](./File%20Server.md).
