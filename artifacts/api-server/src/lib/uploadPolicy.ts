export const MAX_FILE_BYTES = 30 * 1024 * 1024;
export const materialTypes: Record<string, string> = {
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};
export const supportedMaterialMessage =
  "Choose a PDF, DOCX, PowerPoint, Excel, text, Markdown, CSV, PNG, JPEG or WebP file.";
export class MaterialReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MaterialReadError";
  }
}
export function materialExtension(name: string) {
  return name.toLowerCase().split(".").pop() ?? "";
}
export function validateMaterial(name: string, size: number) {
  if (!materialTypes[materialExtension(name)])
    throw new MaterialReadError(supportedMaterialMessage);
  if (!Number.isSafeInteger(size) || size <= 0)
    throw new MaterialReadError(
      "This file is empty. Choose a file with learning material in it.",
    );
  if (size > MAX_FILE_BYTES)
    throw new MaterialReadError(
      "Choose a file of 30 MB or less, or split it into smaller parts.",
    );
}

/** Validate the claimed MIME type without trusting it as proof of file contents. */
export function validateDeclaredMaterialType(name: string, contentType: string): void {
  const expected = materialTypes[materialExtension(name)];
  if (!expected) throw new MaterialReadError(supportedMaterialMessage);
  const declared = contentType.trim().toLowerCase().split(";", 1)[0];
  // Some native clients cannot identify a document MIME; the magic-byte
  // check on material creation remains authoritative.
  if (!declared || declared === "application/octet-stream") return;
  const aliases: Record<string, string[]> = {
    "text/markdown": ["text/plain", "text/x-markdown"],
    "text/csv": ["application/csv", "application/vnd.ms-excel"],
    "image/jpeg": ["image/jpg"],
  };
  if (declared !== expected && !(aliases[expected] ?? []).includes(declared)) {
    throw new MaterialReadError("The selected file type does not match its filename.");
  }
}

/**
 * Refuse obvious type spoofing before document parsing, OCR or storage ACL setup.
 * This is not antivirus scanning; archives need the existing decompression limits.
 */
export function validateMaterialSignature(fileName: string, data: Uint8Array): void {
  if (data.byteLength === 0) throw new MaterialReadError("This file is empty.");
  const ext = materialExtension(fileName);
  const starts = (...signature: number[]) => signature.every((value, index) => data[index] === value);
  const valid = ext === "pdf"
    ? starts(0x25, 0x50, 0x44, 0x46, 0x2d) || Array.from(data.subarray(0, Math.min(data.length, 1024))).some((v,i,a) =>
        v === 0x25 && a[i+1]===0x50 && a[i+2]===0x44 && a[i+3]===0x46 && a[i+4]===0x2d)
    : ["docx", "pptx", "xlsx"].includes(ext)
      ? starts(0x50, 0x4b, 0x03, 0x04)
      : ext === "png"
        ? starts(0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a)
        : ["jpg","jpeg"].includes(ext)
          ? starts(0xff,0xd8,0xff)
          : ext === "webp"
            ? starts(0x52,0x49,0x46,0x46) && data[8]===0x57 && data[9]===0x45 && data[10]===0x42 && data[11]===0x50
            : ["txt","md","csv"].includes(ext)
              ? !data.subarray(0, Math.min(data.length, 4096)).includes(0)
              : false;
  if (!valid) throw new MaterialReadError("This file does not match the expected document format.");
}
