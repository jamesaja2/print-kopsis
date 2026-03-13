"use client";

import { useCallback, useState } from "react";

type UploadResponse = {
  success: boolean;
  key: string;
  url: string | null;
};

type UploadTargetSuccess = {
  success: true;
  uploadUrl: string;
  method?: string;
  headers?: Record<string, string>;
  bucket: string;
  maxUploadBytes: number;
  maxUploadMb: number;
  note?: string;
};

type UploadTargetError = {
  success: false;
  error?: string;
};

type UploadTargetResponse = UploadTargetSuccess | UploadTargetError;

type FileServerUploadResponse = {
  status: string;
  bucket: string;
  key: string;
  url: string;
  size: number;
};

export function useUploadWithProgress() {
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestUploadTarget = useCallback(async (folder: string, filename: string) => {
    const response = await fetch("/api/upload/presign", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ folder, filename }),
    });

    let payload: UploadTargetResponse;
    try {
      payload = (await response.json()) as UploadTargetResponse;
    } catch {
      throw new Error("Invalid server response");
    }

    if (!response.ok || !payload?.success) {
      const message = payload?.success === false && payload.error ? payload.error : "Unable to prepare upload";
      throw new Error(message);
    }

    return payload;
  }, []);

  const performUpload = useCallback(
    (target: UploadTargetSuccess, file: File, resolvedFilename: string) => {
      return new Promise<UploadResponse>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const formData = new FormData();
        
        // Upload through same-origin API proxy to avoid browser CORS issues.
        formData.append("bucket", target.bucket);
        formData.append("file", file, resolvedFilename);
        formData.append("filename", resolvedFilename);

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            setProgress(percent);
          }
        };

        xhr.onreadystatechange = () => {
          if (xhr.readyState === XMLHttpRequest.DONE) {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                // Parse JSON response from upload API (proxied to file server)
                const response: FileServerUploadResponse = JSON.parse(xhr.responseText);

                if (response.status === "success") {
                  resolve({ 
                    success: true, 
                    key: response.key, 
                    url: response.url 
                  });
                } else {
                  reject(new Error("Upload failed: Server returned unsuccessful status"));
                }
              } catch (err) {
                reject(new Error("Failed to parse server response"));
              }
            } else {
              // Try to parse error message from JSON response
              let message = "Upload failed";
              try {
                const errorResponse = JSON.parse(xhr.responseText);
                message = errorResponse.message || xhr.responseText || message;
              } catch {
                message = xhr.responseText || message;
              }

              // Include status in error message for better debugging
              const detailedMessage = `Upload failed (${xhr.status}): ${message}`;
              reject(new Error(detailedMessage));
            }
          }
        };

        xhr.onerror = () => {
          reject(new Error("Network error while uploading"));
        };

        xhr.open("POST", "/api/upload", true);
        if (target.headers) {
          Object.entries(target.headers).forEach(([header, value]) => {
            if (value) {
              xhr.setRequestHeader(header, value);
            }
          });
        }
        xhr.send(formData);
      });
    },
    [setProgress]
  );

  const uploadFile = useCallback(
    async (file: File, folder?: string, filename?: string) => {
      setIsUploading(true);
      setProgress(0);
      setError(null);

      const resolvedFilename = filename?.trim() || file.name || `upload-${Date.now()}`;
      const targetFolderInput = typeof folder === "string" ? folder : "uploads";
      const targetFolder = targetFolderInput.trim() || "uploads";

      try {
        const target = await requestUploadTarget(targetFolder, resolvedFilename);
        if (file.size > target.maxUploadBytes) {
          throw new Error(`File exceeds ${target.maxUploadMb}MB limit`);
        }
        const result = await performUpload(target, file, resolvedFilename);
        setProgress(100);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        setError(message);
        throw err instanceof Error ? err : new Error(message);
      } finally {
        setIsUploading(false);
      }
    },
    [performUpload, requestUploadTarget]
  );

  const resetProgress = useCallback(() => {
    setProgress(0);
    setError(null);
    setIsUploading(false);
  }, []);

  return { uploadFile, progress, isUploading, error, resetProgress };
}
