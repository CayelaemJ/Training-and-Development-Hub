# Study-material retrieval and generation context

## Current implementation

Uploaded TXT, Markdown, PDF and Office documents are extracted to text by the API. Practice-test and written-exam generation use the shared `generationBatches` pipeline. Each model request receives a bounded context sampled across its assigned part of the document, with a maximum of five questions per call. Requests are sequential to avoid competing for provider quota. Exam generation also requires every returned source excerpt to occur in the supplied text.

The `/materials/:id/ask` endpoint adds passage retrieval for learner questions. It chunks the selected material locally, ranks passages with BM25, sends up to four passages (4,200 characters total) to the configured chat model, and rejects citations that cannot be matched to a retrieved passage. The endpoint only loads material owned by the authenticated user. It is also available from the material's practice-test page.

The pipeline uses lexical retrieval, not vector search: it does not create embeddings or require a vector database. Context selection and ranking run locally and add no embedding-provider cost. This keeps the implementation quick and inexpensive, but paraphrases with little term overlap may retrieve weak evidence.

## Latency and cost controls

- Context is capped at 6,000 characters per generation call.
- Questions are bounded to 15 per written exam and batched at five per request.
- Question-answer requests retrieve at most four passages and are covered by the existing shared API rate limiter.
- Extracted text is reused for written exams when the existing `ENABLE_MATERIAL_READING=true` cache is enabled. The default-off behavior and legacy schemas continue to work without the optional cache columns.
- AI reading of scanned pages remains separately consented and controlled by the existing OCR configuration.

## Boundaries

Lexical retrieval is not semantic similarity: a question phrased with different vocabulary from the source may return no passage, and frequent terms can affect rankings. Some formats may have weak extraction order, and a long document may contain important details outside the selected windows. Answers and generated assessments remain drafts and should be reviewed by educators. Do not use them as final high-stakes decisions without moderation.

## Next step for question-answer retrieval

Before wider rollout, evaluate retrieval against representative curriculum questions and source documents, measure answer support and latency, and run account-isolation checks. Introduce embeddings only if an evaluation shows a meaningful accuracy benefit and the cost, privacy, retention and deletion behavior are specified.
