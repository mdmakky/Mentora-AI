import { useState } from 'react';
import { ChevronDown, ChevronUp, BookOpen, Flame, TrendingUp, Minus } from 'lucide-react';

/**
 * QuestionCard
 * Renders a single practice question set with sub-parts.
 * Supports answer reveal toggle.
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

const QuestionCard = ({ questionSet, index }) => {
  const [showAnswers, setShowAnswers] = useState(false);

  const prob = PROB_CONFIG[questionSet.probability] || PROB_CONFIG.medium;
  const ProbIcon = prob.icon;

  const totalMarks = (questionSet.parts || []).reduce((s, p) => s + (p.marks || 0), 0);

  return (
    <div
      className="question-card"
      style={{ borderLeft: `4px solid ${prob.color}`, background: '#fff' }}
    >
      {/* Header */}
      <div className="question-card-header">
        <div className="question-meta">
          <span className="q-set-badge">Set {questionSet.set_number || index + 1}</span>
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
        {(questionSet.parts || []).map((part, pi) => (
          <div key={pi} className="question-part">
            <div className="part-label">{part.label || String.fromCharCode(97 + pi)})</div>
            <div className="part-body">
              <p className="part-question">{cleanMathText(part.question)}</p>
              {showAnswers && part.answer && (
                <div className="part-answer">
                  <span className="answer-label">Answer:</span>
                  <p>{cleanMathText(part.answer)}</p>
                </div>
              )}
            </div>
            <div className="part-marks">[{part.marks || '?'}]</div>
          </div>
        ))}
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
