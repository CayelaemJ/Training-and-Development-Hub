using System;
using System.Collections.Generic;
using System.Linq;

namespace CABO.Native;

public enum NativeSection
{
    Overview,
    // Learner
    Reports, Materials, Practice, Assignments, Journey, HelpRequests,
    // Shared school operations (notices, attendance, timetable)
    School,
    // Staff
    SupportQueue, GuardianReviews, ReportIssuance, SchoolIntelligence,
    // Guardian
    Family, FamilyReports, Notifications,
    // Administration
    Registry, EducationCommand
}

/// <summary>
/// Chooses which sections to <em>show</em>. This is presentation only: every
/// request is authorised again by the CABO server from the bearer session, and
/// a 403 is rendered as "not authorised" rather than hidden data.
/// </summary>
public static class RoleAccess
{
    public static readonly IReadOnlySet<string> StaffRoles = new HashSet<string>(StringComparer.Ordinal)
    {
        "teacher", "assessor", "headmaster", "deputy_headmaster", "department_head", "grade_head"
    };

    public static readonly IReadOnlySet<string> OversightRoles = new HashSet<string>(StringComparer.Ordinal)
    {
        "superadmin", "national_director", "provincial_director", "district_director",
        "group_executive", "governing_body_chair", "administrator", "headmaster"
    };

    public static readonly IReadOnlySet<string> ManagerMembershipRoles = new HashSet<string>(StringComparer.Ordinal)
    {
        "owner", "admin"
    };

    public static readonly IReadOnlySet<string> IntelligenceMembershipRoles = new HashSet<string>(StringComparer.Ordinal)
    {
        "owner", "admin", "teacher", "assessor"
    };

    public static bool IsLearner(string role) => role == "learner";
    public static bool IsGuardian(string role) => role == "parent";
    public static bool IsStaff(string role) => StaffRoles.Contains(role);
    public static bool IsPlatformAdmin(string role) => role == "superadmin";

    public static IReadOnlyList<NativeSection> SectionsFor(string role, IReadOnlyList<OrganizationMembership> memberships)
    {
        var sections = new List<NativeSection> { NativeSection.Overview };
        var hasMembership = memberships.Count > 0;
        var manages = memberships.Any(m => ManagerMembershipRoles.Contains(m.Role));

        if (IsLearner(role))
        {
            sections.AddRange(new[]
            {
                NativeSection.Reports, NativeSection.Materials, NativeSection.Practice,
                NativeSection.Assignments, NativeSection.HelpRequests, NativeSection.Journey
            });
        }
        else if (IsGuardian(role))
        {
            sections.AddRange(new[]
            {
                NativeSection.Family, NativeSection.FamilyReports, NativeSection.Notifications
            });
        }
        else if (IsStaff(role))
        {
            sections.AddRange(new[]
            {
                NativeSection.SupportQueue, NativeSection.Materials, NativeSection.GuardianReviews,
                NativeSection.ReportIssuance
            });
        }

        if (!IsGuardian(role) && hasMembership) sections.Add(NativeSection.School);

        if (memberships.Any(m => IntelligenceMembershipRoles.Contains(m.Role)) || (IsStaff(role) && hasMembership))
            sections.Add(NativeSection.SchoolIntelligence);

        if (OversightRoles.Contains(role) || manages)
            sections.Add(NativeSection.EducationCommand);

        if (IsPlatformAdmin(role)) sections.Add(NativeSection.Registry);

        return sections.Distinct().ToArray();
    }

    public static string Title(NativeSection section) => section switch
    {
        NativeSection.Overview => "Overview",
        NativeSection.Reports => "My progress",
        NativeSection.Materials => "Study materials",
        NativeSection.Practice => "Practice tests",
        NativeSection.Assignments => "Assignments",
        NativeSection.Journey => "Journey & achievements",
        NativeSection.HelpRequests => "Ask for help",
        NativeSection.School => "School notices",
        NativeSection.SupportQueue => "Learner support",
        NativeSection.GuardianReviews => "Guardian verification",
        NativeSection.ReportIssuance => "Report issuance",
        NativeSection.SchoolIntelligence => "Academic analytics",
        NativeSection.Family => "My children",
        NativeSection.FamilyReports => "Progress reports",
        NativeSection.Notifications => "Notifications & consent",
        NativeSection.Registry => "Institution registry",
        NativeSection.EducationCommand => "District & provincial view",
        _ => section.ToString()
    };

    public static string FriendlyRole(string role) => role switch
    {
        "parent" => "Parent or guardian",
        "superadmin" => "Platform administrator",
        _ => string.Join(' ', role.Split('_', StringSplitOptions.RemoveEmptyEntries)
            .Select(w => char.ToUpperInvariant(w[0]) + w[1..]))
    };
}
