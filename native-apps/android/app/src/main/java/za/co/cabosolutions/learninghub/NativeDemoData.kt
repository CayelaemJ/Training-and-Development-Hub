package za.co.cabosolutions.learninghub

/** Fictional fixtures used only by the explicitly enabled internal demo build. */
internal object NativeDemoData {
    const val DEMO_ORGANIZATION_ID = 7301

    fun forRole(role: String): NativeLearning = when (role) {
        "teacher" -> teacher()
        "parent" -> parent()
        else -> learner()
    }

    private fun schoolOperations(role: String) = listOf(SchoolOperationsWorkspace(
        organizationId = DEMO_ORGANIZATION_ID,
        organizationName = "Cabo Valley Learning Centre",
        membershipRole = role,
        notices = listOf(SchoolNotice(73051, "Term 2 learning showcase",
            "Families are invited to the learner showcase on Friday at 14:00.", "all", "2026-10-20T10:00:00Z")),
        attendance = if (role == "learner") listOf(
            SchoolAttendanceRecord("2026-10-28", "present"),
            SchoolAttendanceRecord("2026-10-27", "present"),
            SchoolAttendanceRecord("2026-10-26", "late")
        ) else emptyList(),
        timetable = listOf(
            SchoolTimetableSlot(73061, 1, "08:00", "08:45", "Form 2", "A", "Mathematics", "Room 4", "sample-teacher", "published"),
            SchoolTimetableSlot(73062, 2, "09:00", "09:45", "Form 2", "A", "Integrated Science", "Lab 1", "sample-teacher", "published")
        ),
        notice = "Sample timetable and school notice. This demo is not connected to a school account."
    ))

    fun learner(): NativeLearning {
        val year = java.util.Calendar.getInstance().get(java.util.Calendar.YEAR)
        val demoTicket = NativeDemoSession.ticket(NativeDemoSession.summary())
        val helpSummary = buildList {
            add("${demoTicket.summary.concept} · ${demoTicket.summary.status.replace('_', ' ')}")
            demoTicket.history.lastOrNull { it.kind == "reply" }?.let {
                add("Educator reply: ${it.body.take(120)}")
            }
        }
        return NativeLearning(
            portal = NativePortal(
                role = "learner",
                summary = listOf("3 subjects", "2 practice tests", "1 support request"),
                areas = listOf("My learning", "Progress", "Support")
            ),
            materials = listOf("Fractions made visual", "Reading with evidence"),
            quizzes = listOf("Fractions checkpoint", "Reading comprehension"),
            journey = listOf("Current stage: Form 2", "4 learning milestones", "Next review: end of term"),
            learnerHelp = helpSummary,
            learnerSupportTickets = listOf(demoTicket.summary),
            materialEntries = listOf(
                MaterialSummary(73011, "Fractions made visual"),
                MaterialSummary(73012, "Reading with evidence")
            ),
            quizEntries = listOf(
                QuizSummary(73021, "Fractions checkpoint", 3, 66.7),
                QuizSummary(73022, "Reading comprehension", 2, null)
            ),
            learnerReports = listOf(
                LearnerAcademicReport(
                    organizationId = DEMO_ORGANIZATION_ID,
                    year = year,
                    grade = "Form 2",
                    average = 74.5,
                    subjects = listOf(
                        GuardianSubject("Mathematics", 68.0, 4),
                        GuardianSubject("English", 81.0, 3),
                        GuardianSubject("Integrated Science", 75.0, 3)
                    ),
                    attendanceRate = 94,
                    presentDays = 47,
                    recordedDays = 50
                )
            ),
            schoolOperations = schoolOperations("learner")
        )
    }

    fun teacher(): NativeLearning {
        val ticket = NativeDemoSession.summary()
        return NativeLearning(
            portal = NativePortal(
                role = "teacher",
                summary = listOf("2 assigned subjects", "1 sample learner request", "Local reply workflow"),
                areas = listOf("My classes", "Support queue", "Progress")
            ),
            materials = emptyList(), quizzes = emptyList(),
            staff = listOf(
                StaffWorkspace(
                    organizationId = DEMO_ORGANIZATION_ID,
                    courses = listOf("Mathematics · Form 2", "Integrated Science · Form 2"),
                    supportSummary = listOf("Open requests: 1", "Unassigned: 0", "Follow-ups due: 0"),
                    tickets = listOf(ticket), notice = null
                )
            ),
            schoolOperations = schoolOperations("teacher")
        )
    }

