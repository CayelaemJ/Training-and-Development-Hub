import { zipSync, strToU8 } from "fflate";
export const notes =
  "Fractions describe equal parts of a whole. The numerator counts the parts selected. The denominator counts all equal parts. Equivalent fractions have the same value. To add fractions, first use a common denominator. One half equals two quarters. Two quarters plus one quarter equals three quarters. ";
export function pdfFixture(image = false) {
  const stream = image
    ? "q 1 0 0 1 0 0 cm Q"
    : "BT /F1 12 Tf 40 750 Td (" + notes.replace(/[()\\]/g, " ") + ") Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let s = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(s));
    s += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const x = Buffer.byteLength(s);
  s +=
    "xref\n0 6\n0000000000 65535 f \n" +
    offsets
      .slice(1)
      .map((n) => String(n).padStart(10, "0") + " 00000 n \n")
      .join("") +
    `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;
  return Buffer.from(s);
}
export function fixtureFiles() {
  const ct =
    '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>';
  const pack = (entries: Record<string, string>) =>
    Buffer.from(
      zipSync(
        Object.fromEntries(
          Object.entries(entries).map(([k, v]) => [k, strToU8(v)]),
        ),
      ),
    );
  return [
    { name: "notes.txt", bytes: Buffer.from(notes) },
    { name: "notes.md", bytes: Buffer.from("# Fractions\n" + notes) },
    {
      name: "notes.csv",
      bytes: Buffer.from('topic,notes\nFractions,"' + notes + '"'),
    },
    { name: "notes.pdf", bytes: pdfFixture() },
    {
      name: "notes.docx",
      bytes: pack({
        "[Content_Types].xml": ct,
        "_rels/.rels":
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
        "word/document.xml":
          '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>' +
          notes +
          "</w:t></w:r></w:p></w:body></w:document>",
      }),
    },
    {
      name: "notes.pptx",
      bytes: pack({
        "ppt/slides/slide1.xml":
          '<p:sld xmlns:p="p" xmlns:a="a"><a:t>' + notes + "</a:t></p:sld>",
      }),
    },
    {
      name: "notes.xlsx",
      bytes: pack({
        "xl/sharedStrings.xml": "<sst><si><t>" + notes + "</t></si></sst>",
        "xl/worksheets/sheet1.xml":
          '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1"><v>42</v></c></row></sheetData></worksheet>',
      }),
    },
  ];
}
