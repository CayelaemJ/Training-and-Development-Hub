package za.co.cabosolutions.learninghub

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import org.json.JSONArray
import org.json.JSONObject

// Display-only projection of GET /api/guardian/progress/:learnerId. The server
// decides who may see it (verified guardian, this school's latest decision,
// active enrolment) and returns published results only.

internal data class ChildProgressTerm(val period: String, val percentage: Double?)

internal data class ChildProgressStanding(
    val available: Boolean,
    val classAverage: Int?,
    val band: String?,
    val differenceFromAverage: Int?,
    val reason: String,
)

internal data class ChildProgressSubject(
    val subject: String,
    val current: Double?,
    val change: Double?,
    val trend: String,
    val outlookStatus: String,
    val outlookReason: String,
    val standing: ChildProgressStanding,
)

internal data class ChildProgressFocus(val subject: String, val status: String, val reason: String)

internal data class ChildProgressResult(val subject: String, val assessment: String, val percentage: Double)

internal data class ChildProgress(
    val learnerId: String,
    val learnerName: String,
    val organizationId: Int,
    val organization: String,
    val grade: String,
    val year: Int,
    val outlookStatus: String,
    val outlookReasons: List<String>,
    val overallCurrent: Double?,
    val overallChange: Double?,
    val overallTrend: String,
    val terms: List<ChildProgressTerm>,
    val attendanceRate: Double?,
    val attendanceDays: Int,
    val attendanceTrend: String,
    val subjects: List<ChildProgressSubject>,
    val strongest: List<String>,
    val mostImproved: List<String>,
    val focusAreas: List<ChildProgressFocus>,
    val recentResults: List<ChildProgressResult>,
    val method: String,
)

private fun JSONObject.nullableDouble(key: String): Double? =
    if (!has(key) || isNull(key)) null else optDouble(key).takeIf { !it.isNaN() && !it.isInfinite() }

private fun JSONObject.text(key: String, max: Int): String = optString(key, "").trim().take(max)

private fun JSONArray?.objects(limit: Int): List<JSONObject> =
    if (this == null) emptyList() else (0 until minOf(length(), limit)).mapNotNull { optJSONObject(it) }

private fun JSONArray?.strings(limit: Int, max: Int): List<String> =
    if (this == null) emptyList() else (0 until minOf(length(), limit)).mapNotNull { i ->
        optString(i, "").trim().take(max).takeIf { it.isNotEmpty() }
    }

private val TRENDS = setOf("improving", "steady", "declining", "not_enough_data")
private val OUTLOOKS = setOf("on_track", "watch", "needs_support", "not_enough_data")

