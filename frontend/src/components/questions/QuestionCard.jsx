import { useState } from 'react';
import { ChevronDown, ChevronUp, BookOpen, Flame, TrendingUp, Minus, CheckCircle2 } from 'lucide-react';

/**
 * QuestionCard
 * Renders a single practice question set.
 * - MCQ sets: shows 4 options (A/B/C/D), highlights correct answer on reveal
 * - Broad/Short sets: shows sub-parts (a/b/c) with answer reveal
 */
const PROB_CONFIG = {
  high:   { label: 'High Probability', color: '#dc2626', bg: '#fef2f2', border: '#fecaca', icon: Flame },
  medium: { label: 'Medium Probability', color: '#d97706', bg: '#fffbeb', border: '#fde68a', icon: TrendingUp },
  low:    { label: 'General',           color: '#059669', bg: '#f0fdf4', border: '#bbf7d0', icon: Minus },
};

const cleanMathText = (value) => {
  const text = String(value || '');
  return text
    .replace(/\\\$/g, '$')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\[/g, '[')
    .replace(/\\\]/g, ']')
    .replace(/\\\\/g, '\\');
};

/** Detect if a part is an MCQ part (has options array) */
const isMcqPart = (part) => Array.isArray(part?.options) && part.options.length > 0;

/** Render a single MCQ part */
const McqPart = ({ part, partIndex, showAnswer }) => {
  const correctAnswer = (part.answer || '').trim();

  return (
    <div className="question-part mcq-part">
      <div className="part-label">{part.label || `Q${partIndex + 1}`})</div>
      <div className="part-body">
        <p className="part-question">{cleanMathText(part.question)}</p>

        <div className="mcq-options">
          {part.options.map((opt, oi) => {
            const optText = cleanMathText(opt);
            const isCorrect = showAnswer && optText === correctAnswer;
            return (
              <div
                key={oi}
                className={`mcq-option ${isCorrect ? 'mcq-option--correct' : ''}`}
                style={isCorrect ? {
                  background: '#f0fdf4',
                  border: '1.5px solid #22c55e',
                  borderRadius: '6px',
                  color: '#166534',
                  fontWeight: 600,
                } : {
                  background: '#f8fafc',
                  border: '1.5px solid #e2e8f0',
                  borderRadius: '6px',
                }}
              >
                {isCorrect && (
                  <CheckCircle2
                    size={14}
                    style={{ color: '#22c55e', flexShrink: 0, marginRight: 6 }}
                  />
                )}
                <span>{optText}</span>
              </div>
            );
          })}
        </div>

        {showAnswer && part.answer && (
          <div className="part-answer" style={{ marginTop: 8 }}>
            <span className="answer-label">Correct Answer:</span>
            <p style={{ color: '#166534', fontWeight: 600 }}>{cleanMathText(part.answer)}</p>
          </div>
        )}
      </div>
      <div className="part-marks">[{part.marks || 1}]</div>
    </div>
  );
};

/** Render a broad/short part */
const BroadPart = ({ part, partIndex, showAnswer }) => (
  <div className="question-part">
    <div className="part-label">{part.label || String.fromCharCode(97 + partIndex)})</div>
    <div className="part-body">
      <p className="part-question">{cleanMathText(part.question)}</p>
      {showAnswer && part.answer && (
        <div className="part-answer">
          <span className="answer-label">Answer:</span>
          <p>{cleanMathText(part.answer)}</p>
        </div>
      )}
    </div>
    <div className="part-marks">[{part.marks || '?'}]</div>
  </div>
);

const QuestionCard = ({ questionSet, index }) => {
  const [showAnswers, setShowAnswers] = useState(false);

  const prob = PROB_CONFIG[questionSet.probability] || PROB_CONFIG.medium;
  const ProbIcon = prob.icon;
  const parts = questionSet.parts || [];

  const totalMarks = parts.reduce((s, p) => s + (p.marks || 0), 0);
  const hasMcq = parts.some(isMcqPart);

  return (
    <div
      className="question-card"
      style={{ borderLeft: `4px solid ${prob.color}`, background: '#fff' }}
    >
      {/* Header */}
      <div className="question-card-header">
        <div className="question-meta">
          <span className="q-set-badge">{hasMcq ? 'MCQ' : `Set ${questionSet.set_number || index + 1}`}</span>
          <span className="topic-tag">{questionSet.topic || 'General'}</span>
        </div>
        <div className="question-right-meta">
          <span
            className="prob-badge"
            style={{ background: prob.bg, color: prob.color, border: `1px solid ${prob.border}` }}
          >
            <ProbIcon size={11} />
            {prob.label}
          </span>
          <span className="marks-badge">[{totalMarks} marks]</span>
        </div>
      </div>

      {/* Parts */}
      <div className="question-parts">
        {parts.map((part, pi) =>
          isMcqPart(part) ? (
            <McqPart key={pi} part={part} partIndex={pi} showAnswer={showAnswers} />
          ) : (
            <BroadPart key={pi} part={part} partIndex={pi} showAnswer={showAnswers} />
          )
        )}
      </div>

      {/* Footer */}
      <div className="question-footer">
        <button
          className="show-answer-btn"
          onClick={() => setShowAnswers((v) => !v)}
        >
          <BookOpen size={14} />
          {showAnswers ? 'Hide Answers' : 'Show Answers'}
          {showAnswers ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>
    </div>
  );
};

export default QuestionCard;
