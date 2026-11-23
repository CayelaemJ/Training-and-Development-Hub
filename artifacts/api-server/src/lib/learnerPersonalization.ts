/**
 * Fetches the learner's AI personalization profile from the database.
 *
 * Never throws — returns null if no profile exists or on any DB error
 * so that the absence of a profile never fails a request.
 */

import { eq } from "drizzle-orm";
import { db } from "../db";
import { learnerAiProfilesTable, userProfilesTable } from "../db/schema";
import { learnerAiPersonalizationContext } from "./learnerAiPersonalizationContext";

export type { LearnerPersonalization } from "./learnerAiPersonalizationContext";

/**
 * Returns the learner's personalization context, enriched with their display
 * name from `user_profiles`. Both queries are wrapped in try/catch; the
 * outer catch ensures the whole function is infallible.
 */
export async function learnerPersonalization(
  userId: string,
): Promise<import("./learnerAiPersonalizationContext").LearnerPersonalization> {
  try {
    const [profile] = await db
      .select({
        userId: learnerAiProfilesTable.userId,
        explanationStyle: learnerAiProfilesTable.explanationStyle,
        languagePreference: learnerAiProfilesTable.languagePreference,
        interests: learnerAiProfilesTable.interests,
        goals: learnerAiProfilesTable.goals,
        grade: learnerAiProfilesTable.grade,
        curriculum: learnerAiProfilesTable.curriculum,
        createdAt: learnerAiProfilesTable.createdAt,
        updatedAt: learnerAiProfilesTable.updatedAt,
      })
      .from(learnerAiProfilesTable)
      .where(eq(learnerAiProfilesTable.userId, userId))
      .limit(1);

    const context = learnerAiPersonalizationContext(
      profile ?? null,
    ) as import("./learnerAiPersonalizationContext").LearnerPersonalization;

    if (!context) return null;

    // Enrich with display name (non-critical — ignore errors)
    try {
      const [userProfile] = await db
        .select({ displayName: userProfilesTable.displayName })
        .from(userProfilesTable)
        .where(eq(userProfilesTable.userId, userId))
        .limit(1);

      if (userProfile?.displayName?.trim()) {
        context.displayName = userProfile.displayName.trim();
      }
    } catch {
      /* Non-critical: carry on without display name */
    }

    return context;
  } catch {
    return null;
  }
}