/** Parses one progress response; returns null when required fields are missing or invalid. */
internal fun parseChildProgress(row: JSONObject): ChildProgress? {
    val learnerId = row.text("learnerId", 160)
    val organizationId = row.optInt("organizationId")
    val year = row.optInt("year")
    if (learnerId.isEmpty() || organizationId <= 0 || year !in 2020..2200) return null
    if (row.optString("visibility") != "verified_guardian") return null
    val outlook = row.optJSONObject("outlook") ?: return null
    val overall = row.optJSONObject("overall") ?: JSONObject()
    val attendance = row.optJSONObject("attendance") ?: JSONObject()
    val highlights = row.optJSONObject("highlights") ?: JSONObject()
    val subjects = row.optJSONArray("subjects").objects(40).mapNotNull { s ->
        val name = s.text("subject", 120)
        if (name.isEmpty()) return@mapNotNull null
        val standing = s.optJSONObject("standing") ?: JSONObject()
        val subjectOutlook = s.optJSONObject("outlook") ?: JSONObject()
        val available = standing.optBoolean("available", false)
        ChildProgressSubject(
            subject = name,
            current = s.nullableDouble("current"),
            change = s.nullableDouble("change"),
            trend = s.optString("trend").takeIf { it in TRENDS } ?: "not_enough_data",
            outlookStatus = subjectOutlook.optString("status").takeIf { it in OUTLOOKS } ?: "not_enough_data",
            outlookReason = subjectOutlook.text("reason", 240),
            standing = ChildProgressStanding(
                available = available,
                classAverage = if (available) standing.optInt("classAverage") else null,
                band = if (available) standing.text("band", 30) else null,
                differenceFromAverage = if (available) standing.optInt("differenceFromAverage") else null,
                reason = standing.text("reason", 240),
            ),
        )
    }
    return ChildProgress(
        learnerId = learnerId,
        learnerName = row.text("learnerName", 160).ifEmpty { "Your child" },
        organizationId = organizationId,
        organization = row.text("organization", 160),
        grade = row.text("grade", 40),
        year = year,
        outlookStatus = outlook.optString("status").takeIf { it in OUTLOOKS } ?: "not_enough_data",
        outlookReasons = outlook.optJSONArray("reasons").strings(8, 200),
        overallCurrent = overall.nullableDouble("current"),
        overallChange = overall.nullableDouble("change"),
        overallTrend = overall.optString("trend").takeIf { it in TRENDS } ?: "not_enough_data",
        terms = overall.optJSONArray("terms").objects(12).mapNotNull { t ->
            t.text("period", 60).takeIf { it.isNotEmpty() }?.let { ChildProgressTerm(it, t.nullableDouble("percentage")) }
        },
        attendanceRate = attendance.nullableDouble("rate"),
        attendanceDays = attendance.optInt("recordedDays").coerceAtLeast(0),
        attendanceTrend = attendance.optString("trend").takeIf { it in TRENDS } ?: "not_enough_data",
        subjects = subjects,
        strongest = highlights.optJSONArray("strongest").strings(3, 120),
        mostImproved = highlights.optJSONArray("mostImproved").objects(3).mapNotNull { it.text("subject", 120).takeIf { s -> s.isNotEmpty() } },
        focusAreas = highlights.optJSONArray("focusAreas").objects(10).mapNotNull { f ->
            val name = f.text("subject", 120)
            if (name.isEmpty()) null else ChildProgressFocus(name, f.optString("status").takeIf { it in OUTLOOKS } ?: "watch", f.text("reason", 240))
        },
        recentResults = row.optJSONArray("recentResults").objects(5).mapNotNull { r ->
            val name = r.text("subject", 120)
            val pct = r.nullableDouble("percentage")
            if (name.isEmpty() || pct == null) null else ChildProgressResult(name, r.text("assessment", 160), pct.coerceIn(0.0, 100.0))
        },
        method = row.optJSONObject("method")?.text("notAPrediction", 300)
            ?: "The outlook describes published results so far. It is not a forecast or an official assessment.",
    )
}

internal fun outlookLabel(status: String): String = when (status) {
    "on_track" -> "On track"
    "watch" -> "Worth watching"
    "needs_support" -> "Needs support"
    else -> "Not enough results yet"
}

internal fun trendLabel(trend: String, change: Double?): String = when (trend) {
    "improving" -> "Improving" + (change?.let { " (+${formatPct(it)} pts)" } ?: "")
    "declining" -> "Declining" + (change?.let { " (${formatPct(it)} pts)" } ?: "")
    "steady" -> "Steady"
    else -> "Not enough data"
}

internal fun bandLabel(band: String?): String = when (band) {
    "top_quarter" -> "Top quarter of the class"
    "upper_middle" -> "Above the class middle"
    "lower_middle" -> "Below the class middle"
    "bottom_quarter" -> "Bottom quarter of the class"
    else -> ""
}

internal fun formatPct(value: Double): String =
    if (value == Math.rint(value)) value.toLong().toString() else String.format(java.util.Locale.ROOT, "%.1f", value)

private fun outlookColor(status: String): Color = when (status) {
    "on_track" -> Color(0xFF2E6B47)
    "watch" -> Color(0xFF8A5A00)
    "needs_support" -> Color(0xFFA3341F)
    else -> Color(0xFF68736B)
}

