CABO Learning Hub for Windows — 1.1.0
=====================================

What's new
----------
* Role-based navigation for learners, teachers and school leaders, parents and
  guardians, and administrators. Sections appear according to the role CABO
  assigns to your account; every record is still authorised by the CABO server.
* Learners: progress by subject with suggested next steps, study materials,
  practice tests with server marking, assignments, achievements and learning
  journey, and "Ask for help" requests to teachers.
* Teachers and school leaders: learner support queue with reviewable drafted
  guidance and replies, study material upload, guardian verification
  decisions, report issuance status, academic analytics with intervention
  flags, notices, attendance and timetables.
* Parents and guardians: linked learners (names shown only after school
  verification), accept or decline invitations, progress reports, and
  notification consent you can withdraw at any time.
* Administrators: institution registry (platform administrators) and a
  privacy-thresholded district and provincial overview.
* Offline banner with automatic refresh on reconnect; sessions end
  automatically after one hour.
* Windows installer with Start menu shortcut and clean uninstall that also
  removes the local encrypted session and diagnostic log.

Privacy and security
--------------------
* Sign-in happens in your web browser (PKCE). The app never sees your password.
* Only a one-hour session is stored, encrypted for your Windows account.
  Learner records and materials are not saved on the PC.
* Uploaded materials are not made available to AI reading by default.

Known limitations
-----------------
* Written examinations, report issuance decisions and journey editing are done
  in the CABO web app.
* There is no in-app child-safety report form yet; follow your school's
  safeguarding procedure.
* Unless SIGNING_STATUS.txt says SIGNED, this build is unsigned and Windows
  SmartScreen will warn before installing. Do not distribute unsigned builds to
  schools.
* Requires Windows 10 version 1809 (build 17763) or later, 64-bit.
