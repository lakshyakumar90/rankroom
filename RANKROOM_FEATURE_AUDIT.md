# RankRoom Feature Coverage Audit

Last updated: 2026-04-26

This audit maps the requested RankRoom feature set to the current repository implementation after the stabilization pass. Status values:

- **Implemented**: schema, backend, and frontend are present for the core flow.
- **Partially Implemented**: important pieces exist, but the feature is incomplete or has known workflow gaps.
- **Missing**: no working product flow exists.
- **Broken**: present, but known to fail or was blocked before this pass.

## Coverage Matrix

| # | Feature | Status | Evidence / Notes |
|---|---|---|---|
| 1 | Authentication | Implemented | Supabase JWT verification, `/api/auth/me`, `/api/auth/sync`, protected Next routes, auth store hydration. Public registration exists for Supabase sync, while institutional user creation is handled through admin routes. |
| 2 | RBAC | Partially Implemented | Shared permission maps exist in API and web; route guards and scope services enforce many flows. This pass aligned `/department/hackathons` and tightened contest/hackathon/academic risky routes. Remaining risk: permissions are duplicated between frontend and backend. |
| 3 | Department Management | Implemented | Prisma department model, `/api/departments`, `/api/admin/departments`, department dashboard tabs and admin pages. |
| 4 | Section Management | Implemented | Section model, coordinator assignments, teacher assignments, `/api/sections`, admin section UI, section detail tabs. |
| 5 | Subject Management | Implemented | Subject model/routes, teacher assignment APIs, section subject UI, result config/audit schema. |
| 6 | Student Enrollment | Implemented | Enrollment model and admin enrollment endpoints; students are scoped through enrollments and auth scope. |
| 7 | Attendance System | Partially Implemented | Attendance sessions, records, marking, summaries, low-attendance analytics exist. Attendance correction request/approval is not present as a dedicated workflow. |
| 8 | Grade Management | Partially Implemented | Grade CRUD, bulk entry, CGPA sync, result config, notifications. This pass added student-section validation and scoped CGPA reads. Grade publishing/history are present only as saved grade visibility and notifications, not a separate publish/version workflow. |
| 9 | Assignment Management | Partially Implemented | Create, target audience, submit file, grade, notify, leaderboard recompute. Text/code submissions and late penalty policy are not fully implemented as first-class fields. This pass blocked student patch/delete and verified submission ownership during grading. |
| 10 | Coding Problem Platform | Implemented | Problem bank, scopes, test cases, hints, editorials, normalized tags, approval routes, frontend list/detail/workspace. |
| 11 | Code Editor | Implemented | Monaco-based workspace components and shared UI editor package. |
| 12 | Run Code | Implemented | `/api/problems/:id/run`, Judge0 execution, sample/custom input support. Supported languages are Python, C++, and C. |
| 13 | Submit Code | Implemented | `/api/problems/:id/submit`, submission persistence, BullMQ job enqueue. |
| 14 | Online Judge | Implemented | Judge0 language discovery, judge service, result normalization, execution limits, comparator services. |
| 15 | BullMQ Queue | Implemented | Submission worker, Redis helper, delayed/scheduled jobs. |
| 16 | Real-Time Verdicts | Implemented | Socket.IO server/client providers and verdict/standing notification hooks. |
| 17 | Contest Platform | Partially Implemented | Contest creation, registration, problem list, standings, submissions, plagiarism and publish routes exist. This pass fixed contest create scope payloads and added scope checks to update/plagiarism/publish. Remaining gaps: richer organizer editing UI and full contest lifecycle controls. |
| 18 | Hackathon Platform | Partially Implemented | Hackathon event creation, eligibility, offline registration, winner recording, notifications, list/detail/manage UI exist. Team formation, invite/accept, project submission upload, and judging are modeled but disabled or missing in working API/UI. |
| 19 | Leaderboards | Implemented | Global, department, section leaderboard services/routes/pages; recompute jobs and event-driven recomputes. |
| 20 | Notifications | Implemented | Notification model, send/list/read routes, topbar/page UI, socket delivery helpers. |
| 21 | Reminder System | Implemented | Scheduled notification/reminder models, reminder jobs, admin monitoring routes. |
| 22 | Analytics Dashboard | Implemented | Student, section, subject, department, platform analytics routes and dashboards. |
| 23 | At-Risk Detection | Implemented | Section at-risk analytics endpoint and attendance/grade/activity signals through analytics services. |
| 24 | Student Profile | Partially Implemented | Profile, skills, projects, achievements, public profile, sync endpoints, portfolio data. GitHub/LeetCode fields and sync shell exist; complete external-platform robustness depends on configured providers/keys. |
| 25 | Activity Logging | Implemented | ActivityLog model and logging in auth/activity-sensitive workflows. |
| 26 | File Uploads | Partially Implemented | Profile avatar/resume and assignment submission uploads exist via Supabase storage. File validation is basic; certificates/future uploads are not generalized. |

## Stabilization Completed

- Fixed API type errors in problem run metadata and Prisma search visibility filters.
- Fixed web type errors by aligning hackathon list types with shared `Hackathon` fields and adding legacy profile redirects.
- Added contest creation scope payloads so validator rules are satisfied.
- Aligned `/department/hackathons` frontend access for staff roles that can create hackathons.
- Added scope checks to contest update, plagiarism, publish-results, hackathon winners, and hackathon problem management routes.
- Hardened academic routes for assignment update/delete, assignment grading ownership, grade writes, and CGPA reads.
- Documented hackathons as offline registration events in the current UI.

## Missing APIs / Product Work For Full Spec

- Hackathon team formation APIs need to be re-enabled or rebuilt: create team, join request, approve/reject, invite, accept invite, transfer leadership.
- Hackathon project submissions need a schema/API/UI for repository/live-demo/pitch links and file attachments.
- Hackathon judging needs judge assignment, rubric scoring, score aggregation, and winner generation from scores.
- Attendance correction needs request, approve/reject, audit trail, and student/teacher UI.
- Assignment late policies need deadline grace, penalty configuration, and grade calculation integration.
- Grade publishing/history needs explicit draft/published state and grade change history if strict publish control is required.
- External coding profile sync needs provider-specific verification and failure handling for production use.

## Verification

- `pnpm --filter api check-types` passes.
- `pnpm --filter web check-types` passes.

- `pnpm --filter api lint` and `pnpm --filter web lint` were attempted, but Node failed with sandbox `EPERM` while resolving `C:\Users\laksh`; escalation was requested and rejected by the approval layer.
