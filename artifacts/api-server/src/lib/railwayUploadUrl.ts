/** Same-origin absolute upload URLs are required by the generated OpenAPI/Zod response contract. */
export function railwayUploadUrl(host: string, objectPath: string): string {
  if (!/^[a-z0-9.-]+(?::\d{1,5})?$/i.test(host)) throw new Error("Invalid upload host");
  const match = /^\/railway-uploads\/([a-f0-9-]{36})$/i.exec(objectPath);
  if (!match) throw new Error("Invalid upload object path");
  return new URL(`/api/storage/uploads/railway/${match[1]}`, `https://${host}`).toString();
}
