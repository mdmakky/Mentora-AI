import { useState, useEffect, useRef, useMemo } from 'react';
import {
  FlaskConical, Upload, Plus, X, Sparkles, FileQuestion,
  Brain, ChevronDown, RotateCcw, AlertCircle, CheckCircle2,
  Flame, TrendingUp, Minus, Loader2, BookOpen, Trash2,
} from 'lucide-react';
import useQuestionLabStore from '../../stores/questionLabStore';
import useDocumentStore from '../../stores/documentStore';
import PatternInsightsPanel from './PatternInsightsPanel';
import QuestionCard from './QuestionCard';
import Button from '../ui/Button';
import UploadModal from '../documents/UploadModal';

const QUESTION_COUNTS = [5, 6, 7, 8];
const QUESTION_TYPES = [
  { value: 'broad', label: 'Broad / Essay', desc: 'Multi-part exam questions with sub-parts' },
  { value: 'short', label: 'Short Answer', desc: '2–4 mark concise questions' },
  { value: 'mcq', label: 'MCQ', desc: 'Multiple choice with 4 options' },
];

const PROB_GROUPS = [
  { key: 'high',   label: '🔴 High Probability',   desc: 'Appeared in multiple papers + hot topic' },
  { key: 'medium', label: '🟡 Medium Probability',  desc: 'Appeared in past papers or hot topic' },
  { key: 'low',    label: '🟢 General Practice',    desc: 'Based on course content' },
];

// ─── Step indicator ──────────────────────────────────────────────────────────
const Step = ({ n, label, active, done }) => (
  <div className={`ql-step ${active ? 'active' : ''} ${done ? 'done' : ''}`}>
    <div className="ql-step-num">{done ? <CheckCircle2 size={14} /> : n}</div>
    <span className="ql-step-label">{label}</span>
  </div>
);

// ─── Empty state for no papers ────────────────────────────────────────────────
const NoPapersState = ({ onUpload }) => (
  <div className="ql-empty-state">
    <div className="ql-empty-icon"><FileQuestion size={32} /></div>
    <h3>No Past Papers Found</h3>
    <p>Upload 2–3 years of past question papers to get started. The AI will analyze the pattern and generate practice questions matching your exam format.</p>
    <Button onClick={onUpload} size="sm">
      <Upload size={15} /> Upload Past Papers
    </Button>
  </div>
);

const formatBytes = (bytes) => {
  if (!bytes || Number.isNaN(bytes)) return '-';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
};

