const sizes = {
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-10 h-10 border-3',
  xl: 'w-14 h-14 border-4',
};

const Spinner = ({ size = 'md', className = '' }) => {
  return (
    <div
      className={`
        rounded-full border-emerald-200 border-t-emerald-600
        animate-spin
        ${sizes[size] || sizes.md}
        ${className}
      `}
      style={{ borderStyle: 'solid' }}
    />
  );
};

export default Spinner;
