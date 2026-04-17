import { useMemo, useState, useEffect } from 'react';
import { SlidersHorizontal } from 'lucide-react';

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

const ChatPreferencesBar = ({
  preferences,
  onChange,
  scopeLabel,
  compact = false,
  renderExtraControls,
  closeSignal,
  modeOptions,
}) => {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!closeSignal) return;
    setExpanded(false);
  }, [closeSignal]);

  const labels = useMemo(() => {
    const activeModeOptions = modeOptions || MODE_OPTIONS;
    const language = LANGUAGE_OPTIONS.find((option) => option.value === preferences.language)?.label || 'English';
    const mode = activeModeOptions.find((option) => option.value === preferences.responseMode)?.label || 'Learn';
    const detail = DETAIL_OPTIONS.find((option) => option.value === preferences.explanationLevel)?.label || 'Balanced';
    return { language, mode, detail };
  }, [preferences, modeOptions]);

  const activeModeOptions = modeOptions || MODE_OPTIONS;

  const controlClassName = compact
    ? 'min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-medium text-slate-600 outline-none transition focus:border-emerald-500'
    : 'min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-medium text-slate-600 outline-none transition focus:border-emerald-500';

  return (
    <div className={compact ? 'relative border-b border-slate-100 px-3 py-2 bg-slate-50/80' : 'relative border-b border-slate-100 px-3 py-2 bg-slate-50/80'}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-700 transition shrink-0"
          title="Customize chat style"
        >
          <SlidersHorizontal size={12} />
          Style
        </button>

        <div className="flex items-center gap-1.5 min-w-0">
          <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600 truncate">
            {labels.language}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600 truncate">
            {labels.mode}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600 truncate">
            {labels.detail}
          </span>
        </div>

        <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
          low
        </span>
      </div>

      {expanded && (
        <div className="absolute left-3 right-3 top-[calc(100%+8px)] p-2 rounded-xl border border-slate-200 bg-white/98 shadow-xl backdrop-blur-sm space-y-2 animate-fade-in z-30">
          {scopeLabel && (
            <p className="text-[10px] text-slate-400 px-1">
              {scopeLabel}
            </p>
          )}

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
              {activeModeOptions.map((option) => (
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

          {renderExtraControls?.()}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="rounded-full border border-slate-200 px-3 py-1 text-[10px] font-semibold text-slate-500 hover:border-emerald-300 hover:text-emerald-700 transition"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatPreferencesBar;