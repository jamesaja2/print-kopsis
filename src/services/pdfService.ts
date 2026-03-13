import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export class PdfService {
    async extractPageCount(file: File): Promise<number> {
        const buffer = Buffer.from(await file.arrayBuffer());

        const fromPdfInfo = await this.extractByPdfInfo(buffer);
        if (fromPdfInfo && fromPdfInfo > 0) {
            return fromPdfInfo;
        }

        const fromRegex = this.extractByRegex(buffer);
        if (fromRegex > 0) {
            return fromRegex;
        }

        throw new Error("Unable to determine PDF page count");
    }

    private async extractByPdfInfo(buffer: Buffer): Promise<number | null> {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "print-pdf-"));
        const pdfPath = path.join(tmpDir, "document.pdf");

        try {
            await fs.writeFile(pdfPath, buffer);
            const { stdout } = await execFileAsync("pdfinfo", [pdfPath], { timeout: 5000 });
            const match = stdout.match(/Pages:\s+(\d+)/i);
            return match ? Number.parseInt(match[1], 10) : null;
        } catch {
            return null;
        } finally {
            await fs.rm(tmpDir, { recursive: true, force: true });
        }
    }

    private extractByRegex(buffer: Buffer): number {
        const text = buffer.toString("latin1");
        const pageMatches = text.match(/\/Type\s*\/Page\b/g);
        return pageMatches?.length || 0;
    }
}

export const pdfService = new PdfService();
