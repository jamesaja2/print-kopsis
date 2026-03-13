import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
    getFileServerBaseUrl,
} from "@/lib/fileServer";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from "@/lib/uploadLimits";

type PresignPayload = {
    folder?: string;
    filename?: string;
};

type PresignResponseSuccess = {
    success: true;
    uploadUrl: string;
    method: string;
    headers: Record<string, string>;
    bucket: string;
    maxUploadBytes: number;
    maxUploadMb: number;
    note: string;
};

type PresignResponseError = {
    success: false;
    error: string;
};

type PresignResponse = PresignResponseSuccess | PresignResponseError;

/**
 * NOTE: The new file server API auto-generates keys on upload.
 * This endpoint now returns the upload endpoint URL and bucket info,
 * but the actual key and public URL are only available after upload completes.
 */
export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return NextResponse.json<PresignResponse>(
            { success: false, error: "Unauthorized" },
            { status: 401 }
        );
    }

    let payload: PresignPayload = {};
    try {
        payload = (await request.json()) as PresignPayload;
    } catch {
        // Empty bodies are allowed
    }

    const bucket = (payload.folder?.trim() || "uploads").slice(0, 63);

    try {
        // Ensure file server config is valid during target preparation.
        getFileServerBaseUrl();
        const uploadUrl = "/api/upload";
        const headers: Record<string, string> = {};

        console.log("🔧 Presign upload info:", {
            uploadUrl,
            bucket,
            mode: "proxy",
        });

        return NextResponse.json<PresignResponse>({
            success: true,
            uploadUrl,
            method: "POST",
            headers,
            bucket,
            maxUploadBytes: MAX_UPLOAD_BYTES,
            maxUploadMb: MAX_UPLOAD_MB,
            note: "The server will auto-generate the file key. Send file + bucket in multipart/form-data. Response will include: { bucket, key, url, size }",
        });
    } catch (error) {
        console.error("Failed to prepare upload target", error);
        return NextResponse.json<PresignResponse>(
            { success: false, error: "Unable to prepare upload" },
            { status: 500 }
        );
    }
}
