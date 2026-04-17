const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'bn', label: 'Bangla' },
  { value: 'auto', label: 'Auto' },
];

const MODE_OPTIONS = [
  { value: 'learn', label: 'Learn' },
  { value: 'summary', label: 'Summary' },
  { value: 'exam', label: 'Exam' },
  { value: 'practice', label: 'Practice' },
];

const DETAIL_OPTIONS = [
  { value: 'simple', label: 'Simple' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'deep', label: 'Deep' },
];

const ChatPreferencesBar = ({ preferences, onChange, scopeLabel, compact = false }) => {
  const controlClassName = compact
    ? 'min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-medium text-slate-600 outline-none transition focus:border-emerald-500'
    : 'min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-slate-700 outline-none transition focus:border-emerald-500';

  return (
    <div className={compact ? 'border-b border-slate-100 px-4 py-2.5 bg-slate-50/80' : 'border-b border-slate-100 px-4 py-3 bg-slate-50/80'}>
      <div className="flex items-center justify-between gap-3 mb-2">
        <div>
          <p className={compact ? 'text-[11px] font-semibold text-slate-700' : 'text-xs font-semibold text-slate-700'}>
            Chat style
          </p>
          <p className="text-[11px] text-slate-400">
            {scopeLabel}
          </p>
        </div>
        <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
          low cost
        </span>
      </div>

      <div className="flex gap-2">
        <select
          value={preferences.language}
          onChange={(event) => onChange('language', event.target.value)}
          className={controlClassName}
          aria-label="Chat language"
        >
          {LANGUAGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          value={preferences.responseMode}
          onChange={(event) => onChange('responseMode', event.target.value)}
          className={controlClassName}
          aria-label="Chat mode"
        >
          {MODE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          value={preferences.explanationLevel}
          onChange={(event) => onChange('explanationLevel', event.target.value)}
          className={controlClassName}
          aria-label="Explanation depth"
        >
          {DETAIL_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default ChatPreferencesBar;