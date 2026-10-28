import Foundation

// Display-only progress projection. The CABO backend verifies guardianship,
// school approval, active enrollment and publication status before returning data.
struct NativeReportSubject: Decodable, Identifiable {
    let name: String
    let percentage: Double
    let assessmentCount: Int
    var id: String { name }
}
struct NativeReportAttendance: Decodable {
    let recordedDays: Int
    let presentDays: Int
    let rate: Int?
}
struct NativeGuardianReport: Decodable, Identifiable {
    let learnerId: String
    let learnerName: String
    let organizationId: Int
    let year: Int
    let grade: String
    let subjects: [NativeReportSubject]
    let average: Double?
    let attendance: NativeReportAttendance
    let official: Bool
    let status: String
    var id: String { learnerId + ":" + String(organizationId) + ":" + String(year) }
}
struct NativeGuardianReportEnvelope: Decodable {
    let year: Int
    let reports: [NativeGuardianReport]
    let guidance: String
}

struct NativeLearnerReport: Decodable, Identifiable {
    let learnerId: String
    let year: Int
    let grade: String
    let subjects: [NativeReportSubject]
    let average: Double?
    let attendance: NativeReportAttendance
    let official: Bool
    let visibility: String
    let status: String
    // Institution ID is included in the client-side identity, never inferred
    // from a report body or accepted from untrusted links.
    var organizationId: Int = 0
    var id: String { String(organizationId) + ":" + String(year) }
}
