-- Question Attempts — tracks whether a student got a practice question correct or not
CREATE TABLE IF NOT EXISTS question_attempts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question_bank_id UUID REFERENCES question_banks(id) ON DELETE CASCADE,
    course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
    is_correct BOOLEAN NOT NULL,
    attempted_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_question_attempts_user ON question_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_question_attempts_course ON question_attempts(user_id, course_id);

ALTER TABLE question_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_access" ON question_attempts USING (user_id = auth.uid());
