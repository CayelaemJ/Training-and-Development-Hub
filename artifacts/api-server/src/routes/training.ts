import OpenAI from "openai";
import {
  and,
  avg,
  count,
  desc,
  eq,
} from "drizzle-orm";
import {
  CreateMaterialBody,
  CreateMaterialResponse,
  DeleteMaterialParams,
  GenerateQuizBody,
  GenerateQuizParams,
  GenerateQuizResponse,
  GetDashboardResponse,
  GetQuizParams,
  GetQuizResponse,
  ListMaterialsResponse,
  ListQuizzesResponse,
  SubmitQuizAttemptBody,
  SubmitQuizAttemptParams,
  SubmitQuizAttemptResponse,
} from "@workspace/api-zod";
import {
  db,
  quizAttemptsTable,
  quizzesTable,
  studyMaterialsTable,
  uploadIntentsTable,
  type StoredFeedback,
  type StoredQuestion,
} from "@workspace/db";
import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod/v4";

import { extractMaterialText, readObjectBuffer } from "../lib/materialText";
import { ObjectPermission } from "../lib/objectAcl";
import { ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();
const MAX_GENERATION_TEXT = 40_000;
const MODEL_ID = "gpt-5.4-mini";
const PROMPT_VERSION = "1";

const generatedQuizSchema = z.object({
  title: z.string().trim().min(1).max(200),
  questions: z.array(
    z.object({
      prompt: z.string().trim().min(1),
      options: z.array(z.string().trim().min(1)),
      correctOption: z.number().int().min(0),
      explanation: z.string().trim().min(1),
    }),
  ),
});

function requireAuth(req: Request, res: Response): req is Request & {
  user: NonNullable<Request["user"]>;
} {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

function publicQuiz(quiz: typeof quizzesTable.$inferSelect) {
  return {
    id: quiz.id,
    materialId: quiz.materialId,
    title: quiz.title,
    difficulty: quiz.difficulty,
    optionCount: quiz.optionCount,
    createdAt: quiz.createdAt,
    questions: quiz.questions.map(({ prompt, options }) => ({
      prompt,
      options,
    })),
  };
}

async function listQuizSummaries(userId: string) {
  const rows = await db
    .select({
      quiz: quizzesTable,
      materialTitle: studyMaterialsTable.title,
    })
    .from(quizzesTable)
    .innerJoin(
      studyMaterialsTable,
      eq(quizzesTable.materialId, studyMaterialsTable.id),
    )
    .where(eq(quizzesTable.userId, userId))
    .orderBy(desc(quizzesTable.createdAt));

  const attempts = await db
    .select({
      quizId: quizAttemptsTable.quizId,
      percentage: quizAttemptsTable.percentage,
    })
    .from(quizAttemptsTable)
    .where(eq(quizAttemptsTable.userId, userId))
    .orderBy(desc(quizAttemptsTable.completedAt));

  const latestScores = new Map<number, number>();
  for (const attempt of attempts) {
    if (!latestScores.has(attempt.quizId)) {
      latestScores.set(attempt.quizId, attempt.percentage);
    }
  }

  return rows.map(({ quiz, materialTitle }) => ({
    id: quiz.id,
    materialId: quiz.materialId,
    materialTitle,
    title: quiz.title,
    questionCount: quiz.questionCount,
    difficulty: quiz.difficulty,
    optionCount: quiz.optionCount,
    latestScore: latestScores.get(quiz.id) ?? null,
    createdAt: quiz.createdAt,
  }));
}

router.get("/materials", async (req, res): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const materials = await db
    .select({
      id: studyMaterialsTable.id,
      title: studyMaterialsTable.title,
      fileName: studyMaterialsTable.fileName,
      contentType: studyMaterialsTable.contentType,
      sizeBytes: studyMaterialsTable.sizeBytes,
      characterCount: studyMaterialsTable.characterCount,
      createdAt: studyMaterialsTable.createdAt,
    })
    .from(studyMaterialsTable)
    .where(eq(studyMaterialsTable.userId, req.user.id))
    .orderBy(desc(studyMaterialsTable.createdAt));

  res.json(ListMaterialsResponse.parse(materials));
});

router.post("/materials", async (req, res): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const parsed = CreateMaterialBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const title = parsed.data.title.trim();
  if (!title || title.length > 200) {
    res.status(400).json({ error: "Title must be between 1 and 200 characters." });
    return;
  }

  const [intent] = await db
    .select()
    .from(uploadIntentsTable)
    .where(
      and(
        eq(uploadIntentsTable.objectPath, parsed.data.objectPath),
        eq(uploadIntentsTable.userId, req.user.id),
      ),
    )
    .limit(1);
  if (!intent) {
    res.status(400).json({ error: "This upload is not available to your account." });
    return;
  }

  try {
    const objectFile = await objectStorageService.getObjectEntityFile(
      intent.objectPath,
    );
    const buffer = await readObjectBuffer(objectFile.createReadStream());
    if (buffer.byteLength !== intent.sizeBytes) {
      res.status(400).json({ error: "The uploaded file size does not match." });
      return;
    }
    const extractedText = await extractMaterialText(intent.fileName, buffer);
    if (extractedText.length < 30) {
      res.status(400).json({
        error: "We could not find enough readable text in this file.",
      });
      return;
    }

    await objectStorageService.trySetObjectEntityAclPolicy(intent.objectPath, {
      owner: req.user.id,
      visibility: "private",
    });

    const materialInput = {
      userId: req.user.id,
      title,
      fileName: intent.fileName,
      contentType: intent.contentType,
      sizeBytes: intent.sizeBytes,
      objectPath: intent.objectPath,
      characterCount: extractedText.length,
    };
    const [material] = await db.transaction(async (tx) => {
      const created = await tx
        .insert(studyMaterialsTable)
        .values(materialInput)
        .returning({
          id: studyMaterialsTable.id,
          title: studyMaterialsTable.title,
          fileName: studyMaterialsTable.fileName,
          contentType: studyMaterialsTable.contentType,
          sizeBytes: studyMaterialsTable.sizeBytes,
          characterCount: studyMaterialsTable.characterCount,
          createdAt: studyMaterialsTable.createdAt,
        });
      await tx
        .delete(uploadIntentsTable)
        .where(eq(uploadIntentsTable.objectPath, intent.objectPath));
      return created;
    });

    req.log.info(
      { materialId: material.id, characterCount: extractedText.length },
      "Study material saved",
    );
    res.status(201).json(CreateMaterialResponse.parse(material));
  } catch (error) {
    req.log.error({ err: error }, "Failed to process uploaded material");
    res.status(400).json({
      error: "Could not read this file. Check that it is a valid TXT, Markdown, PDF, or DOCX.",
    });
  }
});

