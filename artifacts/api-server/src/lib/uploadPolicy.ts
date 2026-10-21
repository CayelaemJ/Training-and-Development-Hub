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
