import SwiftUI

// Display-only projection of GET /api/guardian/progress/:learnerId. The CABO
// backend decides who may see it (verified guardian, this school's latest
// decision, active enrolment) and returns published results only.

struct NativeChildSummary: Decodable {
    let learnerId: String
    let organizationId: Int
    let academicYear: Int
}

struct NativeChildProgressTerm: Decodable, Identifiable {
    let period: String
    let percentage: Double?
    var id: String { period }
}

struct NativeChildProgressStanding: Decodable {
    let available: Bool
    let classAverage: Int?
    let band: String?
    let reason: String?
}

struct NativeChildProgressOutlook: Decodable {
    let status: String
    let reasons: [String]
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        status = NativeChildProgress.knownOutlook(try c.decodeIfPresent(String.self, forKey: .status))
        reasons = Array((try c.decodeIfPresent([String].self, forKey: .reasons) ?? []).prefix(8))
    }
    init(status: String, reasons: [String]) { self.status = status; self.reasons = reasons }
    enum CodingKeys: String, CodingKey { case status, reasons }
}

struct NativeChildProgressSubjectOutlook: Decodable {
    let status: String
    let reason: String
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        status = NativeChildProgress.knownOutlook(try c.decodeIfPresent(String.self, forKey: .status))
        reason = try c.decodeIfPresent(String.self, forKey: .reason) ?? ""
    }
    enum CodingKeys: String, CodingKey { case status, reason }
}

struct NativeChildProgressSubject: Decodable, Identifiable {
    let subject: String
    let current: Double?
    let change: Double?
    let trend: String
    let outlook: NativeChildProgressSubjectOutlook
    let standing: NativeChildProgressStanding
    var id: String { subject }
}

struct NativeChildProgressOverall: Decodable {
    let current: Double?
    let change: Double?
    let trend: String
    let terms: [NativeChildProgressTerm]
}

struct NativeChildProgressAttendance: Decodable {
    let recordedDays: Int
    let rate: Double?
    let trend: String
}

struct NativeChildProgressFocus: Decodable, Identifiable {
    let subject: String
    let status: String
    let reason: String
    var id: String { subject }
}

struct NativeChildProgressImproved: Decodable { let subject: String }

struct NativeChildProgressHighlights: Decodable {
    let strongest: [String]
    let mostImproved: [NativeChildProgressImproved]
    let focusAreas: [NativeChildProgressFocus]
}

struct NativeChildProgressResult: Decodable, Identifiable {
    let subject: String
    let assessment: String
    let percentage: Double
    var id: String { subject + "|" + assessment }
}

struct NativeChildProgressMethod: Decodable { let notAPrediction: String }

struct NativeChildProgress: Decodable, Identifiable {
    let learnerId: String
    let learnerName: String
    let organizationId: Int
    let organization: String
    let grade: String
    let year: Int
    let visibility: String
    let overall: NativeChildProgressOverall
    let outlook: NativeChildProgressOutlook
    let subjects: [NativeChildProgressSubject]
    let highlights: NativeChildProgressHighlights
    let attendance: NativeChildProgressAttendance
    let recentResults: [NativeChildProgressResult]
    let method: NativeChildProgressMethod
    var id: String { learnerId + ":" + String(organizationId) }

    static func knownOutlook(_ value: String?) -> String {
        ["on_track", "watch", "needs_support", "not_enough_data"].contains(value ?? "") ? value! : "not_enough_data"
    }

    /// Decodes a server response and refuses anything not addressed to a verified guardian.
    static func decodeVerified(_ data: Data) -> NativeChildProgress? {
        guard let value = try? JSONDecoder().decode(NativeChildProgress.self, from: data),
              value.visibility == "verified_guardian", !value.learnerId.isEmpty,
              value.organizationId > 0, (2020...2200).contains(value.year) else { return nil }
        return value
    }

    static func outlookLabel(_ status: String) -> String {
        switch status {
        case "on_track": return "On track"
        case "watch": return "Worth watching"
        case "needs_support": return "Needs support"
        default: return "Not enough results yet"
        }
    }

    static func trendLabel(_ trend: String, _ change: Double?) -> String {
        switch trend {
        case "improving": return "Improving" + (change.map { " (+\(format($0)) pts)" } ?? "")
        case "declining": return "Declining" + (change.map { " (\(format($0)) pts)" } ?? "")
        case "steady": return "Steady"
        default: return "Not enough data"
        }
    }

    static func bandLabel(_ band: String?) -> String {
        switch band {
        case "top_quarter": return "Top quarter of the class"
        case "upper_middle": return "Above the class middle"
        case "lower_middle": return "Below the class middle"
        case "bottom_quarter": return "Bottom quarter of the class"
        default: return ""
        }
    }