router.delete("/materials/:id", async (req, res): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const parsed = DeleteMaterialParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [material] = await db
    .select()
    .from(studyMaterialsTable)
    .where(
      and(
        eq(studyMaterialsTable.id, parsed.data.id),
        eq(studyMaterialsTable.userId, req.user.id),
      ),
    )
    .limit(1);
  if (!material) {
    res.status(404).json({ error: "Material not found." });
    return;
  }

  try {
    const file = await objectStorageService.getObjectEntityFile(
      material.objectPath,
    );
    await file.delete({ ignoreNotFound: true });
  } catch (error) {
    req.log.error({ err: error, materialId: material.id }, "File deletion failed");
    res.status(500).json({ error: "Could not remove the uploaded file." });
    return;
  }

  await db
    .delete(studyMaterialsTable)
    .where(
      and(
        eq(studyMaterialsTable.id, material.id),
        eq(studyMaterialsTable.userId, req.user.id),
      ),
    );
  res.sendStatus(204);
});

router.post("/materials/:id/quizzes", async (req, res): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const params = GenerateQuizParams.safeParse(req.params);
  const body = GenerateQuizBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [material] = await db
    .select()
    .from(studyMaterialsTable)
    .where(
      and(
        eq(studyMaterialsTable.id, params.data.id),
        eq(studyMaterialsTable.userId, req.user.id),
      ),
    )
    .limit(1);
  if (!material) {
    res.status(404).json({ error: "Material not found." });
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    res.status(503).json({
      error: "AI quiz generation is not configured. Add an OpenAI API key in Replit Secrets to enable it.",
    });
    return;
  }

  let sourceText: string;
  try {
    const file = await objectStorageService.getObjectEntityFile(
      material.objectPath,
    );
    const buffer = await readObjectBuffer(file.createReadStream());
    sourceText = await extractMaterialText(material.fileName, buffer);
  } catch (error) {
    req.log.error({ err: error, materialId: material.id }, "Material could not be read for quiz generation");
    res.status(500).json({ error: "Could not read the uploaded material." });
    return;
  }

  const model = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  let generated: z.infer<typeof generatedQuizSchema>;
  try {
    const response = await model.chat.completions.create({
      model: MODEL_ID,
      max_completion_tokens: 8192,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Create a multiple-choice assessment using only the supplied study material. Return valid JSON with title and questions. Each question must have a prompt, exactly the requested number of distinct answer options, a zero-based correctOption, and a concise explanation grounded in the material. Match the requested difficulty. Do not include questions whose answers are not supported by the material.",
        },
        {
          role: "user",
          content: JSON.stringify({
            materialTitle: material.title,
            materialText: sourceText.slice(0, MAX_GENERATION_TEXT),
            questionCount: body.data.questionCount,
            difficulty: body.data.difficulty,
            optionCount: body.data.optionCount,
          }),
        },
      ],
    });
    const content = response.choices[0]?.message.content;
    if (!content) throw new Error("The model returned an empty response.");
    const result = generatedQuizSchema.safeParse(JSON.parse(content));
    if (!result.success) throw new Error("The model returned an invalid quiz.");
    if (
      result.data.questions.length !== body.data.questionCount ||
      result.data.questions.some(
        (question) =>
          question.options.length !== body.data.optionCount ||
          question.correctOption >= question.options.length ||
          new Set(question.options).size !== question.options.length,
      )
    ) {
      throw new Error("The model returned a quiz with mismatched question or option counts.");
    }
    generated = result.data;
  } catch (error) {
    req.log.error({ err: error, materialId: material.id }, "Quiz generation failed");
    res.status(502).json({
      error: "The quiz could not be generated. Check the AI provider settings and try again.",
    });
    return;
  }

  const questions: StoredQuestion[] = generated.questions;
  const [quiz] = await db
    .insert(quizzesTable)
    .values({
      userId: req.user.id,
      materialId: material.id,
      title: generated.title,
      difficulty: body.data.difficulty,
      questionCount: questions.length,
      optionCount: body.data.optionCount,
      modelId: MODEL_ID,
      promptVersion: PROMPT_VERSION,
      questions,
    })
    .returning();

  res.status(201).json(GenerateQuizResponse.parse(publicQuiz(quiz)));
});

