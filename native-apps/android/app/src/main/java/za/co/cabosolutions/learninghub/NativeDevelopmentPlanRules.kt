package za.co.cabosolutions.learninghub

/**
 * Sports and wider development plan drafts, using the existing POST /api/development-plans/draft
 * route. The server runs the AI (Groq) or falls back to a deterministic starter template, and
 * always marks the result as an unverified draft that needs a coach, teacher or guardian review.
 * Kept free of Android types so the rules run as JVM unit tests.
 */
internal data class DevelopmentObservation(
    val area: String, val activity: String, val currentLevel: String, val strengths: String, val focus: String
)
internal data class DevelopmentPlanRequest(val goal: String, val periodWeeks: Int, val observations: List<DevelopmentObservation>)
internal data class DevelopmentRecommendation(
    val area: String, val goal: String, val steps: List<String>, val measure: String, val reviewWeek: Int
)
internal data class DevelopmentPlan(
    val title: String, val summary: String, val recommendations: List<DevelopmentRecommendation>,
    val reviewNote: String, val fromTemplate: Boolean, val warning: String?
)

internal object NativeDevelopmentPlanRules {
    val areas = listOf("sport", "academic", "creative", "leadership", "extracurricular")
    val areaLabels = mapOf(
        "sport" to "Sport", "academic" to "Academic", "creative" to "Creative",
        "leadership" to "Leadership", "extracurricular" to "Other activity"
    )
    val periodChoices = listOf(2, 4, 6, 8, 12)

    private fun clean(value: String) = value.replace(Regex("\\s+"), " ").trim()

    /** Returns a normalised request or a learner-friendly reason it cannot be sent. */
    fun build(goal: String, periodWeeks: Int, area: String, activity: String, currentLevel: String,
              strengths: String, focus: String): Result<DevelopmentPlanRequest> {
        val g = clean(goal); val a = clean(activity)
        val level = clean(currentLevel); val s = clean(strengths); val f = clean(focus)
        fun fail(message: String) = Result.failure<DevelopmentPlanRequest>(IllegalArgumentException(message))
        if (g.length !in 5..500) return fail("Describe your goal in 5 to 500 characters.")
        if (periodWeeks !in 2..12) return fail("Choose a plan length between 2 and 12 weeks.")
        if (area !in areas) return fail("Choose an area.")
        if (a.length !in 2..100) return fail("Name the activity, for example netball or chess club.")
        if (level.length > 280) return fail("Keep your current level under 280 characters.")
        if (s.length > 450 || f.length > 450) return fail("Keep strengths and focus under 450 characters each.")
        return Result.success(DevelopmentPlanRequest(g, periodWeeks, listOf(DevelopmentObservation(area, a, level, s, f))))
    }

    /** Validates the server plan before display. Throws on anything unexpected. */
    fun validate(plan: DevelopmentPlan, request: DevelopmentPlanRequest): DevelopmentPlan {
        require(plan.title.length in 3..120 && plan.summary.length in 10..700) { "Invalid plan" }
        require(plan.recommendations.size in 1..8) { "Invalid recommendations" }
        require(plan.recommendations.all { r ->
            r.goal.isNotBlank() && r.goal.length <= 300 && r.steps.size in 2..4 &&
                r.steps.all { it.isNotBlank() && it.length <= 250 } && r.measure.isNotBlank() &&
                r.reviewWeek in 1..request.periodWeeks
        }) { "Invalid recommendation" }
        require(plan.reviewNote.isNotBlank() && plan.reviewNote.length <= 500) { "Invalid review note" }
        return plan
    }

    fun errorMessage(error: Throwable): String {
        if (error.message == "Session expired") return "Your session ended. Sign in again to make a plan."
        if (error is java.net.SocketTimeoutException) return "The planner took too long. Check your connection and try again."
        if (error is java.io.IOException) return "You appear to be offline. Nothing was sent."
        return when (NativeTutorRules.statusOf(error)) {
            400 -> "Check your goal and activity details, then try again."
            429 -> "Too many plans were requested. Wait a minute, then try again."
            else -> "A plan couldn't be made just now. Please try again shortly."
        }
    }
}
