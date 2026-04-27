import { Clock, FileQuestion, BarChart3, Repeat2, TrendingUp } from 'lucide-react';

/**
 * PatternInsightsPanel
 * Shows the analyzed exam pattern and repeat topic heatmap from past papers.
 */
// Returns a color based on how many papers a topic appeared in, relative to total papers analyzed.
const FREQ_COLOR = (freq, total) => {
  if (total >= 3 && freq >= total) return { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' };
  if (total >= 3 && freq >= 2)    return { bg: '#fffbeb', color: '#d97706', border: '#fde68a' };
  if (total === 2 && freq >= 2)   return { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' };
  if (total === 2 && freq === 1)  return { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' };
  // single paper or fallback
  return { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' };
};

const StatCard = ({ icon: Icon, label, value, color = '#2563eb' }) => (
  <div className="pattern-stat-card">
    <div className="pattern-stat-icon" style={{ background: `${color}18`, color }}>
      <Icon size={16} />
    </div>
    <div>
      <p className="pattern-stat-value">{value}</p>
      <p className="pattern-stat-label">{label}</p>
    </div>
  </div>
);

const PatternInsightsPanel = ({ patternData, papersAnalyzed = 1, analyzedAt }) => {
  if (!patternData) return null;

  const fmt = patternData.exam_format || {};
  const repeatTopics = [...(patternData.repeat_topics || [])]
    .sort((a, b) => b.frequency - a.frequency);
  const typeBreakdown = patternData.question_type_breakdown || {};

  const formattedDate = analyzedAt
    ? new Date(analyzedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return (
    <div className="pattern-insights-panel">
      {/* Header */}
      <div className="pattern-header">
        <div className="pattern-header-left">
          <div className="pattern-header-icon">
            <BarChart3 size={18} />
          </div>
          <div>
            <h3 className="pattern-title">Exam Pattern Analysis</h3>
            <p className="pattern-subtitle">
              Based on {papersAnalyzed} past paper{papersAnalyzed > 1 ? 's' : ''}
              {formattedDate && <span> · Last analyzed {formattedDate}</span>}
            </p>
          </div>
        </div>
      </div>

      {/* Exam Format Stats */}
      <div className="pattern-stats-grid">
        <StatCard icon={FileQuestion} label="Total Marks" value={fmt.total_marks || '—'} color="#2563eb" />
        <StatCard icon={Repeat2} label="Sets / Answer" value={fmt.total_sets ? `${fmt.total_sets} / ${fmt.answer_required}` : '—'} color="#7c3aed" />
        <StatCard icon={Clock} label="Duration" value={fmt.time_hours ? `${fmt.time_hours}h` : '—'} color="#059669" />
        <StatCard icon={TrendingUp} label="Sub-parts" value={fmt.sub_question_style || 'a/b/c'} color="#d97706" />
      </div>

      {/* Marks distribution description */}
      {fmt.marks_distribution && (
        <div className="pattern-format-desc">
          <span className="pattern-format-label">Format:</span>
          <span>{fmt.marks_distribution}</span>
        </div>
      )}

      {/* Repeat Topics Heatmap */}
      {repeatTopics.length > 0 && (
        <div className="pattern-topics-section">
          <div className="pattern-section-title">
            <Repeat2 size={14} />
            Repeat Topics
            <span className="pattern-section-hint">Color = how many papers it appeared in</span>
          </div>
          <div className="pattern-topics-grid">
            {repeatTopics.map((t, i) => {
              const c = FREQ_COLOR(t.frequency, papersAnalyzed);
              return (
                <div
                  key={i}
                  className="topic-chip"
                  style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}
                  title={`Appeared ${t.frequency} time(s) · ~${t.typical_marks || '?'} marks · ${t.typical_type || ''}`}
                >
                  <span className="topic-chip-freq">{t.frequency}×</span>
                  <span className="topic-chip-name">{t.topic}</span>
                  {t.typical_marks && <span className="topic-chip-marks">[{t.typical_marks}]</span>}
                </div>
              );
            })}
          </div>
          <div className="pattern-legend">
            {papersAnalyzed >= 3 && (
              <><span className="legend-dot" style={{ background: '#dc2626' }} /> All {papersAnalyzed} papers&nbsp;&nbsp;</>
            )}
            {papersAnalyzed >= 2 && (
              <><span className="legend-dot" style={{ background: papersAnalyzed >= 3 ? '#d97706' : '#dc2626' }} /> {papersAnalyzed >= 3 ? '2+ papers' : 'Both papers'}&nbsp;&nbsp;</>
            )}
            <span className="legend-dot" style={{ background: '#2563eb' }} /> 1 paper
          </div>
        </div>
      )}

      {/* Question Type Breakdown */}
      {Object.keys(typeBreakdown).length > 0 && (
        <div className="pattern-type-section">
          <div className="pattern-section-title"><BarChart3 size={14} /> Question Types</div>
          <div className="pattern-type-bars">
            {Object.entries(typeBreakdown).map(([type, pct]) => (
              <div key={type} className="type-bar-row">
                <span className="type-bar-label">{type}</span>
                <div className="type-bar-track">
                  <div
                    className="type-bar-fill"
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
                <span className="type-bar-pct">{pct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PatternInsightsPanel;
