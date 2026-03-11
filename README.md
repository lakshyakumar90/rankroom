# RankRoom

**RankRoom** is a full-stack academic platform built for colleges and institutions that combines competitive programming, attendance management, grade tracking, assignment submissions, and real-time contests — all under one roof.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Monorepo Structure](#monorepo-structure)
- [Prerequisites](#prerequisites)
- [Setup Guide](#setup-guide)
  - [1. Clone the Repository](#1-clone-the-repository)
  - [2. Install Dependencies](#2-install-dependencies)
  - [3. Supabase Setup](#3-supabase-setup)
  - [4. Environment Variables](#4-environment-variables)
  - [5. Docker Setup (Redis)](#5-docker-setup-redis)
  - [6. Judge0 Setup (Self-Hosted)](#6-judge0-setup-self-hosted)
  - [7. Database Migrations & Seeding](#7-database-migrations--seeding)
  - [8. Run the Development Servers](#8-run-the-development-servers)
- [API Routes](#api-routes)
- [Architecture Overview](#architecture-overview)
- [Useful Commands](#useful-commands)

---

## Overview

RankRoom is designed for academic institutions that want to run coding contests, track student attendance and grades, manage assignments, and maintain a global leaderboard — all in one platform.

- **Students** can solve problems, participate in contests, view their grades, and track their attendance.
- **Teachers** can post assignments, mark attendance, upload grades, and create coding problems.
- **Admins** can manage departments, batches, users, and the entire platform.

Code submissions are executed securely via a self-hosted **Judge0** instance (sandboxed code execution), processed asynchronously through **BullMQ + Redis** queues, and results are pushed in real-time using **Socket.io**.

---

## Features

| Category | Features |
|---|---|
| 🔐 Auth | Supabase Auth (email/password), role-based access (Admin / Teacher / Student) |
| 🧑‍💻 Coding | Problem bank, test cases, code submissions with Judge0 execution |
| 🏆 Contests | Create public/private/institutional contests, live leaderboard updates via WebSocket |
| 📊 Leaderboard | Global ranking by points, difficulty-based scoring (Easy/Medium/Hard) |
| 📋 Attendance | Batch-level attendance marking with per-student records |
| 📝 Grades | Subject-wise grades (MID, FINAL, INTERNAL, ASSIGNMENT) with teacher remarks |
| 📂 Assignments | File-based assignment submissions with grading workflow |
| 🔔 Notifications | Real-time notifications for verdicts, grade publishes, contest alerts |
| 📈 Analytics | Activity logs and per-user analytics dashboard |

---

## Tech Stack

### Frontend (`apps/web`)
- **Next.js 16** (App Router) + React 19
- **Tailwind CSS v4** for styling
- **Supabase SSR** for auth session management
- **TanStack Query** for server state
- **Zustand** for client state
- **Socket.io Client** for real-time updates
- **Recharts** for analytics charts
- **Framer Motion** for animations
- **React Hook Form** + Zod for form validation

### Backend (`apps/api`)
- **Node.js** + **Express** (TypeScript)
- **Socket.io** for WebSocket (real-time verdicts, contest standings)
- **BullMQ** + **Redis** for async job queues (submission processing, leaderboard updates)
- **Supabase JS** (service role, bypasses RLS) for auth verification
- **Pino** for structured logging
- Rate limiting via `express-rate-limit`, security via `helmet`

### Database & ORM (`packages/database`)
- **PostgreSQL** hosted on **Supabase**
- **Prisma ORM v7** with `@prisma/adapter-pg` (connection pooling via `pg`)
- Migrations use the **direct connection URL** (not the pooler)
- Runtime queries use the **session/transaction pooler URL** (port `5432/6543` with `pgbouncer=true`)

### Infrastructure
- **Supabase** — Auth, PostgreSQL database, Storage (future)
- **Redis** — Job queues and caching (Docker)
- **Judge0** — Self-hosted code execution engine (Docker)
- **Turborepo** — Monorepo task orchestration
- **pnpm workspaces** — Package management

---

## Monorepo Structure

```
rankroom/
├── apps/
│   ├── api/                  # Express backend (port 4000)
│   │   ├── src/
│   │   │   ├── routes/       # All API route handlers
│   │   │   ├── workers/      # BullMQ workers (submission, leaderboard)
│   │   │   ├── services/     # Judge0 integration
│   │   │   ├── middleware/   # Auth, error handling
│   │   │   └── lib/          # Redis, Socket.io, Supabase, logger
│   │   └── env.example
│   └── web/                  # Next.js frontend (port 3000)
│       ├── app/
│       │   ├── (auth)/       # Login, register pages
│       │   └── (dashboard)/  # Protected app pages
│       ├── components/
│       ├── lib/
│       └── env.example
├── packages/
│   ├── database/             # Prisma schema, migrations, client
│   ├── types/                # Shared TypeScript types
│   ├── validators/           # Shared Zod validators
│   ├── ui/                   # Shared React component library
│   ├── config/               # Shared Tailwind config
│   ├── eslint-config/        # Shared ESLint config
│   └── typescript-config/   # Shared tsconfig
├── docker-compose.yml        # Redis service
├── turbo.json
└── pnpm-workspace.yaml
```

---

## Prerequisites

Make sure you have the following installed:

| Tool | Version | Notes |
|---|---|---|
| **Node.js** | ≥ 18 | Required by all packages |
| **pnpm** | 9.x | Package manager (`npm i -g pnpm@9`) |
| **Docker Desktop** | Latest | For Redis and Judge0 |
| **Git** | Latest | To clone Judge0 |

---

## Setup Guide

### 1. Clone the Repository

```bash
git clone https://github.com/lakshyakumar90/rankroom.git
cd rankroom
```

---

### 2. Install Dependencies

```bash
pnpm install
```

This installs dependencies for all apps and packages in the monorepo at once.

---

### 3. Supabase Setup

#### 3.1 Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign in.
2. Click **"New Project"**, give it a name (e.g., `rankroom`), set a strong **database password**, and choose a region.
3. Wait for the project to be provisioned (takes ~1 minute).

#### 3.2 Get Your API Keys

Go to **Project Settings → API**:

| Key | Where to find | Used for |
|---|---|---|
| `SUPABASE_URL` | Project URL section | Both API and Web |
| `SUPABASE_ANON_KEY` | `anon` `public` key | Web frontend (client-side) |
| `SUPABASE_SERVICE_KEY` | `service_role` key (keep secret!) | Backend API (bypasses RLS) |

> ⚠️ **Never expose `SUPABASE_SERVICE_KEY` on the frontend.** It has full database access and bypasses all Row Level Security policies.

#### 3.3 Get Your Database Connection Strings

Go to **Project Settings → Database → Connection string**:

You need **two different URLs** for different purposes:

##### `DATABASE_URL` — Transaction Pooler (for runtime queries)
Used by Prisma at **runtime** for all application queries. Uses PgBouncer connection pooling for scalability.

```
# Go to: Settings → Database → Connection Pooling → Transaction mode
# Mode: Transaction
# Port: 6543
postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
```

> This URL connects through PgBouncer (port `6543`) in **transaction mode**. The `?pgbouncer=true` flag tells Prisma to disable prepared statements, which are incompatible with PgBouncer in transaction mode.

##### `DIRECT_URL` — Direct Connection (for migrations only)
Used by Prisma **only when running migrations**. Prisma migrations require a persistent session connection and do not work over PgBouncer.

```
# Go to: Settings → Database → Connection string → URI tab
# This is the direct connection (NOT the pooler)
# Port: 5432
postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
```

> ⚠️ **Important distinction:**
> - Port `6543` → PgBouncer pooler → use for `DATABASE_URL` (runtime)
> - Port `5432` → Direct connection → use for `DIRECT_URL` (migrations)
>
> Prisma uses `DATABASE_URL` for runtime queries and `DIRECT_URL` for `prisma migrate` commands. If you use the pooler URL for migrations, the migration will fail or hang.

#### 3.4 Configure Authentication

In the Supabase dashboard:

1. Go to **Authentication → Providers** → ensure **Email** is enabled.
2. Go to **Authentication → URL Configuration**:
   - **Site URL**: `http://localhost:3000` (for development)
   - **Redirect URLs**: Add `http://localhost:3000/**`
3. (Optional) Disable email confirmations for local dev: **Authentication → Settings → Disable email confirmations**.

---

### 4. Environment Variables

#### 4.1 API (`apps/api`)

Copy the example file and fill in the values:

```bash
cp apps/api/env.example apps/api/.env
```

```env
# ─── Database (Supabase PostgreSQL) ───────────────────────────────────────────
# Transaction pooler URL — used by Prisma at runtime (port 6543, PgBouncer)
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true

# Direct connection URL — used ONLY by Prisma migrations (port 5432, no pooler)
DIRECT_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres

# ─── Supabase ─────────────────────────────────────────────────────────────────
SUPABASE_URL=https://[project-ref].supabase.co
# Service role key — gives full admin access, bypasses RLS. NEVER expose on frontend.
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ─── Redis (local Docker) ─────────────────────────────────────────────────────
REDIS_URL=redis://localhost:6379

# ─── Judge0 (self-hosted) ─────────────────────────────────────────────────────
# If running Judge0 locally via Docker (see Section 6):
JUDGE0_API_URL=http://localhost:2358
JUDGE0_API_KEY=  # Leave blank if no auth token set in judge0.conf

# If using RapidAPI hosted Judge0 instead:
# JUDGE0_API_URL=https://judge0-ce.p.rapidapi.com
# JUDGE0_API_KEY=your-rapidapi-key

# ─── Server ───────────────────────────────────────────────────────────────────
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

#### 4.2 Web (`apps/web`)

Copy the example file and fill in the values:

```bash
cp apps/web/env.example apps/web/.env.local
```

```env
# ─── Supabase (public keys only — safe for frontend) ──────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
# Anon key — safe for browser. Row Level Security (RLS) controls what this can access.
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ─── API Backend ──────────────────────────────────────────────────────────────
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
```

> **Note:** Next.js only exposes environment variables prefixed with `NEXT_PUBLIC_` to the browser. Never put secret keys (`SUPABASE_SERVICE_KEY`) in the web `.env.local` file.

#### 4.3 Database Package (`packages/database`)

The database package reads `DATABASE_URL` and `DIRECT_URL` from the root of the package. Create a `.env` file there:

```bash
# packages/database/.env
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
```

> This is what Prisma CLI reads when you run `db:migrate` or `db:generate` from the database package.

---

### 5. Docker Setup (Redis)

RankRoom uses **Redis** for BullMQ job queues (code submission processing and leaderboard updates).

The `docker-compose.yml` at the root of the monorepo runs Redis:

```bash
# From the project root
docker compose up -d
```

This starts:
- **Redis** on port `6379` with persistence (`appendonly yes`)

Verify Redis is running:
```bash
docker compose ps
# or
docker exec -it rankroom-redis-1 redis-cli ping
# Should return: PONG
```

To stop:
```bash
docker compose down
```

---

### 6. Judge0 Setup (Self-Hosted)

Judge0 is an open-source code execution engine. RankRoom integrates with a **self-hosted** Judge0 instance for sandboxed code execution.

> ⚠️ **Judge0 requires a Linux host with kernel support for namespaces.** On **Windows**, you must use **WSL2** (Windows Subsystem for Linux). On **macOS**, Docker Desktop works but performance may vary.
>
> **WSL2 Users:** Run all Judge0 commands from inside your WSL2 terminal, not PowerShell.

#### 6.1 Clone the Judge0 Repository

Judge0 is maintained in a separate directory alongside this project:

```bash
# From your projects root (one level above rankroom/)
git clone https://github.com/judge0/judge0.git
cd judge0
```

Or if you already have it cloned at `C:\Lakshya\judge0` / `~/judge0`, navigate there.

#### 6.2 Configure `judge0.conf`

The `judge0.conf` file in the Judge0 directory controls all settings. The minimum required values:

```conf
# judge0/judge0.conf

# Redis (Judge0 uses its own internal Redis)
REDIS_HOST=redis
REDIS_PASSWORD=your_redis_password_here   # Must not be blank

# PostgreSQL (Judge0 uses its own internal Postgres)
POSTGRES_HOST=db
POSTGRES_DB=judge0
POSTGRES_USER=judge0
POSTGRES_PASSWORD=your_postgres_password_here   # Must not be blank

# (Optional) Protect the API with a token
AUTHN_HEADER=X-Auth-Token
AUTHN_TOKEN=your_secret_token_here

# Submission limits
CPU_TIME_LIMIT=5
WALL_TIME_LIMIT=10
MEMORY_LIMIT=128000
```

> If you set `AUTHN_TOKEN` in `judge0.conf`, you must also set `JUDGE0_API_KEY` to the same value in `apps/api/.env`.

#### 6.3 Start Judge0 with Docker

```bash
# From inside the judge0/ directory
docker compose up -d
```

This starts four containers:
| Container | Purpose |
|---|---|
| `judge0-server-1` | Judge0 Rails API server (port `2358`) |
| `judge0-worker-1` | Background worker that processes submissions |
| `judge0-db-1` | PostgreSQL database for Judge0 |
| `judge0-redis-1` | Redis for Judge0's internal job queue |

#### 6.4 Wait for Judge0 to be Ready

Judge0 takes about **30–60 seconds** to fully initialize (database migrations, language setup):

```bash
# Watch the logs
docker compose logs -f server

# Judge0 is ready when you see something like:
# Puma starting in single mode...
# * Listening on http://0.0.0.0:2358
```

#### 6.5 Verify Judge0 is Working

```bash
curl http://localhost:2358/system_info
# Should return a JSON with Judge0 version and system details
```

Test a submission via the browser: `http://localhost:2358/dummy-client.html`

#### 6.6 Update the API Environment Variable

In `apps/api/.env`, set:

```env
JUDGE0_API_URL=http://localhost:2358
JUDGE0_API_KEY=your_secret_token_here   # Same as AUTHN_TOKEN in judge0.conf (leave blank if not set)
```

#### 6.7 (Alternative) Using RapidAPI Hosted Judge0

If you don't want to self-host, you can use the hosted Judge0 CE on RapidAPI:

1. Go to [https://rapidapi.com/judge0-official/api/judge0-ce](https://rapidapi.com/judge0-official/api/judge0-ce)
2. Subscribe to the free tier
3. Get your `X-RapidAPI-Key`
4. Update `apps/api/.env`:

```env
JUDGE0_API_URL=https://judge0-ce.p.rapidapi.com
JUDGE0_API_KEY=your_rapidapi_key_here
```

> The hosted tier has rate limits and may not be suitable for high-traffic usage.

---

### 7. Database Migrations & Seeding

#### 7.1 Generate the Prisma Client

```bash
pnpm --filter @repo/database db:generate
```

This generates the TypeScript Prisma client from `packages/database/prisma/schema.prisma` into `packages/database/generated/prisma/`.

#### 7.2 Run Migrations

```bash
pnpm --filter @repo/database db:migrate
```

This uses the `DIRECT_URL` (direct connection, port `5432`) to apply all pending migrations to your Supabase database. This command creates the tables, enums, and indexes defined in the Prisma schema.

> **Why `DIRECT_URL` for migrations?**
> Prisma migrations use advisory locks and multi-statement transactions that are incompatible with PgBouncer in transaction mode. The `DIRECT_URL` (port `5432`) bypasses PgBouncer and connects directly to PostgreSQL, ensuring migrations run reliably.

#### 7.3 Seed the Database

```bash
pnpm --filter @repo/database db:seed
```

This runs `packages/database/prisma/seed.ts` and populates the database with:
- Sample departments and batches
- Test users (admin, teacher, students) with Supabase auth entries
- Sample problems with test cases
- Sample contests, attendance records, and grades

#### 7.4 (Optional) Open Prisma Studio

```bash
pnpm --filter @repo/database db:studio
```

Opens a visual database browser at `http://localhost:5555`.

---

### 8. Run the Development Servers

Start all apps in parallel with Turborepo:

```bash
pnpm dev
```

This starts:
| Service | URL | Description |
|---|---|---|
| **Web (Next.js)** | `http://localhost:3000` | Frontend application |
| **API (Express)** | `http://localhost:4000` | Backend REST API + WebSocket |

Or run them individually:

```bash
# Frontend only
pnpm --filter web dev

# Backend only
pnpm --filter api dev
```

Check the API is healthy:
```bash
curl http://localhost:4000/health
# { "status": "ok", "timestamp": "..." }
```

---

## API Routes

| Method | Route | Description | Auth |
|---|---|---|---|
| `POST` | `/api/auth/sync` | Sync Supabase user to Prisma DB | JWT |
| `GET` | `/api/users/me` | Get current user profile | JWT |
| `GET` | `/api/problems` | List all problems | JWT |
| `POST` | `/api/problems` | Create a problem | Admin/Teacher |
| `POST` | `/api/execute` | Execute code against test cases | JWT |
| `GET` | `/api/contests` | List contests | JWT |
| `POST` | `/api/contests` | Create a contest | Admin/Teacher |
| `GET` | `/api/leaderboard` | Global leaderboard | JWT |
| `GET` | `/api/attendance` | Attendance records | JWT |
| `POST` | `/api/attendance` | Mark attendance | Teacher |
| `GET` | `/api/grades` | Student grades | JWT |
| `POST` | `/api/assignments` | Create assignment | Teacher |
| `GET` | `/api/notifications` | User notifications | JWT |
| `GET` | `/api/analytics` | User analytics | JWT |
| `GET` | `/api/admin/*` | Admin management routes | Admin |

---

## Architecture Overview

```
Browser (Next.js)
    │
    ├── REST API calls ──────────────────────► Express API (port 4000)
    │                                              │
    └── WebSocket (Socket.io) ────────────────────┤
                                                   │
                                         ┌─────────▼──────────┐
                                         │   BullMQ Queues     │
                                         │  (via Redis :6379)  │
                                         └─────────┬──────────┘
                                                   │
                                         ┌─────────▼──────────┐
                                         │  Submission Worker  │
                                         │  (5 concurrent)     │
                                         └─────────┬──────────┘
                                                   │
                                         ┌─────────▼──────────┐
                                         │  Judge0 API         │
                                         │  (port 2358)        │
                                         │  Sandboxed execution│
                                         └─────────┬──────────┘
                                                   │
                                         Verdict emitted back via Socket.io
                                         to the user's browser in real-time
```

**Submission Flow:**
1. User submits code → `POST /api/execute`
2. API creates a `Submission` record (status: `PENDING`) and adds a job to BullMQ
3. BullMQ `SubmissionWorker` picks up the job, fetches test cases, sends a **batch request** to Judge0
4. Worker polls Judge0 until all test cases are judged
5. Worker updates the `Submission` record with verdict
6. Worker emits the verdict to the user's browser via Socket.io (`submission:verdict` event)
7. If accepted, a `LeaderboardWorker` job updates points and re-ranks all users

---

## Useful Commands

```bash
# Install all dependencies
pnpm install

# Run all apps in dev mode
pnpm dev

# Build all apps
pnpm build

# Type-check all packages
pnpm check-types

# Lint all packages
pnpm lint

# Format all files
pnpm format

# Database: generate Prisma client
pnpm --filter @repo/database db:generate

# Database: run migrations (uses DIRECT_URL)
pnpm --filter @repo/database db:migrate

# Database: push schema without migration (for rapid prototyping)
pnpm --filter @repo/database db:push

# Database: seed with sample data
pnpm --filter @repo/database db:seed

# Database: open Prisma Studio
pnpm --filter @repo/database db:studio

# Docker: start Redis
docker compose up -d

# Docker: stop Redis
docker compose down

# Judge0: start (from judge0/ directory)
docker compose up -d

# Judge0: view logs
docker compose logs -f server
```