router.get("/quizzes", async (req, res): Promise<void> => {
  if (!requireAuth(req, res)) return;
  res.json(ListQuizzesResponse.parse(await listQuizSummaries(req.user.id)));
});

router.get("/quizzes/:id", async (req, res): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const params = GetQuizParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [quiz] = await db
    .select()
    .from(quizzesTable)
    .where(
      and(
        eq(quizzesTable.id, params.data.id),
        eq(quizzesTable.userId, req.user.id),
      ),
    )
    .limit(1);
  if (!quiz) {
    res.status(404).json({ error: "Quiz not found." });
    return;
  }

  res.json(GetQuizResponse.parse(publicQuiz(quiz)));
});

router.post("/quizzes/:id/attempts", async (req, res): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const params = SubmitQuizAttemptParams.safeParse(req.params);
  const body = SubmitQuizAttemptBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [quiz] = await db
    .select()
    .from(quizzesTable)
    .where(
      and(
        eq(quizzesTable.id, params.data.id),
        eq(quizzesTable.userId, req.user.id),
      ),
    )
    .limit(1);
  if (!quiz) {
    res.status(404).json({ error: "Quiz not found." });
    return;
  }

  if (
    body.data.answers.length !== quiz.questions.length ||
    body.data.answers.some((answer, index) => answer >= quiz.questions[index].options.length)
  ) {
    res.status(400).json({
      error: "Submit one valid option for every question.",
    });
    return;
  }

  const feedback: StoredFeedback[] = quiz.questions.map((question, index) => ({
    questionIndex: index,
    selectedOption: body.data.answers[index],
    correctOption: question.correctOption,
    explanation: question.explanation,
    isCorrect: body.data.answers[index] === question.correctOption,
  }));
  const correctCount = feedback.filter((item) => item.isCorrect).length;
  const percentage = Math.round((correctCount / feedback.length) * 1000) / 10;
  const [attempt] = await db
    .insert(quizAttemptsTable)
    .values({
      userId: req.user.id,
      quizId: quiz.id,
      answers: body.data.answers,
      correctCount,
      totalQuestions: quiz.questions.length,
      percentage,
      feedback,
    })
    .returning();

  res
    .status(201)
    .json(SubmitQuizAttemptResponse.parse(attempt));
});

router.get("/dashboard", async (req, res): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const [materialTotals] = await db
    .select({ total: count() })
    .from(studyMaterialsTable)
    .where(eq(studyMaterialsTable.userId, req.user.id));
  const [quizTotals] = await db
    .select({ total: count() })
    .from(quizzesTable)
    .where(eq(quizzesTable.userId, req.user.id));
  const [attemptTotals] = await db
    .select({
      total: count(),
      average: avg(quizAttemptsTable.percentage),
    })
    .from(quizAttemptsTable)
    .where(eq(quizAttemptsTable.userId, req.user.id));
  const averageScore =
    attemptTotals.average == null
      ? null
      : Math.round(Number(attemptTotals.average) * 10) / 10;

  res.json(
    GetDashboardResponse.parse({
      totalMaterials: materialTotals.total,
      totalQuizzes: quizTotals.total,
      completedAttempts: attemptTotals.total,
      averageScore,
      recentQuizzes: (await listQuizSummaries(req.user.id)).slice(0, 5),
    }),
  );
});

export default router;