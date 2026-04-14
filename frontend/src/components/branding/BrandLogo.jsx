import { GraduationCap } from 'lucide-react';
import { Link } from 'react-router-dom';

const BrandLogo = ({ size = 32, withText = true, to = '/', onClick }) => {
  return (
    <Link to={to} onClick={onClick} className="inline-flex items-center gap-2.5">
      <span
        className="inline-flex items-center justify-center rounded-[10px] bg-linear-to-br from-green-900 via-emerald-700 to-green-500 text-white shadow-[0_8px_20px_rgba(21,128,61,0.35)]"
        style={{ width: size, height: size }}
      >
        <GraduationCap size={Math.max(14, size * 0.56)} />
      </span>
      {withText && (
        <span className="font-['Sora'] text-base font-bold tracking-[-0.02em] text-slate-900">Mentora</span>
      )}
    </Link>
  );
};

export default BrandLogo;