@Composable
internal fun ChildProgressCard(progress: ChildProgress) {
    val muted = Color(0xFF68736B)
    ElevatedCard(
        Modifier.fillMaxWidth().testTag("child-progress-${progress.learnerId}-${progress.organizationId}"),
        colors = CardDefaults.elevatedCardColors(containerColor = Color(0xFFFFFEFA)),
    ) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(progress.learnerName, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            Text(listOf(progress.organization, progress.grade, progress.year.toString()).filter { it.isNotBlank() }.joinToString(" · "), color = muted)
            Text(
                "Outlook: ${outlookLabel(progress.outlookStatus)}",
                style = MaterialTheme.typography.titleMedium,
                color = outlookColor(progress.outlookStatus),
                fontWeight = FontWeight.SemiBold,
            )
            progress.outlookReasons.forEach { Text("• $it", style = MaterialTheme.typography.bodyMedium) }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Column(Modifier.weight(1f)) {
                    Text("Overall", color = muted, style = MaterialTheme.typography.labelMedium)
                    Text(progress.overallCurrent?.let { "${formatPct(it)}%" } ?: "—", style = MaterialTheme.typography.headlineSmall, color = Color(0xFFC4673A))
                    Text(trendLabel(progress.overallTrend, progress.overallChange), style = MaterialTheme.typography.bodySmall)
                }
                Column(Modifier.weight(1f)) {
                    Text("Attendance", color = muted, style = MaterialTheme.typography.labelMedium)
                    Text(progress.attendanceRate?.let { "${formatPct(it)}%" } ?: "—", style = MaterialTheme.typography.headlineSmall)
                    Text(if (progress.attendanceDays > 0) "${progress.attendanceDays} days recorded · ${trendLabel(progress.attendanceTrend, null)}" else "No days recorded", style = MaterialTheme.typography.bodySmall)
                }
            }
            val termsWithData = progress.terms.filter { it.percentage != null }
            if (termsWithData.isNotEmpty()) {
                val summary = termsWithData.joinToString(", ") { "${it.period} ${formatPct(it.percentage!!)}%" }
                Text(
                    "Term by term: $summary",
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.semantics { contentDescription = "Overall result by term: $summary" },
                )
            }
            if (progress.strongest.isNotEmpty()) Text("Strongest: ${progress.strongest.joinToString(", ")}", style = MaterialTheme.typography.bodyMedium)
            if (progress.mostImproved.isNotEmpty()) Text("Most improved: ${progress.mostImproved.joinToString(", ")}", style = MaterialTheme.typography.bodyMedium)
            if (progress.subjects.isNotEmpty()) {
                HorizontalDivider()
                progress.subjects.forEach { subject ->
                    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text(subject.subject, modifier = Modifier.weight(1f), fontWeight = FontWeight.SemiBold)
                            Text(subject.current?.let { "${formatPct(it)}%" } ?: "—", fontWeight = FontWeight.SemiBold)
                        }
                        Text("${trendLabel(subject.trend, subject.change)} · ${outlookLabel(subject.outlookStatus)}",
                            style = MaterialTheme.typography.bodySmall, color = outlookColor(subject.outlookStatus))
                        val standing = subject.standing
                        Text(
                            if (standing.available) "Class average ${standing.classAverage}% · ${bandLabel(standing.band)}"
                            else standing.reason,
                            style = MaterialTheme.typography.bodySmall, color = muted,
                        )
                    }
                }
            }
            if (progress.focusAreas.isNotEmpty()) {
                HorizontalDivider()
                Text("Where to focus", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                progress.focusAreas.forEach { Text("• ${it.subject}: ${it.reason.ifBlank { outlookLabel(it.status) }}", style = MaterialTheme.typography.bodyMedium) }
            }
            if (progress.recentResults.isNotEmpty()) {
                HorizontalDivider()
                Text("Latest published results", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                progress.recentResults.forEach { r ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(listOf(r.subject, r.assessment).filter { it.isNotBlank() }.joinToString(" · "), modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
                        Text("${formatPct(r.percentage)}%", style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }
            Text(progress.method, style = MaterialTheme.typography.bodySmall, color = muted)
        }
    }
}
