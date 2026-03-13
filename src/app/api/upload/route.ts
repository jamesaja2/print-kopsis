import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getFileServerApiKey, getFileServerBaseUrl } from "@/lib/fileServer";
import { MAX_UPLOAD_BYTES } from "@/lib/uploadLimits";

function sanitizeBucket(input: string, fallback = "default") {
    const normalized = input
        .normalize("NFKD")
        .replace(/[^a-zA-Z0-9_-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase();

    const result = normalized || fallback;
    if (!/^[a-zA-Z0-9]/.test(result)) {
        return `b${result}`.slice(0, 63);
    }
    return result.slice(0, 63).padEnd(3, "x");
}

export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return NextResponse.json(
            { status: "error", message: "Unauthorized" },
            { status: 401 }
        );
    }

    try {
        const formData = await request.formData();
        const bucketRaw = formData.get("bucket");
        const fileRaw = formData.get("file");
        const filenameRaw = formData.get("filename");

        const bucketInput = typeof bucketRaw === "string" && bucketRaw.trim() ? bucketRaw.trim() : "uploads";
        const bucket = sanitizeBucket(bucketInput, "uploads");

        if (!(fileRaw instanceof File)) {
            return NextResponse.json(
                { status: "error", message: "Missing file" },
                { status: 400 }
            );
        }

        if (fileRaw.size > MAX_UPLOAD_BYTES) {
            return NextResponse.json(
                { status: "error", message: `File exceeds ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))}MB limit` },
                { status: 413 }
            );
        }

        const filename =
            typeof filenameRaw === "string" && filenameRaw.trim()
                ? filenameRaw.trim()
                : fileRaw.name || `upload-${Date.now()}`;

        const apiKey = getFileServerApiKey();
        const baseUrl = getFileServerBaseUrl();

        // Forward multipart upload directly to file server.
        const outbound = new FormData();
        outbound.append("bucket", bucket);
        outbound.append("file", fileRaw, filename);
        // Fallback auth for deployments where custom headers are stripped.
        outbound.append("api_key", apiKey);

        const params = new URLSearchParams({ api_key: apiKey });
        const upstreamUrl = `${baseUrl}/api/upload.php?${params.toString()}`;

        const upstreamResponse = await fetch(upstreamUrl, {
            method: "POST",
            headers: {
                "X-Api-Key": apiKey,
            },
            body: outbound,
        });

        const rawBody = await upstreamResponse.text();
        let payload: any = null;
        try {
            payload = rawBody ? JSON.parse(rawBody) : null;
        } catch {
            payload = null;
        }

        if (!upstreamResponse.ok) {
            const message = payload?.message || rawBody || `Upstream upload failed (${upstreamResponse.status})`;
            return NextResponse.json(
                {
                    status: "error",
                    message,
                    upstreamStatus: upstreamResponse.status,
                },
                { status: upstreamResponse.status }
            );
        }

        if (!payload || payload.status !== "success") {
            return NextResponse.json(
                {
                    status: "error",
                    message: payload?.message || "Invalid upload response from file server",
                },
                { status: 502 }
            );
        }

        return NextResponse.json({
            status: "success",
            bucket: payload.bucket,
            key: payload.key,
            url: payload.url,
            size: payload.size,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Upload failed";
        return NextResponse.json(
            { status: "error", message },
            { status: 500 }
        );
    }
}
