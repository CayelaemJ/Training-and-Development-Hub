import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

const MAX_FILE_BYTES = 20 * 1024 * 1024;

export async function readObjectBuffer(
  stream: NodeJS.ReadableStream,
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.byteLength;
    if (bytes > MAX_FILE_BYTES) {
      throw new Error("File exceeds the 20 MB upload limit.");
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

export async function extractMaterialText(
  fileName: string,
  buffer: Buffer,
): Promise<string> {
  const extension = fileName.toLowerCase().split(".").pop();
  let text: string;

  if (extension === "pdf") {
    const parser = new PDFParse({ data: buffer });
    try {
      text = (await parser.getText()).text;
    } finally {
      await parser.destroy();
    }
  } else if (extension === "docx") {
    text = (await mammoth.extractRawText({ buffer })).value;
  } else if (extension === "txt" || extension === "md") {
    text = buffer.toString("utf8");
  } else {
    throw new Error("Upload a TXT, Markdown, PDF, or DOCX file.");
  }

  return text.replace(/\u0000/g, "").replace(/\r\n/g, "\n").trim();
}