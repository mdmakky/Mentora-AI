# Mentora AI — University Student Learning Platform

**Mentora** is a full-stack AI-powered study assistant built specifically for university students. It combines document management, RAG-based AI chat, exam question prediction, and study analytics — all in one platform.

---

## Table of Contents

- [What is Mentora?](#what-is-mentora)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
  - [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [API Overview](#api-overview)
- [AI Capabilities](#ai-capabilities)
- [Admin Panel](#admin-panel)
- [Security](#security)

---

## What is Mentora?

Mentora is a RAG (Retrieval-Augmented Generation) based academic tutor. Students upload their course materials (lecture slides, PDFs, notes, etc.) and Mentora turns them into a personalized knowledge base. Students can then:

- **Chat with their documents** like talking to a professor
- **Generate summaries, quizzes, and flashcards** from any material
- **Predict likely exam questions** by analyzing past papers with AI vision
- **Track their study streaks and daily goals**
- **Organize everything** by semester → course → folder → document

---

## Key Features

### 📂 Course & Document Organization
- Hierarchical structure: **Semesters → Courses → Folders → Documents**
- Supports PDF, DOCX, PPTX, XLSX, JPG, PNG uploads (up to 10 MB)
- Auto-converts non-PDF files to PDF for uniform viewing
- Non-text/scanned files are processed with OCR (Tesseract) automatically
- Cloudinary-hosted file storage with thumbnail generation

### 🤖 AI Chat (RAG-Based)
- Chat with any document or entire course using natural language
- The AI tutor (Mentora) behaves like a professor, pulling answers directly from your uploaded materials
- Supports **Bengali (বাংলা)** and **English** response languages
- Multiple response modes: **Learn**, **Summary**, **Exam prep**, **Practice**, **Assignment**
- Adjustable explanation depth: **Simple**, **Balanced**, **Deep**
- Configurable retrieval scope: single page, selected pages, whole document, or entire course
- Page-number-aware: ask "explain page 5" and it targets the right content

### 🧠 AI Features (Question Lab)
- **Auto-summarize** any document with one click
- **Generate practice questions** (MCQ, short answer, long answer) from your materials
- **Past paper analysis** — upload previous exam papers and the AI uses vision models to identify question patterns, repeat topics, and likely areas to focus on
- **Exam prediction** — after analyzing multiple past papers, predict the most probable questions for your upcoming exam

### 📊 Study Analytics & Streaks
- Automatic session tracking (start/end study sessions per document or course)
- Daily study goal (default 120 min/day, customizable per user)
- Streak calculation with calendar-day awareness (handles sessions crossing midnight)
- Dashboard shows: total documents, total chat sessions, courses, today's minutes, current streak, longest streak

### 🔔 Notifications
- In-app notification system for document review decisions, admin actions, and system alerts
- Mark individual or all notifications as read

### 🛡️ Suspension Appeals
- Suspended users can submit a written appeal
- Admins are notified instantly; only one pending appeal allowed at a time

### 🔐 Authentication
- Email/password registration with OTP email verification (via Brevo)
- Google OAuth login
- JWT access tokens + refresh tokens
- Password reset via OTP code
- Rate limiting on all sensitive auth endpoints (OTP verification, resend, login)
- Sensitive fields (`password_hash`, OTP codes) are never returned in any API response

---

## Tech Stack

### Backend
| Layer | Technology |
|---|---|
| Web framework | FastAPI 0.115 |
| Database | PostgreSQL (via Supabase) |
| ORM / Client | Supabase Python SDK |
| Vector store | pgvector (PostgreSQL extension) |
| Embeddings | Google Gemini `gemini-embedding-001` (primary) → Sentence Transformers MiniLM (fallback) → hash-based (offline fallback) |
| AI models | Google Gemini 2.5 Flash / 2.0 Flash (primary) → Groq LLaMA 3.3 70B / 3.1 8B (fallback) |
| Vision / OCR | Gemini 2.0 Flash vision + Tesseract OCR (via PyMuPDF) |
| File storage | Cloudinary (documents & avatars) + Supabase Storage |
| Email | Brevo (transactional email API) |
| Rate limiting | SlowAPI |
| PDF processing | PyMuPDF, python-pptx, python-docx, openpyxl |
| Auth | python-jose (JWT), passlib (bcrypt), Google OAuth |

### Frontend
| Layer | Technology |
|---|---|
| Framework | React 19 + Vite 8 |
| Routing | React Router DOM 7 |
| Styling | Tailwind CSS 4 |
| State management | Zustand 5 |
| HTTP client | Axios |
| PDF viewer | react-pdf |
| Charts | Recharts |
| Icons | lucide-react |
| Markdown rendering | react-markdown + remark-gfm |
| Notifications | react-hot-toast |
| Auth backend | Supabase JS SDK |

---

## Project Structure

```
Mentora-AI/
├── backend/                    # FastAPI application
│   ├── main.py                 # App entry point, CORS, rate limiting, router registration
│   ├── requirements.txt        # Python dependencies (GPU-free, CPU-only torch)
│   ├── core/
│   │   ├── config.py           # All environment variable settings (Pydantic BaseSettings)
│   │   ├── database.py         # Supabase client initialization (anon + service role)
│   │   ├── dependencies.py     # FastAPI dependency injection (auth, admin checks)
│   │   └── security.py         # JWT creation/validation, password hashing
│   ├── routers/
│   │   ├── auth.py             # Registration, login, Google OAuth, OTP, password reset
│   │   ├── semesters.py        # Semester CRUD
│   │   ├── courses.py          # Course CRUD, archiving, reordering, hot topics
│   │   ├── folders.py          # Folder CRUD (nested)
│   │   ├── documents.py        # Upload, delete, RAG processing, copyright scan, review
│   │   ├── chat.py             # Chat sessions and RAG-powered message responses
│   │   ├── ai.py               # Summaries, question generation, exam prediction
│   │   ├── study.py            # Study session tracking, streaks, stats
│   │   ├── dashboard.py        # Aggregated stats, global search
│   │   ├── notifications.py    # In-app notification listing and read-marking
│   │   ├── appeals.py          # Suspension appeal submission and status
│   │   └── admin.py            # Admin-only: user management, document review, system stats
│   ├── schemas/                # Pydantic request/response models
│   ├── services/
│   │   ├── rag_service.py      # Chunking, embedding (Gemini/local), vector search
│   │   ├── gemini_service.py   # Gemini chat, summarization, question generation (with Groq fallback)
│   │   ├── groq_service.py     # Groq LLaMA fallback completions
│   │   ├── vision_service.py   # PDF-to-image rendering + Gemini vision analysis
│   │   ├── pdf_service.py      # Text extraction from PDF/DOCX/PPTX/XLSX/images
│   │   ├── conversion_service.py # Non-PDF → PDF conversion
│   │   ├── copyright_service.py  # Keyword-based copyright detection in metadata & content
│   │   ├── cloudinary_service.py # File/avatar upload to Cloudinary
│   │   ├── supabase_storage_service.py # Document file storage in Supabase buckets
│   │   ├── email_service.py    # Brevo transactional email (OTP, password reset)
│   │   ├── notification_service.py # Create and fetch in-app notifications
│   │   ├── admin_service.py    # Admin business logic (suspend, warn, approve, reject)
│   │   └── study_service.py    # Streak calculation and daily aggregation logic
│   └── get_schema.py           # Utility to print DB schema for debugging
│
├── frontend/                   # React + Vite SPA
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── src/
│       ├── App.jsx             # Root router — public, auth, protected, and admin routes
│       ├── components/
│       │   ├── Login.jsx / Register.jsx / VerifyEmail.jsx / ForgotPassword.jsx / ResetPassword.jsx
│       │   ├── GoogleAuthButton.jsx
│       │   ├── Dashboard.jsx
│       │   ├── chat/           # Chat UI components
│       │   ├── documents/      # Document upload/viewer components
│       │   ├── questions/      # Question Lab UI (QuestionCard, PatternInsightsPanel, QuestionLabSection)
│       │   ├── dashboard/      # Dashboard widgets
│       │   ├── layout/         # AppLayout (sidebar, navbar)
│       │   ├── pdf/            # PDF viewer component
│       │   ├── branding/       # Logo and brand components
│       │   ├── seo/            # SEO meta tag components
│       │   └── ui/             # Reusable UI primitives (buttons, modals, etc.)
│       ├── pages/
│       │   ├── LandingPage.jsx / AboutPage.jsx / ContactPage.jsx
│       │   ├── GuidesPage.jsx / GuideArticlePage.jsx
│       │   ├── CoursesPage.jsx / CourseView.jsx / DocumentView.jsx
│       │   ├── ChatPage.jsx
│       │   ├── AnalyticsPage.jsx
│       │   ├── ProfilePage.jsx
│       │   └── admin/
│       │       ├── AdminDashboard.jsx
│       │       ├── AdminUsers.jsx
│       │       ├── AdminDocuments.jsx
│       │       └── AdminLogs.jsx
│       ├── stores/             # Zustand state stores (auth, chat, courses, …)
│       ├── lib/
│       │   ├── apiClient.js    # Axios instance with auth headers
│       │   ├── supabaseClient.js
│       │   └── customStorage.js
│       └── utils/              # Utility helpers
│
└── database/
    ├── schema.sql              # Full PostgreSQL schema (run first)
    └── *_migration.sql         # Incremental migration files (run in order)
```

---

## Getting Started

### Prerequisites

- **Python 3.11+**
- **Node.js 20+** and **npm**
- A **Supabase** project (free tier works)
- A **Google Cloud** project with Gemini API enabled
- A **Cloudinary** account (free tier works)
- A **Brevo** account for transactional email (free tier works)
- Optionally: a **Groq** API key for LLM fallback

---

### Backend Setup

```bash
cd backend

# Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate          # Linux/macOS
# .venv\Scripts\activate           # Windows

# Install dependencies
pip install -r requirements.txt

# Copy and fill in your environment variables
cp .env.example .env
# (edit .env — see Environment Variables section below)

# Run the development server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`.
Interactive docs: `http://localhost:8000/docs`

> **Note for CPU-only servers:** The `requirements.txt` already pins a CPU-only build of PyTorch so the local embedding fallback works without a GPU.

---

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

The frontend will be available at `http://localhost:5173`.

To build for production:
```bash
npm run build
```

---

### Environment Variables

Create a `.env` file inside the `backend/` directory with the following values:

```env
# ── Supabase ────────────────────────────────────────────────────────────────
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_DB_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres

# ── JWT ─────────────────────────────────────────────────────────────────────
JWT_SECRET_KEY=your-long-random-secret-key
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=7

# ── Cloudinary ───────────────────────────────────────────────────────────────
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# ── Google AI (Gemini) ───────────────────────────────────────────────────────
GOOGLE_API_KEY=your-gemini-api-key
GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
GEMINI_CHAT_MODELS=gemini-2.5-flash,gemini-2.0-flash
GEMINI_TASK_MODELS=gemini-2.5-flash,gemini-2.0-flash

# ── Groq (optional fallback) ─────────────────────────────────────────────────
GROQ_API_KEY=your-groq-api-key
GROQ_CHAT_MODELS=llama-3.3-70b-versatile,llama-3.1-8b-instant
GROQ_TASK_MODELS=llama-3.3-70b-versatile,llama-3.1-8b-instant
GROQ_VISION_MODELS=meta-llama/llama-4-maverick-17b-128e-instruct,meta-llama/llama-4-scout-17b-16e-instruct

# ── Local Embedding Fallback ─────────────────────────────────────────────────
ENABLE_LOCAL_EMBEDDING_FALLBACK=true
LOCAL_EMBEDDING_BACKEND=auto         # auto | hash | sentence-transformers
LOCAL_EMBEDDING_MODEL=sentence-transformers/paraphrase-MiniLM-L3-v2
LOCAL_EMBEDDING_DEVICE=cpu

# ── App URLs ─────────────────────────────────────────────────────────────────
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:8000

# ── Email (Brevo) ────────────────────────────────────────────────────────────
BREVO_API_KEY=your-brevo-api-key
SMTP_FROM_EMAIL=noreply@yourdomain.com

# ── Development only ─────────────────────────────────────────────────────────
DEBUG_OTP_IN_RESPONSE=false
```

---

## Database Setup

The database runs on Supabase (PostgreSQL + pgvector). To set it up:

1. Open your **Supabase project → SQL Editor**
2. Run `database/schema.sql` — this creates all tables, triggers, and the `vector` extension
3. Run each `database/*_migration.sql` file in the order listed below:

```
1. traditional_auth_migration.sql      — adds password/OTP columns to users
2. notifications_migration.sql         — notification system
3. ocr_migration.sql                   — OCR processing fields on documents
4. question_generation_runs_migration.sql
5. question_generation_runs_hotfix.sql
6. question_attempts_migration.sql
7. question_lab_migration.sql
8. document_review_flow_migration.sql
9. semester_constraints_migration.sql
10. suspension_appeal_migration.sql
```

> All tables use UUID primary keys, Row Level Security (RLS) is bypassed on the backend using the service role key.

### Core Tables

| Table | Purpose |
|---|---|
| `users` | User accounts, profile, study goal, suspension/admin flags |
| `semesters` | Academic semesters per user |
| `courses` | Courses within a semester |
| `folders` | Nested folders within a course |
| `documents` | Uploaded files with processing status and metadata |
| `document_chunks` | RAG text chunks with pgvector embeddings |
| `chat_sessions` | Chat conversation sessions |
| `chat_messages` | Individual messages within a session |
| `study_sessions` | Timed study sessions linked to documents/courses |
| `study_streaks` | Aggregated daily study minutes per user |
| `notifications` | In-app notifications |
| `suspension_appeals` | User appeals for upload suspension |
| `admin_action_logs` | Audit log of all admin actions |

---

## API Overview

All endpoints are under `/api/v1`. The API follows REST conventions with JWT Bearer token authentication.

| Prefix | Description |
|---|---|
| `/api/v1/auth` | Register, login, Google OAuth, verify email, forgot/reset password, refresh token |
| `/api/v1/semesters` | Semester CRUD |
| `/api/v1/courses` | Course CRUD, archive, reorder, hot topics |
| `/api/v1/folders` | Folder CRUD (nested structure) |
| `/api/v1/documents` | Upload, list, delete, RAG pipeline, document review/appeal |
| `/api/v1/chat` | Chat sessions and AI message responses |
| `/api/v1/ai` | Summaries, question generation, exam pattern prediction |
| `/api/v1/study` | Start/end study sessions, view stats and streaks |
| `/api/v1/dashboard` | Aggregated stats, global search across courses and documents |
| `/api/v1/notifications` | List and mark notifications as read |
| `/api/v1/appeals` | Submit and view suspension appeals |
| `/api/v1/admin` | Admin-only: user management, document review, system stats, audit logs |

Full interactive documentation is available at `http://localhost:8000/docs` (Swagger UI) or `http://localhost:8000/redoc`.

---

## AI Capabilities

### RAG Pipeline (Document Chat)
1. When a document is uploaded, the text is extracted (PDF/DOCX/PPTX/XLSX/image via OCR)
2. The content is split into 800-token chunks with 150-token overlap using LangChain's `RecursiveCharacterTextSplitter`
3. Each chunk is embedded using `gemini-embedding-001` (768-dimension vectors) and stored in pgvector
4. When a user sends a chat message, the query is embedded and a semantic vector search retrieves the most relevant chunks
5. The retrieved chunks are passed as context to Gemini 2.5 Flash, which responds as an academic tutor

### Embedding Fallback Chain
To ensure the platform works even when external APIs are unavailable:
1. **Primary**: Google Gemini `gemini-embedding-001`
2. **Fallback 1**: Local `sentence-transformers/paraphrase-MiniLM-L3-v2` (CPU, low-memory)
3. **Fallback 2**: Deterministic hash-based pseudo-embeddings (fully offline)

### LLM Fallback Chain
All AI generation requests try models in this order:
1. Gemini 2.5 Flash → Gemini 2.0 Flash
2. Groq LLaMA 3.3 70B → Groq LLaMA 3.1 8B (if Gemini quota is exhausted)

### Question Lab
- **Summarize**: Gemini reads the full document chunks and produces a structured academic summary
- **Generate Questions**: Produces MCQ, short-answer, or long-answer questions from selected documents
- **Past Paper Analysis**: Renders exam paper pages as images (150 DPI via PyMuPDF) and sends them to Gemini Vision to extract question patterns, mark distributions, and repeat topics
- **Exam Prediction**: After analyzing multiple past papers, synthesizes the pattern data to predict likely upcoming questions

### Copyright Detection
Before a document is processed, Mentora scans it for copyright indicators:
- PDF metadata fields (title, author, producer, creator) are checked against known publisher keywords (Pearson, Wiley, Elsevier, Springer, etc.)
- The first and last 3 pages are scanned for copyright notice phrases
- Flagged documents are queued for admin review instead of being published

---

## Admin Panel

Admins access a separate dashboard at `/admin/dashboard` with:

- **System stats**: total users, documents, chat sessions, today's registrations
- **Daily registration chart**: 30-day user growth graph
- **User management**: list, search, filter (suspended, high-warning, unverified), suspend/unsuspend, reset warnings
- **Document review**: approve or reject flagged documents, optionally warn or suspend the uploader
- **Suspension appeals**: review and decide on user appeals
- **Audit logs**: full history of admin actions with timestamps

Admin access is granted by setting `is_admin = true` on a user record in the database.

---

## Security

- **JWT tokens**: Short-lived access tokens (60 min) + long-lived refresh tokens (7 days)
- **Password hashing**: bcrypt via passlib
- **OTP codes**: Cryptographically random 6-digit codes (using `secrets.randbelow`) with 10-minute expiry
- **Rate limiting**: Applied globally via SlowAPI; auth-sensitive endpoints (OTP verify, resend, login) have additional in-process rate limiting per IP
- **Sensitive field stripping**: `password_hash`, OTP codes, and reset codes are explicitly removed from every API response
- **Input sanitization**: Admin search inputs are sanitized before being used in PostgREST filter queries
- **CORS**: Restricted to the configured frontend origin(s) only
- **Copyright protection**: AI-assisted document scanning prevents copyrighted textbooks from being uploaded
- **Suspension system**: Repeat policy violators can be suspended from uploading; they can appeal through the platform

---

## License

This project is proprietary. All rights reserved.
