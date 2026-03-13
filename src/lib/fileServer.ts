import { MAX_UPLOAD_BYTES } from "./uploadLimits";

const FILE_SERVER_URL = (process.env.FILE_SERVER_URL || "").replace(/\/$/, "");
const FILE_SERVER_API_KEY = (process.env.FILE_SERVER_API_KEY || "")
    .trim()
    .replace(/^['"]|['"]$/g, "");

function ensureConfig() {
    if (!FILE_SERVER_URL) {
        throw new Error("FILE_SERVER_URL is not configured");
    }
    if (!FILE_SERVER_API_KEY) {
        throw new Error("FILE_SERVER_API_KEY is not configured");
    }
}

function sanitizeBucket(input: string, fallback = "default") {
    // Bucket: 3-63 chars, letters, digits, hyphens, underscores, must start with letter/digit
    const normalized = input
        .normalize("NFKD")
        .replace(/[^a-zA-Z0-9_-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase();
    
    const result = normalized || fallback;
    // Ensure starts with letter or digit
    if (result && !/^[a-zA-Z0-9]/.test(result)) {
        return "b" + result;
    }
    // Ensure length constraints
    return result.slice(0, 63).padEnd(3, "x");
}

export function getFileServerBaseUrl() {
    ensureConfig();
    return FILE_SERVER_URL;
}

export function getFileServerApiKey() {
    ensureConfig();
    return FILE_SERVER_API_KEY;
}

export function getFileServerUploadHeaders() {
    return {
        "X-Api-Key": getFileServerApiKey(),
    } as const;
}

function appendApiKeySearchParam(params: URLSearchParams) {
    if (FILE_SERVER_API_KEY) {
        params.set("api_key", FILE_SERVER_API_KEY);
    }
}

/**
 * Build preview URL for a file
 * Format: https://example.com/preview.php?bucket={bucket}&key={key}
 */
function buildPreviewUrl(bucket: string, key: string) {
    const params = new URLSearchParams({
        bucket: bucket,
        key: key,
    });
    return `${FILE_SERVER_URL}/preview.php?${params.toString()}`;
}

function getFilePayloadSize(file: File | Buffer): number {
    if (typeof File !== "undefined" && file instanceof File) {
        return file.size;
    }
    if (typeof Blob !== "undefined" && file instanceof Blob) {
        return file.size;
    }
    if (typeof Buffer !== "undefined" && Buffer.isBuffer(file)) {
        return file.byteLength;
    }
    if (typeof (file as any)?.size === "number") {
        return (file as any).size;
    }
    return 0;
}

async function toBlob(file: File | Buffer, filename: string) {
    if (typeof File !== "undefined" && file instanceof File) {
        return file;
    }
    if (Buffer.isBuffer(file)) {
        return new Blob([new Uint8Array(file)]);
    }
    if ((file as any)?.arrayBuffer) {
        const data = await (file as File).arrayBuffer();
        return new Blob([data], { type: (file as any).type || "application/octet-stream" });
    }
    throw new Error("Unsupported file type");
}

/**
 * Upload file to S3-like file server
 * POST /api/upload.php with bucket and file
 * Returns { bucket, key, url, size }
 */
export async function uploadToFileServer(
    file: File | Buffer, 
    filename: string, 
    bucket = "default"
): Promise<{ bucket: string; key: string; url: string; size: number }> {
    ensureConfig();
    const fileSize = getFilePayloadSize(file);
    if (fileSize > MAX_UPLOAD_BYTES) {
        throw new Error(`File exceeds the ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))}MB limit`);
    }

    const safeBucket = sanitizeBucket(bucket);
    const formData = new FormData();
    const blob = await toBlob(file, filename);
    
    formData.append("bucket", safeBucket);
    formData.append("file", blob, filename);
    // Some gateways strip custom headers; keep api_key fallback in body.
    formData.append("api_key", FILE_SERVER_API_KEY);

    const uploadParams = new URLSearchParams();
    appendApiKeySearchParam(uploadParams);
    const uploadQuery = uploadParams.toString();
    const uploadUrl = uploadQuery
        ? `${FILE_SERVER_URL}/api/upload.php?${uploadQuery}`
        : `${FILE_SERVER_URL}/api/upload.php`;

    const response = await fetch(uploadUrl, {
        method: "POST",
        headers: {
            "X-Api-Key": FILE_SERVER_API_KEY,
        },
        body: formData,
    });

    if (!response.ok) {
        let message = "";
        try {
            const errorData = await response.json();
            message = errorData.message || JSON.stringify(errorData);
        } catch (error) {
            try {
                message = await response.text();
            } catch (e) {
                console.warn("Failed to read file server error response", e);
            }
        }
        throw new Error(`File server upload failed (${response.status} ${response.statusText}): ${message}`);
    }

    const result = await response.json();
    
    // API returns: { status, bucket, key, url, size }
    if (result.status !== "success") {
        throw new Error(`Upload failed: ${result.message || "Unknown error"}`);
    }

    return {
        bucket: result.bucket,
        key: result.key,
        url: result.url,
        size: result.size,
    };
}

/**
 * Delete file from S3-like file server
 * POST /api/delete.php with bucket and key
 */
export async function deleteFromFileServer(bucket: string, key: string) {
    ensureConfig();
    if (!bucket || !key) return;

    const deleteParams = new URLSearchParams();
    appendApiKeySearchParam(deleteParams);
    const deleteQuery = deleteParams.toString();
    const deleteUrl = deleteQuery
        ? `${FILE_SERVER_URL}/api/delete.php?${deleteQuery}`
        : `${FILE_SERVER_URL}/api/delete.php`;

    const response = await fetch(deleteUrl, {
        method: "POST",
        headers: {
            "X-Api-Key": FILE_SERVER_API_KEY,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ bucket, key, api_key: FILE_SERVER_API_KEY }),
    });

    if (!response.ok) {
        console.warn("Failed to delete file server object", bucket, key, response.status);
        try {
            const errorData = await response.json();
            console.warn("Delete error:", errorData.message);
        } catch (e) {
            // ignore
        }
    }
}

/**
 * Parse bucket and key from a file server URL or return the values directly
 * Supports:
 * - Preview URLs: https://example.com/preview.php?bucket=xxx&key=yyy
 * - Direct bucket:key format: "bucket:key"
 * - URL-only: returns null bucket and key
 */
export function parseFileReference(urlOrRef: string | null | undefined): { bucket: string; key: string } | null {
    if (!urlOrRef) return null;

    // Try parsing as URL first
    try {
        const url = new URL(urlOrRef);
        const params = new URLSearchParams(url.search);
        const bucket = params.get("bucket");
        const key = params.get("key");
        if (bucket && key) {
            return { bucket, key };
        }
    } catch {
        // Not a valid URL, continue
    }

    // Try "bucket:key" format
    if (urlOrRef.includes(":") && !urlOrRef.startsWith("http")) {
        const [bucket, ...keyParts] = urlOrRef.split(":");
        const key = keyParts.join(":");
        if (bucket && key) {
            return { bucket, key };
        }
    }

    return null;
}

/**
 * Get public URL for a file
 * Input can be:
 * - Full preview URL (returned as-is)
 * - "bucket:key" format (converted to preview URL)
 * - { bucket, key } object
 */
export function getPublicFileUrl(input: string | { bucket: string; key: string } | null | undefined): string | null {
    if (!input) return null;

    // If it's already a full URL, return it
    if (typeof input === "string" && (input.startsWith("http://") || input.startsWith("https://"))) {
        return input;
    }

    // Parse the reference
    let bucket: string;
    let key: string;

    if (typeof input === "string") {
        const parsed = parseFileReference(input);
        if (!parsed) return null;
        bucket = parsed.bucket;
        key = parsed.key;
    } else {
        bucket = input.bucket;
        key = input.key;
    }

    if (!FILE_SERVER_URL) {
        return null;
    }

    return buildPreviewUrl(bucket, key);
}

/**
 * Extract bucket and key from URL or reference
 * Legacy function kept for compatibility
 */
export function extractFileKey(urlOrRef: string): string {
    const parsed = parseFileReference(urlOrRef);
    return parsed ? `${parsed.bucket}:${parsed.key}` : "";
}

/**
 * Legacy wrapper for uploadToFileServer that returns just the URL string
 * for backward compatibility with existing code
 * @deprecated Use uploadToFileServer and handle the full response object
 */
export async function uploadToFileServerLegacy(
    file: File | Buffer, 
    filename: string, 
    bucket = "default"
): Promise<string> {
    const result = await uploadToFileServer(file, filename, bucket);
    // Return URL for backward compatibility
    return result.url;
}

/**
 * Legacy wrapper for deleteFromFileServer that accepts bucket:key or URL format
 * @deprecated Use deleteFromFileServer with explicit bucket and key parameters
 */
export async function deleteFromFileServerLegacy(urlOrRef: string) {
    const parsed = parseFileReference(urlOrRef);
    if (!parsed) {
        console.warn("Could not parse file reference for deletion:", urlOrRef);
        return;
    }
    await deleteFromFileServer(parsed.bucket, parsed.key);
}

/**
 * List all files in a bucket
 * GET /api/list.php?bucket={bucket}
 */
export async function listFilesInBucket(bucket: string): Promise<{
    bucket: string;
    count: number;
    files: Array<{ key: string; url: string; size: number; modified: string }>;
}> {
    ensureConfig();
    const safeBucket = sanitizeBucket(bucket);

    const params = new URLSearchParams({ bucket: safeBucket });
    appendApiKeySearchParam(params);

    const response = await fetch(`${FILE_SERVER_URL}/api/list.php?${params.toString()}`, {
        method: "GET",
        headers: {
            "X-Api-Key": FILE_SERVER_API_KEY,
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to list files in bucket ${safeBucket}: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    if (result.status !== "success") {
        throw new Error(`Failed to list files: ${result.message || "Unknown error"}`);
    }

    return {
        bucket: result.bucket,
        count: result.count,
        files: result.files,
    };
}

/**
 * Get metadata for a specific file
 * GET /api/get.php?bucket={bucket}&key={key}&action=info
 */
export async function getFileMetadata(bucket: string, key: string): Promise<{
    bucket: string;
    key: string;
    url: string;
    size: number;
    mime: string;
    modified: string;
}> {
    ensureConfig();

    const params = new URLSearchParams({ bucket, key, action: "info" });
    appendApiKeySearchParam(params);
    const response = await fetch(`${FILE_SERVER_URL}/api/get.php?${params.toString()}`, {
        method: "GET",
        headers: {
            "X-Api-Key": FILE_SERVER_API_KEY,
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to get file metadata: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    if (result.status !== "success") {
        throw new Error(`Failed to get metadata: ${result.message || "Unknown error"}`);
    }

    return {
        bucket: result.bucket,
        key: result.key,
        url: result.url,
        size: result.size,
        mime: result.mime,
        modified: result.modified,
    };
}
