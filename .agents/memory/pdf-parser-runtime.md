---
name: PDF parser runtime
description: Server-side PDF.js startup and parsing requirements for this workspace.
---

Use `pdf-parse` v2 with an explicit `PDFParse` instance and always destroy the parser after extraction. In the API server, keep `@napi-rs/canvas` resolvable at runtime and externalized from the esbuild bundle.

**Why:** `pdf-parse` v1.1.1 tried to read its own missing demo PDF during bundled ESM startup. Version 2 then failed until its optional native canvas module was resolvable, because PDF.js needs Node DOM globals. Typechecking did not expose either runtime issue.

**How to apply:** After changing PDF parser versions or bundling settings, restart the managed API workflow and run an actual PDF text extraction in addition to typechecking.