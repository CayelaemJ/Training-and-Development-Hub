package za.co.cabosolutions.learninghub

/** Ephemeral shared demo state. It is reset on entry and is never persisted. */
internal object NativeDemoSession {
    private var current = seed()

    private fun seed(): SupportTicket {
        val summary = SupportTicketSummary(
            organizationId = NativeDemoData.DEMO_ORGANIZATION_ID,
            id = 73031,
            concept = "Adding unlike fractions",
            status = "open",
            version = 1,
            updatedAt = "Today · 09:10"
        )
        return SupportTicket(
            summary,
            "I tried adding the denominators, but my answer did not match the example. What should I try next?",
            "I added 1/3 + 1/4 and got 2/7.",
            listOf(
                SupportTicketEvent("created", "Learner requested help with unlike fractions.", "Today · 09:10"),
                SupportTicketEvent("context", "Synthetic demo request. No learner record is connected.", "Today · 09:10")
            )
        )
    }

    fun reset() { current = seed() }
    fun summary(): SupportTicketSummary = current.summary
    fun ticket(summary: SupportTicketSummary): SupportTicket =
        if (summary.id == current.summary.id && summary.organizationId == current.summary.organizationId) current
        else NativeDemoData.ticket(summary)

    fun createRequest(concept: String, question: String, attempted: String): SupportTicket {
        current = current.copy(
            summary = current.summary.copy(concept = concept.trim(), status = "open", version = 1),
            question = question.trim(),
            attempted = attempted.trim(),
            history = listOf(SupportTicketEvent("created", "Synthetic learner requested educator support.", "Just now · demo"))
        )
        return current
    }

    fun reply(summary: SupportTicketSummary, body: String): SupportTicket {
        require(summary.id == current.summary.id && summary.version == current.summary.version)
        current = current.copy(
            summary = current.summary.copy(version = current.summary.version + 1),
            history = current.history + SupportTicketEvent("reply", body, "Just now · demo")
        )
        return current
    }

    fun triage(summary: SupportTicketSummary, reason: String): SupportTicket {
        require(summary.id == current.summary.id && summary.version == current.summary.version && current.summary.status == "open")
        current = current.copy(
            summary = current.summary.copy(status = "triaged", version = current.summary.version + 1),
            history = current.history + SupportTicketEvent("transition", reason, "Just now · demo")
        )
        return current
    }
}
