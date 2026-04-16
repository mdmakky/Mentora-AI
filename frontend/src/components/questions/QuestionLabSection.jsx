import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  FlaskConical, Upload, Plus, X, Sparkles, FileQuestion,
  Brain, ChevronDown, RotateCcw, AlertCircle, CheckCircle2,
  Flame, TrendingUp, Minus, Loader2, BookOpen, Trash2, History,
  Pencil, Wrench, Check,
} from 'lucide-react';
import useQuestionLabStore from '../../stores/questionLabStore';
import useDocumentStore from '../../stores/documentStore';
import useStudySessionTracker from '../../utils/useStudySessionTracker';
import PatternInsightsPanel from './PatternInsightsPanel';
import QuestionCard from './QuestionCard';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import ConfirmDialog from '../ui/ConfirmDialog';
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
  // Track time spent in Question Lab as a quiz session
  useStudySessionTracker({
    enabled: Boolean(courseId),
    courseId: courseId || null,
    documentId: null,
    sessionType: 'quiz',
  });

  const [showUpload, setShowUpload] = useState(false);
  const [qCount, setQCount] = useState(8);
  const [qType, setQType] = useState('broad');
  const [newTopic, setNewTopic] = useState('');
  const [expandedGroup, setExpandedGroup] = useState({ high: true, medium: true, low: false });
  const [deletingPaperIds, setDeletingPaperIds] = useState([]);
  // Inline rename state
  const [editingRunId, setEditingRunId] = useState(null);
  const [editingLabel, setEditingLabel] = useState('');
  const [savingRunId, setSavingRunId] = useState(null);
  const [deletingRunId, setDeletingRunId] = useState(null);
  const [runToDelete, setRunToDelete] = useState(null);
  const [confirmDeleteLegacy, setConfirmDeleteLegacy] = useState(false);
  const [popupState, setPopupState] = useState({ isOpen: false, title: '', message: '' });
  const renameInputRef = useRef(null);
  const topicInputRef = useRef(null);

  const showPopup = useCallback((title, message) => {
    setPopupState({ isOpen: true, title, message });
  }, []);

  const closePopup = useCallback(() => {
    setPopupState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const formatError = useCallback((error, fallback) => {
    if (!error) return fallback;
    if (typeof error === 'string') return error;
    if (error instanceof Error && error.message) return error.message;
    try {
      return JSON.stringify(error);
    } catch {
      return fallback;
    }
  }, []);

  const {
    hotTopics, hotTopicsLoading,
    patternData, analyzedAt, analyzeState, analyzeError,
    practiceQuestions, generateState, generateError, savedCount,
    generationRuns, generationsLoading, selectedGenerationId,
    paperCount,
    fetchHotTopics, addHotTopic, deleteHotTopic,
    loadCachedAnalysis, analyzePapers, generatePractice, loadSavedPractice, loadPracticeGenerations,
    setSelectedGeneration, renameGeneration, deleteGeneration,
    deleteLegacyPractice, backfillLegacyGenerations,
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
      loadPracticeGenerations(courseId, 'broad', false);
      loadSavedPractice(courseId, { questionType: 'broad' });
    }
  }, [courseId, fetchDocuments, fetchHotTopics, loadCachedAnalysis, loadPracticeGenerations, loadSavedPractice, resetSession]);

  useEffect(() => {
    if (!courseId) return;
    loadPracticeGenerations(courseId, qType);
    loadSavedPractice(courseId, { questionType: qType });
  }, [courseId, qType, loadPracticeGenerations, loadSavedPractice]);

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

  const handleChangeType = (type) => {
    if (type === qType) return;
    setQType(type);
    setSelectedGeneration(null);
    setExpandedGroup({ high: true, medium: true, low: false });
  };

  const handleSelectGeneration = async (generationId) => {
    const picked = generationRuns.find((run) => run.id === generationId);

    // Empty runs were created during early migration glitches; fall back to available legacy rows.
    if (picked && (picked.saved_rows_count || 0) === 0) {
      setSelectedGeneration(null);
      await loadSavedPractice(courseId, { questionType: qType });
      setExpandedGroup({ high: true, medium: true, low: false });
      return;
    }

    setSelectedGeneration(generationId || null);
    if (!courseId) return;
    await loadSavedPractice(courseId, {
      questionType: qType,
      generationId: generationId || null,
    });
    setExpandedGroup({ high: true, medium: true, low: false });
  };

  // ── Inline rename handlers ────────────────────────────────────────────────
  const handleStartRename = (run) => {
    setEditingRunId(run.id);
    setEditingLabel(run.generation_label || '');
    // Focus the input on next tick
    setTimeout(() => renameInputRef.current?.select(), 20);
  };

  const handleCancelRename = () => {
    setEditingRunId(null);
    setEditingLabel('');
  };

  const handleSaveRename = async (run) => {
    setSavingRunId(run.id);
    const result = await renameGeneration(run.id, editingLabel.trim());
    setSavingRunId(null);
    if (!result.success) {
      showPopup('Rename Failed', formatError(result.error, 'Could not rename generation'));
      return;
    }
    setEditingRunId(null);
    setEditingLabel('');
    await loadPracticeGenerations(courseId, qType);
  };

  const handleRenameKeyDown = (e, run) => {
    if (e.key === 'Enter') handleSaveRename(run);
    if (e.key === 'Escape') handleCancelRename();
  };

  // ── Delete handler ───────────────────────────────────────────────────────
  const executeDeleteGeneration = async (run) => {
    setDeletingRunId(run.id);
    const result = await deleteGeneration(run.id);
    setDeletingRunId(null);

    if (!result.success) {
      showPopup('Delete Failed', formatError(result.error, 'Could not delete generation'));
      return;
    }
    // Reload questions for the next available run
    await loadPracticeGenerations(courseId, qType);
    await loadSavedPractice(courseId, { questionType: qType });
  };

  const handleDeleteGeneration = (run) => {
    setRunToDelete(run);
  };

  const executeDeleteLegacyQuestions = async () => {
    const result = await deleteLegacyPractice(courseId, qType);
    if (!result.success) {
      showPopup('Delete Failed', formatError(result.error, 'Could not delete legacy questions'));
      return;
    }

    await loadPracticeGenerations(courseId, qType);
    await loadSavedPractice(courseId, { questionType: qType });
    showPopup('Legacy Questions Deleted', `Deleted ${result.deletedCount || 0} legacy question rows.`);
  };

  const handleDeleteLegacyQuestions = () => {
    setConfirmDeleteLegacy(true);
  };

  const handleBackfillLegacyRuns = async () => {
    const result = await backfillLegacyGenerations(courseId, qType);
    if (!result.success) {
      showPopup('Backfill Failed', formatError(result.error, 'Could not backfill legacy runs'));
      return;
    }
    await loadPracticeGenerations(courseId, qType);
    await loadSavedPractice(courseId, { questionType: qType });
    const created = result.data?.created_count || 0;
    const linked = result.data?.linked_rows || 0;
    showPopup('Backfill Complete', `Created ${created} run(s), linked ${linked} legacy row(s).`);
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
                    onClick={() => handleChangeType(t.value)}
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
          {!generateError && hasAnalysis && !hasQuestions && (
            <div className="ql-progress-hint">
              No saved {qType.toUpperCase()} questions found yet. Generate again or use a different question type.
            </div>
          )}
          {analyzeState === 'loading' && (
            <p className="ql-progress-hint">
              📄 Reading your question papers as images for accurate table/box detection… This may take 20–60 seconds.
            </p>
          )}

          <div className="ql-run-history-panel">
            <div className="ql-run-history-head">
              <div className="ql-run-history-title">
                <History size={14} /> Generation History
              </div>
            </div>

            {generationsLoading ? (
              <div className="ql-run-history-loading"><Loader2 size={13} className="spin" /> Loading runs…</div>
            ) : generationRuns.length === 0 ? (
              <div className="ql-run-history-empty">No generation runs for this question type yet.</div>
            ) : (
              <div className="ql-run-list">
                {generationRuns.map((run, idx) => {
                  const active = selectedGenerationId === run.id;
                  const createdAt = run.created_at ? new Date(run.created_at).toLocaleString() : 'Unknown time';
                  const status = run.status || 'completed';
                  const label = run.generation_label || `Run ${generationRuns.length - idx}`;
                  return (
                    <div key={run.id} className={`ql-run-item ${active ? 'active' : ''}`}>
                      <button type="button" className="ql-run-main" onClick={() => handleSelectGeneration(run.id)}>
                        <div className="ql-run-label-row">
                          <span className="ql-run-label">{label}</span>
                          <span className={`ql-run-status status-${status}`}>{status}</span>
                        </div>
                        <div className="ql-run-meta">
                          <span>{run.question_type?.toUpperCase?.() || qType.toUpperCase()}</span>
                          <span>{run.generated_sets_count ?? 0} sets</span>
                          <span>{run.saved_rows_count ?? 0} saved</span>
                          {(run.failed_rows_count || 0) > 0 && <span>{run.failed_rows_count} failed</span>}
                          <span>{createdAt}</span>
                        </div>
                      </button>
                      <div className="ql-run-actions">
                        {editingRunId === run.id ? (
                          // Inline rename edit mode
                          <>
                            <input
                              ref={renameInputRef}
                              type="text"
                              value={editingLabel}
                              onChange={(e) => setEditingLabel(e.target.value)}
                              onKeyDown={(e) => handleRenameKeyDown(e, run)}
                              className="ql-run-rename-input"
                              placeholder="Run label…"
                              maxLength={120}
                              disabled={savingRunId === run.id}
                            />
                            <button
                              type="button"
                              className="ql-run-action-btn ql-run-action-btn--save"
                              onClick={() => handleSaveRename(run)}
                              disabled={savingRunId === run.id}
                              title="Save name"
                            >
                              {savingRunId === run.id
                                ? <Loader2 size={13} className="spin" />
                                : <Check size={13} />}
                            </button>
                            <button
                              type="button"
                              className="ql-run-action-btn"
                              onClick={handleCancelRename}
                              title="Cancel"
                            >
                              <X size={13} />
                            </button>
                          </>
                        ) : (
                          // Normal mode: rename | delete
                          <>
                            <button
                              type="button"
                              className="ql-run-action-btn"
                              onClick={() => handleStartRename(run)}
                              title="Rename run"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              type="button"
                              className="ql-run-action-btn ql-run-action-btn--danger"
                              onClick={() => handleDeleteGeneration(run)}
                              disabled={deletingRunId === run.id}
                              title="Delete run and all its questions"
                            >
                              {deletingRunId === run.id
                                ? <Loader2 size={13} className="spin" />
                                : <Trash2 size={13} />}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
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
            <div className="ql-generation-controls">
              <label className="ql-generation-label">
                <History size={13} /> Generation
              </label>
              <select
                className="ql-generation-select"
                value={selectedGenerationId || ''}
                onChange={(e) => handleSelectGeneration(e.target.value)}
                disabled={generationsLoading || generationRuns.length === 0}
              >
                {generationRuns.length === 0 && <option value="">No saved generations</option>}
                {generationRuns.map((run, idx) => {
                  const when = run.created_at ? new Date(run.created_at).toLocaleString() : 'Unknown time';
                  const status = run.status || 'completed';
                  const sets = Number.isFinite(run.generated_sets_count) ? run.generated_sets_count : '?';
                  const label = run.generation_label || `Run ${generationRuns.length - idx}`;
                  return (
                    <option key={run.id} value={run.id}>
                      {`${label} · ${run.question_type?.toUpperCase?.() || qType.toUpperCase()} · ${sets} sets · ${status} · ${when}`}
                    </option>
                  );
                })}
              </select>
              {generationRuns.length === 0 && practiceQuestions.length > 0 && (
                <div className="ql-legacy-actions">
                  <button
                    type="button"
                    className="ql-backfill-btn"
                    onClick={handleBackfillLegacyRuns}
                  >
                    <Wrench size={12} /> Convert Legacy To Generation
                  </button>
                  <button
                    type="button"
                    className="ql-delete-legacy-btn"
                    onClick={handleDeleteLegacyQuestions}
                  >
                    <Trash2 size={12} /> Delete Legacy Questions
                  </button>
                </div>
              )}
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

      <ConfirmDialog
        isOpen={Boolean(runToDelete)}
        onClose={() => setRunToDelete(null)}
        onConfirm={() => {
          if (runToDelete) {
            void executeDeleteGeneration(runToDelete);
          }
        }}
        title="Delete Generation Run"
        message={`Delete "${runToDelete?.generation_label || 'this run'}" and all its saved questions permanently? This cannot be undone.`}
        confirmLabel="Delete Run"
        confirmVariant="danger"
      />

      <ConfirmDialog
        isOpen={confirmDeleteLegacy}
        onClose={() => setConfirmDeleteLegacy(false)}
        onConfirm={() => {
          void executeDeleteLegacyQuestions();
        }}
        title="Delete Legacy Questions"
        message={`Delete old generated ${qType.toUpperCase()} questions for this course that are not linked to any generation run? This cannot be undone.`}
        confirmLabel="Delete Legacy"
        confirmVariant="danger"
      />

      <Modal isOpen={popupState.isOpen} onClose={closePopup} title={popupState.title || 'Notice'} maxWidth="520px">
        <p className="text-sm text-slate-700 leading-relaxed">{popupState.message}</p>
      </Modal>
    </div>
  );
};

export default QuestionLabSection;
