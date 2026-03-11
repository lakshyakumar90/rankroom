---
name: RankRoom Full Implementation
overview: Build the RankRoom platform as a Turborepo monorepo with Next.js frontend (apps/web), Express backend (apps/api), and shared packages -- using Supabase for auth/storage/PostgreSQL (accessed via Prisma), Redis for caching/queues, BullMQ for job processing, Socket.io for real-time, and Judge0 for code execution.
todos:
  - id: phase1-monorepo
    content: "Phase 1.1: Restructure monorepo -- remove docs, create api/database/types/validators/config packages"
    status: pending
  - id: phase1-database
    content: "Phase 1.2: Prisma schema with all tables, seed script, connect to Supabase PostgreSQL"
    status: pending
  - id: phase1-backend
    content: "Phase 1.3: Express backend skeleton with Supabase JWT middleware, routes, Redis, BullMQ, Socket.io"
    status: pending
  - id: phase1-frontend
    content: "Phase 1.4: Next.js shell -- Tailwind, shadcn, Supabase Auth, dashboard layout, auth pages"
    status: pending
  - id: phase1-packages
    content: "Phase 1.5: Shared packages -- types, validators (Zod), config (Tailwind base)"
    status: pending
  - id: phase2-admin
    content: "Phase 2.1: Admin management -- department/class/user CRUD (backend + frontend)"
    status: pending
  - id: phase2-attendance
    content: "Phase 2.2: Attendance marking and viewing (backend + frontend)"
    status: pending
  - id: phase2-grades
    content: "Phase 2.3: Grades CRUD + reports (backend + frontend)"
    status: pending
  - id: phase2-assignments
    content: "Phase 2.4: Assignments with Supabase Storage uploads, submission, grading"
    status: pending
  - id: phase3-problems
    content: "Phase 3.1: Problem CRUD with markdown, test cases, filters (backend + frontend)"
    status: pending
  - id: phase3-execution
    content: "Phase 3.2: Code execution engine -- Judge0 + BullMQ + Socket.io verdict delivery"
    status: pending
  - id: phase3-editor
    content: "Phase 3.3: Monaco Editor integration as shared CodeEditor component"
    status: pending
  - id: phase4-contests
    content: "Phase 4.1: Contest CRUD, registration, live standings via Socket.io"
    status: pending
  - id: phase4-leaderboard
    content: "Phase 4.2: Leaderboard with Redis caching, points system, rank recalculation"
    status: pending
  - id: phase5-analytics
    content: "Phase 5.1: Analytics dashboards with Recharts (student + teacher views)"
    status: pending
  - id: phase5-profiles
    content: "Phase 5.2: Public profile pages"
    status: pending
  - id: phase5-notifications
    content: "Phase 5.3: Notification system (backend events + frontend bell/dropdown)"
    status: pending
  - id: phase6-polish
    content: "Phase 6: Polish -- skeletons, error boundaries, mobile responsive, rate limiting, Docker Compose"
    status: pending
---

# RankRoom -- Full Implementation Plan

## Current State

The workspace is a fresh Turborepo scaffold with:

- `apps/web` -- Next.js 16 (React 19), default template
- `apps/docs` -- default docs app (will be removed)
- `packages/ui`, `packages/eslint-config`, `packages/typescript-config` -- minimal stubs
- pnpm workspace, Turbo v2

## Architecture Overview

```mermaid
graph TD
    subgraph frontend [apps/web - Next.js 16]
        NextApp[Next.js App Router]
        SupaAuthUI[Supabase Auth SDK]
        TanStack[TanStack Query]
        MonacoEd[Monaco Editor]
        SocketClient[Socket.io Client]
    end

    subgraph backend [apps/api - Express]
        Express[Express Server]
        AuthMW[Supabase JWT Middleware]
        BullMQ[BullMQ Workers]
        SocketServer[Socket.io Server]
        Judge0Client[Judge0 Integration]
    end

    subgraph supabase [Supabase Cloud]
        SupaAuth[Supabase Auth]
        SupaDB[PostgreSQL]
        SupaStorage[Supabase Storage]
    end

    subgraph infra [Infrastructure]
        Redis[Redis]
    end

    subgraph packages [Shared Packages]
        PrismaDB["@repo/database"]
        Types["@repo/types"]
        Validators["@repo/validators"]
        UI["@repo/ui"]
        Config["@repo/config"]
    end

    NextApp --> TanStack --> Express
    NextApp --> SupaAuthUI --> SupaAuth
    NextApp --> SocketClient --> SocketServer
    Express --> AuthMW --> SupaAuth
    Express --> PrismaDB --> SupaDB
    Express --> SupaStorage
    BullMQ --> Judge0Client
    BullMQ --> Redis
    Express --> BullMQ
    Express --> Redis
    NextApp --> UI
    Express --> Types
    Express --> Validators
    NextApp --> Validators
end
```

## Hierarchy Model

