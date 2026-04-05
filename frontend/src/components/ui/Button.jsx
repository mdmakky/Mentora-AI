import { Loader2 } from 'lucide-react';

const variants = {
  primary:
    'bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-200',
  secondary:
    'bg-slate-900 text-white hover:bg-slate-700 focus:ring-slate-200',
  ghost:
    'bg-transparent text-slate-700 hover:bg-slate-100 focus:ring-slate-100',
  danger:
    'bg-rose-600 text-white hover:bg-rose-700 focus:ring-rose-200',
  outline:
    'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 focus:ring-slate-100',
};

const sizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
};

const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  ...props
}) => {
  return (
    <button
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center gap-2
        rounded-xl font-semibold
        transition-all duration-200
        focus:outline-none focus:ring-4
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant] || variants.primary}
        ${sizes[size] || sizes.md}
        ${className}
      `}
      {...props}
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
};

export default Button;
