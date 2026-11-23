using System;
using System.Collections.Generic;

namespace CABO.Native;

// Read models mirror the JSON contracts already used by the Android client
// (native-apps/android/.../NativeApi.kt). They hold only what the server chose
// to return for the signed-in account; nothing here is invented client-side.

public sealed record NativeStat(string Name, long Value);

public sealed record NativePortal(
    string Role,
    IReadOnlyList<int> OrganizationIds,
    IReadOnlyList<NativeStat> Summary,
    IReadOnlyList<string> Cards,
    bool CountryScopedRecordsRequired);

public sealed record OrganizationMembership(int Id, string Name, string Role);

// ---- Learner ------------------------------------------------------------
public record NativeMaterialSummary(int Id, string Title);
public record NativeMaterialPage(int Id, string Title, string Text, int Offset, int? NextOffset);

public record NativeQuizSummary(int Id, string Title, int QuestionCount, double? LatestScore);
public record NativeQuizQuestion(string Prompt, IReadOnlyList<string> Options);
public record NativeQuizDetail(int Id, string Title, IReadOnlyList<NativeQuizQuestion> Questions);
public record NativeQuizFeedback(int QuestionIndex, bool IsCorrect, string Explanation);
public record NativeQuizAttempt(int Id, int QuizId, int CorrectCount, int TotalQuestions,
    double Percentage, IReadOnlyList<NativeQuizFeedback> Feedback);

public sealed record SubjectScore(string Name, double? Percentage, int AssessmentCount);

public sealed record LearnerReport(
    int OrganizationId, int Year, string Grade, double? Average,
    int? AttendanceRate, IReadOnlyList<SubjectScore> Subjects);

public sealed record WrittenAssignment(
    int Id, int ExamId, string Title, int OrganizationId, string Organization, string? DueAt);

public sealed record JourneyEntry(int Id, string InstitutionName, string Stage, int AcademicYear, string Note);
public sealed record JourneyMilestone(int Id, string Title, string Description, string Kind, int Year);
public sealed record LearnerJourney(
    string DisplayName, IReadOnlyList<JourneyEntry> Entries, IReadOnlyList<JourneyMilestone> Milestones);

public sealed record SupportCourse(int OrganizationId, int CourseId, string Name);

public sealed record SupportTicket(
    int OrganizationId, int Id, string Concept, string Status, int Version,
    string UpdatedAt, string? ReviewAt, string? Feedback);

public sealed record SupportGuidance(
    string Explanation, IReadOnlyList<string> Questions, IReadOnlyList<string> Practice, string Source);

// ---- School operations (all roles with a membership) ---------------------
public sealed record SchoolNotice(int Id, string Subject, string Message, string Audience, string CreatedAt);
public sealed record AttendanceRecord(string Day, string Status);
public sealed record TimetableSlot(int Id, int Day, string StartsAt, string EndsAt, string Grade,
    string Group, string Subject, string Room, string Status);
public sealed record AttendanceSummary(int Year, int Records, IReadOnlyDictionary<string, int> Counts);

public sealed record SchoolOperations(
    int OrganizationId, string Name, string Role,
    IReadOnlyList<SchoolNotice> Notices,
    IReadOnlyList<AttendanceRecord> Attendance,
    IReadOnlyList<TimetableSlot> Timetable,
    AttendanceSummary? Summary,
    string? Warning);

// ---- Staff ----------------------------------------------------------------
public sealed record StaffWorkspace(
    int OrganizationId, IReadOnlyList<string> Courses, IReadOnlyList<NativeStat> Accountability,
    IReadOnlyList<SupportTicket> Tickets, string? Warning);

public sealed record GuardianReview(int OrganizationId, int Id, string LearnerId, string GuardianId, string Status);

public sealed record ReportIssuance(
    int OrganizationId, int Id, string LearnerId, int AcademicYear, int Version,
    string Status, string? IssuedAt);

public sealed record SchoolIntelligenceLearner(
    string LearnerId, string Grade, double? Average, double? AttendanceRate,
    IReadOnlyList<string> SubjectsAtRisk, int SupportPlans);

public sealed record SchoolIntelligence(
    int OrganizationId, int Year, int AttendanceRecords, IReadOnlyDictionary<string, int> AttendanceCounts,
    int StudentsReviewed, int AttentionNeeded, IReadOnlyList<SchoolIntelligenceLearner> Learners,
    double SubjectBelow, double AttendanceBelow, bool OfficialDistrictData);

// ---- Administrators ------------------------------------------------------
public sealed record EducationCommandSchool(
    int Id, string Name, int? LearnerCount, int? AttendanceRate, bool PrivacySuppressed);

public sealed record EducationCommand(
    int Year, int Institutions, IReadOnlyList<EducationCommandSchool> Schools,
    int MinimumCohort, bool NationalVerified, bool OfficialData);

// ---- Guardians -------------------------------------------------------------
public sealed record GuardianLink(int InvitationId, string Status, string? LearnerName, bool VerifiedForRead);

public sealed record GuardianOverview(IReadOnlyList<GuardianLink> Links, string Guidance);

public sealed record GuardianReport(
    string LearnerId, string LearnerName, int OrganizationId, int Year, string Grade,
    double? Average, IReadOnlyList<SubjectScore> Subjects, int? AttendanceRate,
    int PresentDays, int RecordedDays, bool Official);

public sealed record GuardianReports(IReadOnlyList<GuardianReport> Reports, string Guidance);

public sealed record NotificationChoice(string Kind, bool Enabled, bool CanEnable);
public sealed record NotificationSchool(int Id, string Name, IReadOnlyList<NotificationChoice> Choices);
public sealed record NotificationPreferences(bool Enabled, bool OptInAvailable, IReadOnlyList<NotificationSchool> Schools);

/// <summary>Result of a per-organisation fan-out where some schools may fail.</summary>
public sealed record PartialResult<T>(IReadOnlyList<T> Items, int FailedOrganizations)
{
    public bool IsPartial => FailedOrganizations > 0;
    public static PartialResult<T> Empty { get; } = new(Array.Empty<T>(), 0);
}