```
Admin (platform-wide)
  └── Department (organizational unit, has a head/admin)
        └── Teacher (belongs to department, manages classes)
              └── Student (enrolled in classes via teacher)
```

Roles stored in the Prisma `User.role` enum: `ADMIN | TEACHER | STUDENT`. Department-level permissions are inferred from relationships (teacher's departmentId, student's enrollment).

---

## Phase 1 -- Foundation (Monorepo + Database + Auth + Shell)

### 1.1 Restructure Monorepo

- Remove `apps/docs` entirely
- Create `apps/api` -- Express + TypeScript app with `tsup` for build
- Create `packages/database` -- Prisma schema + generated client
- Create `packages/types` -- shared TypeScript types/enums
- Create `packages/validators` -- Zod schemas
- Create `packages/config` -- shared Tailwind config base
- Update [turbo.json](turbo.json) to add `db:migrate`, `db:generate`, `db:seed` tasks
- Update [pnpm-workspace.yaml](pnpm-workspace.yaml) if needed

### 1.2 Database Schema (packages/database)

Prisma schema connecting to Supabase PostgreSQL via `DATABASE_URL`. All tables as specified in the spec:

**Core**: `User`, `Profile`, `Department`, `Batch`, `Enrollment`

**Academic**: `Subject`, `Attendance`, `AttendanceRecord`, `Grade`, `Assignment`, `AssignmentSubmission`

**Coding**: `Problem`, `TestCase`, `Submission`, `Contest`, `ContestRegistration`, `ContestStanding`, `Leaderboard`

**System**: `Notification`, `ActivityLog`

Key schema decisions:

- `User.supabaseId` (String, unique) links to Supabase Auth `auth.users.id`
- `User.role` is an enum `ADMIN | TEACHER | STUDENT`
- Leaderboard is a separate table, updated async by BullMQ jobs
- Seed script creates: 1 admin, 1 department, 2 teachers, 5 students, sample problems, sample contests

### 1.3 Express Backend Skeleton (apps/api)

- Express + TypeScript with `tsup` build
- Middleware stack: CORS, JSON parsing, request logging (pino), error handler
- Supabase JWT verification middleware (extracts user from `Authorization: Bearer <supabase_token>`, looks up `User` by `supabaseId` in Prisma, attaches to `req.user`)
- Role-based guard middleware: `requireRole('ADMIN')`, `requireRole('TEACHER')`, etc.
- Route structure organized by domain: `auth/`, `users/`, `admin/`, `attendance/`, `grades/`, `assignments/`, `problems/`, `execute/`, `contests/`, `leaderboard/`, `notifications/`
- Redis connection (ioredis)
- BullMQ queue setup (submission queue)
- Socket.io server attached to the HTTP server
- Health check endpoint

### 1.4 Next.js Frontend Shell (apps/web)

- Install and configure Tailwind CSS v4
- Install and configure shadcn/ui (base components)
- Set up `next-themes` for dark/light mode
- Set up Supabase Auth client (`@supabase/ssr` for Next.js)
- Set up TanStack Query provider
- Set up Zustand store (auth user state)
- Create the `(auth)` route group: `/login`, `/register`, `/forgot-password` pages using Supabase Auth SDK
- Create the `(dashboard)` route group with layout shell:
  - Fixed sidebar (240px, collapsible) with role-aware navigation items
  - Top bar with user avatar, theme toggle, notifications bell
  - Responsive: sidebar becomes a drawer on mobile
- Next.js middleware (`middleware.ts`) to protect dashboard routes (check Supabase session)
- Design system tokens applied: zinc-950/white backgrounds, violet-500 accent, Geist font (already present)

### 1.5 Shared Packages

- **@repo/types**: Role enum, API response wrapper type (`ApiResponse<T>`), all entity interfaces matching Prisma models, request/response DTOs
- **@repo/validators**: Zod schemas for login, register, create problem, create contest, submit code, mark attendance, create assignment, etc. -- used in both frontend forms and backend request validation
- **@repo/config**: `tailwind.config.base.ts` with the design system colors/typography, `tsconfig.base.json` (already exists in typescript-config)

---

## Phase 2 -- Academic Modules

### 2.1 Admin Management

- **Backend**: CRUD routes for departments, classes/batches, users; bulk enroll students; analytics overview endpoint
- **Frontend**: `/admin/departments`, `/admin/classes`, `/admin/users` pages with data tables (shadcn Table), create/edit modals, search and filters

### 2.2 Attendance

- **Backend**: `POST /api/attendance` (teacher marks), `GET /api/attendance/:classId` (by date range), student's own view, edit record, class report
- **Frontend**: `/attendance/mark` (teacher: date picker + student checklist), `/attendance` (student: calendar heatmap + stats)

### 2.3 Grades

- **Backend**: CRUD for grades by subject, exam type; class-level and student-level reports
- **Frontend**: `/grades` (student: per-subject breakdown), teacher view with grade entry table, CGPA/percentage calculations displayed

### 2.4 Assignments