    static func format(_ value: Double) -> String {
        let clamped = min(max(value, -100), 100)
        return clamped.rounded() == clamped ? String(Int(clamped)) : String(format: "%.1f", clamped)
    }

    static func color(_ status: String) -> Color {
        switch status {
        case "on_track": return .green
        case "watch": return .orange
        case "needs_support": return .red
        default: return .secondary
        }
    }
}

struct NativeChildProgressCard: View {
    let progress: NativeChildProgress

    private func pct(_ value: Double?) -> String { value.map { NativeChildProgress.format($0) + "%" } ?? "—" }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(progress.learnerName).font(.title3.bold()).accessibilityAddTraits(.isHeader)
            Text([progress.organization, progress.grade, String(progress.year)].filter { !$0.isEmpty }.joined(separator: " · "))
                .font(.subheadline).foregroundColor(.secondary)
            Text("Outlook: \(NativeChildProgress.outlookLabel(progress.outlook.status))")
                .font(.headline).foregroundColor(NativeChildProgress.color(progress.outlook.status))
            ForEach(progress.outlook.reasons, id: \.self) { Text("• \($0)").font(.subheadline) }
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Overall").font(.caption).foregroundColor(.secondary)
                    Text(pct(progress.overall.current)).font(.title2.bold())
                    Text(NativeChildProgress.trendLabel(progress.overall.trend, progress.overall.change)).font(.caption)
                }
                Spacer()
                VStack(alignment: .leading, spacing: 2) {
                    Text("Attendance").font(.caption).foregroundColor(.secondary)
                    Text(pct(progress.attendance.rate)).font(.title2.bold())
                    Text(progress.attendance.recordedDays > 0
                         ? "\(progress.attendance.recordedDays) days · \(NativeChildProgress.trendLabel(progress.attendance.trend, nil))"
                         : "No days recorded").font(.caption)
                }
            }
            let terms = progress.overall.terms.filter { $0.percentage != nil }
            if !terms.isEmpty {
                let summary = terms.map { "\($0.period) \(pct($0.percentage))" }.joined(separator: ", ")
                Text("Term by term: \(summary)").font(.footnote)
                    .accessibilityLabel("Overall result by term: \(summary)")
            }
            if !progress.highlights.strongest.isEmpty {
                Text("Strongest: \(progress.highlights.strongest.prefix(3).joined(separator: ", "))").font(.subheadline)
            }
            if !progress.highlights.mostImproved.isEmpty {
                Text("Most improved: \(progress.highlights.mostImproved.prefix(3).map(\.subject).joined(separator: ", "))").font(.subheadline)
            }
            if !progress.subjects.isEmpty {
                Divider()
                ForEach(progress.subjects.prefix(40)) { subject in
                    VStack(alignment: .leading, spacing: 2) {
                        HStack {
                            Text(subject.subject).font(.subheadline.bold())
                            Spacer()
                            Text(pct(subject.current)).font(.subheadline.bold())
                        }
                        Text("\(NativeChildProgress.trendLabel(subject.trend, subject.change)) · \(NativeChildProgress.outlookLabel(subject.outlook.status))")
                            .font(.caption).foregroundColor(NativeChildProgress.color(subject.outlook.status))
                        Text(subject.standing.available
                             ? "Class average \(subject.standing.classAverage ?? 0)% · \(NativeChildProgress.bandLabel(subject.standing.band))"
                             : (subject.standing.reason ?? ""))
                            .font(.caption).foregroundColor(.secondary)
                    }
                }
            }
            if !progress.highlights.focusAreas.isEmpty {
                Divider()
                Text("Where to focus").font(.headline)
                ForEach(progress.highlights.focusAreas.prefix(10)) { focus in
                    Text("• \(focus.subject): \(focus.reason.isEmpty ? NativeChildProgress.outlookLabel(focus.status) : focus.reason)")
                        .font(.subheadline)
                }
            }
            if !progress.recentResults.isEmpty {
                Divider()
                Text("Latest published results").font(.headline)
                ForEach(progress.recentResults.prefix(5)) { result in
                    HStack {
                        Text([result.subject, result.assessment].filter { !$0.isEmpty }.joined(separator: " · ")).font(.subheadline)
                        Spacer()
                        Text(NativeChildProgress.format(min(max(result.percentage, 0), 100)) + "%").font(.subheadline)
                    }
                }
            }
            Text(progress.method.notAPrediction).font(.footnote).foregroundColor(.secondary)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(UIColor.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 16))
    }
}
