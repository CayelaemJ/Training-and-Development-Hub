package za.co.cabosolutions.learninghub

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class NativeDevelopmentPlanRulesTest {
    private fun request() = NativeDevelopmentPlanRules.build("Improve my netball passing", 6, "sport",
        "Netball", "School team", "Quick feet", "Accuracy").getOrThrow()
    private fun plan(reviewWeek: Int = 3, steps: List<String> = listOf("Warm up gently.", "Pass against a wall.")) =
        DevelopmentPlan("Netball passing plan", "A six-week draft to improve passing accuracy.",
            listOf(DevelopmentRecommendation("sport", "Improve chest-pass accuracy", steps, "Count clean passes", reviewWeek)),
            "A coach should review this plan before use.", fromTemplate = false, warning = null)

    @Test fun validInputIsNormalised() {
        val r = NativeDevelopmentPlanRules.build("  Improve   my passing ", 6, "sport", " Netball ", "", "", "").getOrThrow()
        assertEquals("Improve my passing", r.goal)
        assertEquals("Netball", r.observations.single().activity)
        assertEquals("sport", r.observations.single().area)
    }

    @Test fun shortGoalIsRejected() {
        assertTrue(NativeDevelopmentPlanRules.build("Run", 6, "sport", "Athletics", "", "", "").isFailure)
    }

    @Test fun unknownAreaIsRejected() {
        assertTrue(NativeDevelopmentPlanRules.build("Get faster at sprints", 6, "medical", "Athletics", "", "", "").isFailure)
    }

    @Test fun outOfRangePeriodIsRejected() {
        assertTrue(NativeDevelopmentPlanRules.build("Get faster at sprints", 13, "sport", "Athletics", "", "", "").isFailure)
        assertTrue(NativeDevelopmentPlanRules.build("Get faster at sprints", 1, "sport", "Athletics", "", "", "").isFailure)
    }

    @Test fun overlongFieldsAreRejected() {
        assertTrue(NativeDevelopmentPlanRules.build("Get faster", 6, "sport", "Athletics", "x".repeat(281), "", "").isFailure)
        assertTrue(NativeDevelopmentPlanRules.build("Get faster", 6, "sport", "Athletics", "", "x".repeat(451), "").isFailure)
    }

    @Test fun validPlanPasses() { assertEquals(plan(), NativeDevelopmentPlanRules.validate(plan(), request())) }

    @Test fun reviewWeekBeyondPlanIsRejected() {
        assertTrue(runCatching { NativeDevelopmentPlanRules.validate(plan(reviewWeek = 9), request()) }.isFailure)
    }

    @Test fun recommendationNeedsTwoToFourSteps() {
        assertTrue(runCatching { NativeDevelopmentPlanRules.validate(plan(steps = listOf("Only one")), request()) }.isFailure)
        assertTrue(runCatching { NativeDevelopmentPlanRules.validate(plan(steps = List(5) { "Step $it" }), request()) }.isFailure)
    }

    @Test fun errorsAreFriendly() {
        assertTrue(NativeDevelopmentPlanRules.errorMessage(IllegalStateException("CABO API HTTP 429")).contains("Wait a minute"))
        assertTrue(NativeDevelopmentPlanRules.errorMessage(java.io.IOException()).contains("offline"))
    }
}