- **Backend**: CRUD for assignments, student submission endpoint (file upload to Supabase Storage), teacher grading endpoint
- **Frontend**: `/assignments` (list), `/assignments/[id] `(detail + submit), `/assignments/create` (teacher form), submission list for teacher grading

---

## Phase 3 -- Coding Platform

### 3.1 Problem Management

- **Backend**: Problem CRUD (admin/teacher), test case CRUD, markdown description storage, tag and difficulty filters
- **Frontend**: `/problems` (filterable list with DifficultyBadge, tags, solved status), `/problems/[slug]` (split-pane: problem description left, Monaco Editor right)

### 3.2 Code Execution Engine

- **Backend**:
  - `POST /api/execute/run` -- sends code + sample test cases to Judge0 API, returns stdout/stderr synchronously
  - `POST /api/execute/submit` -- enqueues a BullMQ job; worker sends all test cases to Judge0 batch API, stores results in `Submission` table
  - `GET /api/execute/submission/:id` -- poll for verdict
  - Socket.io event `submission:verdict` pushed when job completes
  - On ACCEPTED: BullMQ job to update user points, solved count, recalculate leaderboard rank
- **Frontend**: Monaco Editor with language selector (C++, Python, Java, JavaScript), run/submit buttons, real-time verdict display, submission history panel

### 3.3 Monaco Editor Integration

- Wrap Monaco in `packages/ui` as `<CodeEditor />` component
- Language selector, theme locked to dark, auto-resize, keyboard shortcuts
- Custom input textarea for "Run" mode

---

## Phase 4 -- Contests and Leaderboard

### 4.1 Contests

- **Backend**: Contest CRUD, registration, contest-scoped problem set, contest submissions (same Judge0 flow but tagged with `contestId`), standings calculation (score + penalty + time)
- **Frontend**: `/contests` (list: upcoming/live/ended tabs), `/contests/[id]` (overview + timer + register), `/contests/[id]/problems` (problem set), `/contests/[id]/standings` (live table)
- **Socket.io**: Rooms per contest; broadcast standing updates on each judged submission during live contest

### 4.2 Leaderboard

- **Backend**: Global, class-level, department-level, contest-level leaderboard endpoints; Redis caching of top-100 global; recalculated via BullMQ job on each accepted submission
- **Frontend**: `/leaderboard` page with tabs (global/class/department), rank table with user avatar, points, solved count, rank change indicator
- Points: EASY=10, MEDIUM=25, HARD=50, contest rank bonus

---

## Phase 5 -- Analytics and Profiles

### 5.1 Analytics Dashboards

- **Backend**: Pre-aggregated stats endpoints (attendance %, grade trends, submission heatmap data, language breakdown, contest performance)
- **Frontend**: Recharts-powered dashboard at `/analytics` (student: own stats) and `/analytics/class/[id]` (teacher: class overview)
- Charts: attendance over weeks (line), grade trends (bar), submission heatmap (GitHub-style grid), difficulty distribution (pie), contest history (line)

### 5.2 Public Profiles

- **Frontend**: `/profile/[username]` -- public page showing avatar, bio, skills, stats summary, solved-by-difficulty breakdown, recent submissions, contest history, GitHub link
- **Backend**: Public profile endpoint (no auth required)

### 5.3 Notifications

- **Backend**: Notification creation on key events (assignment posted, grade published, contest starting, submission judged); GET/PATCH endpoints
- **Frontend**: Bell icon in topbar with dropdown, `/notifications` page, mark read/mark all read

---

## Phase 6 -- Polish

- Dark/light mode toggle (already wired in Phase 1 via next-themes)
- Loading skeletons on all data pages (shadcn Skeleton)
- Error boundaries with fallback UI
- Mobile responsive sidebar (drawer), tables (horizontal scroll), editor (full-screen mode)
- Rate limiting on Express API (express-rate-limit + Redis store)
- Environment variable setup documentation
- Docker Compose for local dev: `api`, `redis`, `postgres` (or direct Supabase cloud connection)

---

## Key Files to Create/Modify

| Path | Action |

|------|--------|

| `apps/docs/` | Delete |

| `apps/api/` | Create (Express app) |

| `packages/database/` | Create (Prisma) |

| `packages/types/` | Create |

| `packages/validators/` | Create |

| `packages/config/` | Create |

| `turbo.json` | Update tasks |

| `apps/web/` | Major overhaul (Tailwind, shadcn, auth, layout) |

| `packages/ui/` | Overhaul (shadcn primitives + custom components) |

---

## Environment Variables

**apps/api/.env**

```
DATABASE_URL=            # Supabase PostgreSQL connection string
DIRECT_URL=              # Supabase direct connection (for migrations)
SUPABASE_URL=            # Supabase project URL
SUPABASE_SERVICE_KEY=    # Supabase service role key (server-side)
REDIS_URL=               # Redis connection
JUDGE0_API_URL=          # Judge0 endpoint
JUDGE0_API_KEY=          # Judge0 API key
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

**apps/web/.env.local**

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
```