// ─── Main Component ───────────────────────────────────────────────────────────
const QuestionLabSection = ({ courseId, course }) => {
  const [showUpload, setShowUpload] = useState(false);
  const [qCount, setQCount] = useState(8);
  const [qType, setQType] = useState('broad');
  const [newTopic, setNewTopic] = useState('');
  const [expandedGroup, setExpandedGroup] = useState({ high: true, medium: true, low: false });
  const [deletingPaperIds, setDeletingPaperIds] = useState([]);
  const topicInputRef = useRef(null);

  const {
    hotTopics, hotTopicsLoading,
    patternData, analyzedAt, analyzeState, analyzeError,
    practiceQuestions, generateState, generateError, savedCount,
    paperCount,
    fetchHotTopics, addHotTopic, deleteHotTopic,
    loadCachedAnalysis, analyzePapers, generatePractice, loadSavedPractice,
    setPaperCount, resetSession,
  } = useQuestionLabStore();

  const { documents, deleteDocument, fetchDocuments } = useDocumentStore();

  const safeDocuments = Array.isArray(documents) ? documents : [];
  const questionPapers = useMemo(
    () => safeDocuments.filter(
      (d) => d.doc_category === 'question_paper' && !d.is_deleted && (!courseId || d.course_id === courseId)
    ),
    [safeDocuments, courseId]
  );

  // Count question_paper docs for this course
  useEffect(() => {
    setPaperCount(questionPapers.length);
  }, [questionPapers.length, setPaperCount]);

  useEffect(() => {
    resetSession();
    setExpandedGroup({ high: true, medium: true, low: false });
    setQCount(8);
    setQType('broad');
    setNewTopic('');
    setDeletingPaperIds([]);

    if (courseId) {
      // Force fresh fetch from backend (bypass cache)
      (async () => {
        await fetchDocuments(courseId);
      })();
      fetchHotTopics(courseId);
      loadCachedAnalysis(courseId);
      loadSavedPractice(courseId);
    }
  }, [courseId, fetchDocuments, fetchHotTopics, loadCachedAnalysis, loadSavedPractice, resetSession]);

  const hasPapers = questionPapers.length > 0;
  const hasAnalysis = analyzeState === 'done' && patternData;
  const hasQuestions = practiceQuestions.length > 0;

  const currentStep = hasQuestions ? 3 : hasAnalysis ? 2 : 1;

  const handleAddTopic = async (e) => {
    e.preventDefault();
    if (!newTopic.trim()) return;
    await addHotTopic(courseId, newTopic.trim());
    setNewTopic('');
    topicInputRef.current?.focus();
  };

  const handleAnalyze = async () => {
    await analyzePapers(courseId);
  };

  const handleGenerate = async () => {
    await generatePractice(courseId, { count: qCount, questionType: qType });
    setExpandedGroup({ high: true, medium: true, low: false });
  };

  const handleReset = () => {
    resetSession();
  };

  const handleDeletePaper = async (docId) => {
    setDeletingPaperIds((prev) => [...prev, docId]);
    await deleteDocument(docId);
    setDeletingPaperIds((prev) => prev.filter((id) => id !== docId));
  };

  // Group questions by probability
  const grouped = {
    high:   practiceQuestions.filter((q) => q.probability === 'high'),
    medium: practiceQuestions.filter((q) => q.probability === 'medium'),
    low:    practiceQuestions.filter((q) => q.probability === 'low' || !q.probability || !['high','medium'].includes(q.probability)),
  };

  return (
    <div className="question-lab-root">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="ql-header">
        <div className="ql-header-title">
          <div className="ql-header-icon"><FlaskConical size={20} /></div>
          <div>
            <h2>Question Lab</h2>
            <p>AI-powered practice questions based on your past exam papers</p>
          </div>
        </div>
        {hasQuestions && (
          <button className="ql-reset-btn" onClick={handleReset} title="Clear results and start over">
            <RotateCcw size={14} /> Reset
          </button>
        )}
      </div>

      {/* ── Step Indicator ─────────────────────────────────────────── */}
      <div className="ql-steps">
        <Step n={1} label="Upload Papers" active={currentStep === 1} done={currentStep > 1} />
        <div className="ql-step-divider" />
        <Step n={2} label="Analyze Pattern" active={currentStep === 2} done={currentStep > 2} />
        <div className="ql-step-divider" />
        <Step n={3} label="Practice Questions" active={currentStep === 3} done={false} />
      </div>

      {/* ── Panel A: Setup ─────────────────────────────────────────── */}
      <div className="ql-panel">
        {/* Past Papers */}
        <div className="ql-section">
          <div className="ql-section-head">
            <FileQuestion size={16} className="ql-section-icon" />
            <div>
              <h4>Past Question Papers</h4>
              <p>Upload scanned PDFs of past 2–3 year exams. The AI reads tables, boxes and marks directly from images.</p>
            </div>
          </div>
          <div className="ql-papers-bar">
            <div className={`ql-papers-count ${hasPapers ? 'has-papers' : ''}`}>
              {hasPapers
                ? <><CheckCircle2 size={14} /> {questionPapers.length} paper{questionPapers.length > 1 ? 's' : ''} ready</>
                : <><AlertCircle size={14} /> No papers uploaded yet</>
              }
            </div>
            <Button size="sm" variant="outline" onClick={() => setShowUpload(true)}>
              <Upload size={14} /> Upload Paper
            </Button>
          </div>
          {hasPapers && (
            <div className="ql-paper-list">
              {questionPapers.map((paper) => {
                const deleting = deletingPaperIds.includes(paper.id);
                return (
                  <div key={paper.id} className="ql-paper-item">
                    <div className="ql-paper-info">
                      <span className="ql-paper-name">{paper.original_name || paper.file_name || 'Untitled paper'}</span>
                      <span className="ql-paper-meta">{formatBytes(paper.file_size)}{paper.page_count ? ` · ${paper.page_count} pg` : ''}</span>
                    </div>
                    <button
                      type="button"
                      className="ql-paper-delete-btn"
                      onClick={() => handleDeletePaper(paper.id)}
                      disabled={deleting}
                      title="Remove this paper"
                    >
                      {deleting ? <Loader2 size={13} className="spin" /> : <Trash2 size={13} />}
                      {deleting ? 'Removing...' : 'Remove'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {!hasPapers && <NoPapersState onUpload={() => setShowUpload(true)} />}
        </div>

        {/* Hot Topics */}
        <div className="ql-section">
          <div className="ql-section-head">
            <Flame size={16} className="ql-section-icon" style={{ color: '#d97706' }} />
            <div>
              <h4>Teacher's Hot Topics</h4>
              <p>Topics your teacher emphasized in class. These get priority in question generation.</p>
            </div>
          </div>

          {/* Add topic form */}
          <form onSubmit={handleAddTopic} className="ql-topic-form">
            <input
              ref={topicInputRef}
              type="text"
              placeholder="e.g. SQL Injection, AES-256, Playfair Cipher..."
              value={newTopic}
              onChange={(e) => setNewTopic(e.target.value)}
              className="ql-topic-input"
            />
            <Button type="submit" size="sm" disabled={!newTopic.trim()}>
              <Plus size={14} /> Add
            </Button>
          </form>

          {/* Topic chips */}
          {hotTopicsLoading ? (
            <div className="ql-topics-loading">
              <Loader2 size={14} className="spin" /> Loading topics...
            </div>
          ) : hotTopics.length > 0 ? (
            <div className="ql-topics-chips">
              {hotTopics.map((t) => (
                <span key={t.id} className="ql-topic-chip">
                  <Flame size={11} />
                  {t.topic}
                  <button onClick={() => deleteHotTopic(courseId, t.id)} className="ql-topic-del">
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="ql-topics-empty">No hot topics added yet. Add topics your teacher focused on.</p>
          )}
        </div>

        {/* Generate Controls */}
        <div className="ql-section ql-controls-section">
          <div className="ql-controls-row">
            {/* Question Count */}
            <div className="ql-control-group">
              <label className="ql-control-label">Number of Questions</label>
              <div className="ql-count-btns">
                {QUESTION_COUNTS.map((n) => (
                  <button
                    key={n}
                    className={`ql-count-btn ${qCount === n ? 'active' : ''}`}
                    onClick={() => setQCount(n)}
                  >{n}</button>
                ))}
              </div>
            </div>

            {/* Question Type */}
            <div className="ql-control-group">
              <label className="ql-control-label">Question Type</label>
              <div className="ql-type-select">
                {QUESTION_TYPES.map((t) => (
                  <button
                    key={t.value}
                    className={`ql-type-btn ${qType === t.value ? 'active' : ''}`}
                    onClick={() => setQType(t.value)}
                    title={t.desc}
                  >{t.label}</button>
                ))}
              </div>
            </div>
          </div>

          {/* CTA Button */}
          <div className="ql-cta-row">
            {!hasAnalysis ? (
              <button
                className="ql-cta-btn ql-analyze-btn"
                onClick={handleAnalyze}
                disabled={!hasPapers || analyzeState === 'loading'}
              >
                {analyzeState === 'loading' ? (
                  <><Loader2 size={16} className="spin" /> Analyzing papers with vision AI…</>
                ) : (
                  <><Brain size={16} /> Analyze Past Papers</>
                )}
              </button>
            ) : (
              <button
                className="ql-cta-btn ql-generate-btn"
                onClick={handleGenerate}
                disabled={generateState === 'loading'}
              >
                {generateState === 'loading' ? (
                  <><Loader2 size={16} className="spin" /> Generating practice questions…</>
                ) : (
                  <><Sparkles size={16} /> Generate {qCount} Practice Questions</>
                )}
              </button>
            )}

            {/* Re-analyze button if already analyzed */}
            {hasAnalysis && (
              <button
                className="ql-reanalyze-btn"
                onClick={handleAnalyze}
                disabled={analyzeState === 'loading'}
                title="Re-analyze if you've uploaded more papers"
              >
                <RotateCcw size={13} /> Re-analyze
              </button>
            )}
          </div>

          {analyzeError && (
            <div className="ql-error-msg">
              <AlertCircle size={14} /> {analyzeError}
            </div>
          )}
          {generateError && (
            <div className="ql-error-msg">
              <AlertCircle size={14} /> {generateError}
            </div>
          )}
          {analyzeState === 'loading' && (
            <p className="ql-progress-hint">
              📄 Reading your question papers as images for accurate table/box detection… This may take 20–60 seconds.
            </p>
          )}
        </div>
      </div>

      {/* ── Panel B: Pattern Insights ───────────────────────────────── */}
      {hasAnalysis && (
        <PatternInsightsPanel
          patternData={patternData}
          papersAnalyzed={patternData?.papers_analyzed || 1}
          analyzedAt={analyzedAt}
        />
      )}

      {/* ── Panel C: Practice Questions ─────────────────────────────── */}
      {hasQuestions && (
        <div className="ql-results-panel">
          <div className="ql-results-header">
            <div className="ql-results-title">
              <Sparkles size={18} className="ql-results-icon" />
              <div>
                <h3>Practice Questions</h3>
                <p>{practiceQuestions.length} sets generated · matching your exam format</p>
              </div>
            </div>
          </div>

          {PROB_GROUPS.map(({ key, label, desc }) => {
            const qs = grouped[key];
            if (qs.length === 0) return null;
            const isOpen = expandedGroup[key];
            return (
              <div key={key} className="ql-prob-group">
                <button
                  className="ql-prob-group-header"
                  onClick={() => setExpandedGroup((p) => ({ ...p, [key]: !p[key] }))}
                >
                  <div>
                    <span className="ql-prob-group-label">{label}</span>
                    <span className="ql-prob-group-desc">{desc}</span>
                  </div>
                  <div className="ql-prob-group-right">
                    <span className="ql-prob-count">{qs.length} sets</span>
                    <ChevronDown size={16} className={`ql-chevron ${isOpen ? 'open' : ''}`} />
                  </div>
                </button>
                {isOpen && (
                  <div className="ql-prob-group-body">
                    {qs.map((q, i) => (
                      <QuestionCard key={i} questionSet={q} index={i} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Modal — pre-set to question_paper category */}
      <UploadModal
        isOpen={showUpload}
        onClose={() => setShowUpload(false)}
        courseId={courseId}
        folderId={null}
        forceCategory="question_paper"
      />
    </div>
  );
};

export default QuestionLabSection;
