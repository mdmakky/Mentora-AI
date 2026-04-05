import { Wrench } from 'lucide-react';

const UnderConstruction = ({ title }) => {
  return (
    <div className="app-content flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600 mb-6">
        <Wrench size={32} />
      </div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">{title}</h1>
      <p className="text-slate-500 max-w-sm">
        This feature is currently under active development. Please check back later!
      </p>
    </div>
  );
};

export default UnderConstruction;