    fun parent(): NativeLearning {
        val year = java.util.Calendar.getInstance().get(java.util.Calendar.YEAR)
        return NativeLearning(
            portal = NativePortal(
                role = "parent",
                summary = listOf("1 verified learner connection", "1 invitation awaiting your reply"),
                areas = listOf("Family", "Verified progress", "Messages")
            ),
            materials = emptyList(), quizzes = emptyList(),
            guardians = listOf(
                GuardianInvite(73041, "verified", "Ari Sample", true),
                GuardianInvite(73042, "pending", null, false)
            ),
            parentGuidance = "Demo records only. School verification controls which progress can be viewed.",
            parentReports = listOf(
                GuardianAcademicReport(
                    learnerId = "synthetic-learner-7301",
                    learnerName = "Ari Sample",
                    organizationId = DEMO_ORGANIZATION_ID,
                    year = year,
                    grade = "Form 2",
                    average = 74.5,
                    subjects = listOf(
                        GuardianSubject("Mathematics", 68.0, 4),
                        GuardianSubject("English", 81.0, 3),
                        GuardianSubject("Integrated Science", 75.0, 3)
                    ),
                    attendanceRate = 94,
                    presentDays = 47,
                    recordedDays = 50,
                    official = false
                )
            ),
            parentReportNotice = "Synthetic school-verified preview · not an official report card"
        )
    }

    fun ticket(summary: SupportTicketSummary): SupportTicket = SupportTicket(
        summary = summary,
        question = "I tried adding the denominators, but my answer did not match the example. What should I try next?",
        attempted = "I added 1/3 + 1/4 and got 2/7.",
        history = emptyList()
    )

    fun quiz(id: Int): PracticeQuiz = when (id) {
        73022 -> PracticeQuiz(
            id, "Reading comprehension", listOf(
                QuizQuestion("Which sentence gives evidence for the author's main point?",
                    listOf("The sentence with the supporting example", "The page number")),
                QuizQuestion("What should you do when a word is unfamiliar?",
                    listOf("Use the surrounding sentence", "Skip the whole paragraph"))
            )
        )
        else -> PracticeQuiz(
            73021, "Fractions checkpoint", listOf(
                QuizQuestion("What is a common denominator for 1/3 and 1/4?",
                    listOf("7", "12", "1")),
                QuizQuestion("What is 1/3 + 1/4?",
                    listOf("2/7", "7/12", "1/12")),
                QuizQuestion("Which fraction is equivalent to 1/2?",
                    listOf("2/5", "3/6", "1/3"))
            )
        )
    }

    fun materialPage(id: Int, offset: Int): MaterialPage {
        val reading = id == 73012
        val title = if (reading) "Reading with evidence" else "Fractions made visual"
        val text = when {
            reading && offset == 0 -> "Good readers look for evidence in the text. A character's actions, a repeated idea or a detail in the setting can help support an answer.\n\nAs you read, ask: which exact sentence or detail helped me decide?"
            reading -> "A strong answer explains the clue and connects it to the question. For example, if the character shares their lunch, that action may show kindness. Point to the detail before making your inference.\n\nTry it: choose one action from a story you know and explain what it suggests about the character."
            offset == 0 -> "A fraction names equal parts of a whole.\n\nWhen adding fractions, first check whether the denominators match. If they do not, find a common denominator. For 1/3 and 1/4, twelve works because it is a multiple of both three and four."
            else -> "Rewrite 1/3 as 4/12 and 1/4 as 3/12. Then add the numerators: 4/12 + 3/12 = 7/12.\n\nTry drawing two same-sized rectangles and shade each fraction using twelfths."
        }
        return MaterialPage(id, title, text, offset, if (offset == 0) 1 else null)
    }
}
