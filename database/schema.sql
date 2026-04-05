-- ============================================
-- Mentora Database Schema v3.0
-- Run this in Supabase SQL Editor
-- ============================================

-- Step 1: Extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Step 2: Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Table: users
-- ============================================
CREATE TABLE public.users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           TEXT NOT NULL UNIQUE,
    password_hash   TEXT,
    verification_code TEXT,
    verification_code_expires_at TIMESTAMPTZ,
    reset_code      TEXT,
    reset_code_expires_at TIMESTAMPTZ,
    full_name       TEXT,
    university      TEXT,
    department      TEXT,
    current_semester INT DEFAULT 1,
    avatar_url      TEXT,
    study_goal_minutes INT DEFAULT 120,
    warning_count   INT DEFAULT 0,
    is_upload_suspended BOOLEAN DEFAULT FALSE,
    is_admin        BOOLEAN DEFAULT FALSE,
    email_verified  BOOLEAN DEFAULT FALSE,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER users_updated_at BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- Table: semesters
-- ============================================
CREATE TABLE public.semesters (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    year        INT NOT NULL,
    term        TEXT NOT NULL,
    is_current  BOOLEAN DEFAULT FALSE,
    sort_order  INT DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, name)
);

-- ============================================
-- Table: courses
-- ============================================
CREATE TABLE public.courses (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    semester_id  UUID NOT NULL REFERENCES public.semesters(id) ON DELETE CASCADE,
    user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    course_code  TEXT NOT NULL,
    course_name  TEXT NOT NULL,
    instructor   TEXT,
    credit_hours DECIMAL(3,1),
    color        TEXT DEFAULT '#2563EB',
    sort_order   INT DEFAULT 0,
    is_archived  BOOLEAN DEFAULT FALSE,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Table: folders
-- ============================================
CREATE TABLE public.folders (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id   UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    parent_id   UUID REFERENCES public.folders(id) ON DELETE CASCADE,
    sort_order  INT DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Table: documents
-- ============================================
CREATE TABLE public.documents (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id              UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    course_id            UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    folder_id            UUID REFERENCES public.folders(id) ON DELETE SET NULL,
    file_name            TEXT NOT NULL,
    original_name        TEXT NOT NULL,
    cloudinary_url       TEXT NOT NULL,
    cloudinary_public_id TEXT NOT NULL,
    file_size            BIGINT,
    file_type            TEXT NOT NULL,
    page_count           INT DEFAULT 0,
    doc_category         TEXT DEFAULT 'lecture',
    processing_status    TEXT DEFAULT 'pending',
    copyright_flag       BOOLEAN DEFAULT FALSE,
    file_hash            TEXT,
    chunk_count          INT DEFAULT 0,
    is_deleted           BOOLEAN DEFAULT FALSE,
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER documents_updated_at BEFORE UPDATE ON public.documents
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- Table: document_chunks (Vector Store)
-- ============================================
CREATE TABLE public.document_chunks (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id   UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    course_id     UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    chunk_index   INT NOT NULL,
    content       TEXT NOT NULL,
    page_number   INT,
    section_title TEXT,
    slide_number  INT,
    embedding     vector(768),
    token_count   INT,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX document_chunks_embedding_idx
ON document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX ON document_chunks (user_id, course_id);
CREATE INDEX ON document_chunks (document_id);

-- ============================================
-- Table: chat_sessions
-- ============================================
CREATE TABLE public.chat_sessions (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    course_id   UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    title       TEXT DEFAULT 'New Chat',
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER chat_sessions_updated_at BEFORE UPDATE ON public.chat_sessions
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- Table: chat_messages
-- ============================================
CREATE TABLE public.chat_messages (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id    UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
    role          TEXT NOT NULL CHECK (role IN ('user','assistant')),
    content       TEXT NOT NULL,
    source_chunks UUID[],
    source_docs   JSONB DEFAULT '[]',
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Table: document_summaries
-- ============================================
CREATE TABLE public.document_summaries (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id   UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    summary_type  TEXT DEFAULT 'full',
    language      TEXT DEFAULT 'en',
    content       TEXT NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Table: question_banks
-- ============================================
CREATE TABLE public.question_banks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id     UUID REFERENCES public.documents(id) ON DELETE SET NULL,
    course_id       UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    question_type   TEXT NOT NULL,
    difficulty      TEXT DEFAULT 'medium',
    question_text   TEXT NOT NULL,
    answer_text     TEXT,
    options         JSONB,
    topic_tags      TEXT[],
    source_page     INT,
    is_prediction   BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Table: study_sessions
-- ============================================
CREATE TABLE public.study_sessions (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    course_id        UUID REFERENCES public.courses(id) ON DELETE SET NULL,
    document_id      UUID REFERENCES public.documents(id) ON DELETE SET NULL,
    started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at         TIMESTAMPTZ,
    duration_minutes INT,
    session_type     TEXT DEFAULT 'reading',
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Table: study_streaks
-- ============================================
CREATE TABLE public.study_streaks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    date            DATE NOT NULL,
    total_minutes   INT DEFAULT 0,
    goal_achieved   BOOLEAN DEFAULT FALSE,
    UNIQUE (user_id, date)
);

-- ============================================
-- Table: admin_activity_logs
-- ============================================
CREATE TABLE public.admin_activity_logs (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id   UUID NOT NULL,
    details     JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON admin_activity_logs (admin_id, created_at DESC);
CREATE INDEX ON admin_activity_logs (target_type, target_id);

-- ============================================
-- Row Level Security (RLS)
-- ============================================
ALTER TABLE public.users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.semesters          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_banks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_streaks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_activity_logs ENABLE ROW LEVEL SECURITY;

-- Owner access policies
CREATE POLICY "owner_access" ON public.users        FOR ALL USING (auth.uid() = id);
CREATE POLICY "owner_access" ON public.semesters     FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "owner_access" ON public.courses       FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "owner_access" ON public.folders       FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "owner_access" ON public.documents     FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "owner_access" ON public.document_chunks FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "owner_access" ON public.chat_sessions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "owner_access" ON public.document_summaries FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "owner_access" ON public.question_banks FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "owner_access" ON public.study_sessions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "owner_access" ON public.study_streaks FOR ALL USING (auth.uid() = user_id);

-- Chat messages: access via session ownership
CREATE POLICY "session_owner" ON public.chat_messages FOR ALL USING (
    EXISTS (SELECT 1 FROM public.chat_sessions WHERE id = session_id AND user_id = auth.uid())
);

-- Admin access is handled by the backend using the Supabase service role key.
-- Avoid self-referential RLS policies on public.users to prevent infinite recursion.

-- ============================================
-- Vector Similarity Search Function
-- ============================================
CREATE OR REPLACE FUNCTION match_document_chunks(
    query_embedding vector(768),
    match_user_id UUID,
    match_course_id UUID,
    match_count INT DEFAULT 7,
    match_document_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    document_id UUID,
    content TEXT,
    page_number INT,
    section_title TEXT,
    slide_number INT,
    doc_name TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        dc.id,
        dc.document_id,
        dc.content,
        dc.page_number,
        dc.section_title,
        dc.slide_number,
        d.file_name AS doc_name,
        1 - (dc.embedding <=> query_embedding) AS similarity
    FROM document_chunks dc
    JOIN documents d ON d.id = dc.document_id
    WHERE dc.user_id = match_user_id
      AND dc.course_id = match_course_id
      AND d.is_deleted = FALSE
      AND d.processing_status = 'ready'
      AND (match_document_ids IS NULL OR dc.document_id = ANY(match_document_ids))
    ORDER BY dc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
