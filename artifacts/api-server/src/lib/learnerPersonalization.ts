import { eq } from "drizzle-orm";
import { db, learnerAiProfilesTable } from "@workspace/db";
import { learnerAiPersonalizationContext } from "./learnerAiProfilePolicy";
import type { LearnerPersonalization } from "./caboVoice";

/** The learner's own opted-in AI preferences, or null. Never fails a request. */
export async function learnerPersonalization(userId: string): Promise<LearnerPersonalization> {
  try {
    const [profile] = await db.select({
      personalizationEnabled: learnerAiProfilesTable.personalizationEnabled,
      goals: learnerAiProfilesTable.goals,
      interests: learnerAiProfilesTable.interests,
      preferredLanguage: learnerAiProfilesTable.preferredLanguage,
      explanationStyle: learnerAiProfilesTable.explanationStyle,
      learningPreferences: learnerAiProfilesTable.learningPreferences,
    }).from(learnerAiProfilesTable).where(eq(learnerAiProfilesTable.userId, userId)).limit(1);
    return learnerAiPersonalizationContext(profile ?? null) as LearnerPersonalization;
  } catch {
    return null;
  }
}
