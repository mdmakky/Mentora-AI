import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2, Star } from 'lucide-react';
import useCourseStore from '../../stores/courseStore';
import CourseCard from './CourseCard';
import Button from '../ui/Button';
import Modal from '../ui/Modal';

const COLORS = ['#2563EB', '#059669', '#7C3AED', '#DC2626', '#D97706', '#0891B2', '#E11D48', '#4F46E5'];

const SemesterSection = ({ semester }) => {
  const [open, setOpen] = useState(semester.is_current);
  const [showAdd, setShowAdd] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    course_code: '',
    course_name: '',
    instructor: '',
    credit_hours: 3,
    color: COLORS[0],
  });

  const { courses, fetchCourses, createCourse, deleteSemester } = useCourseStore();
  const semCourses = courses[semester.id] || [];

  useEffect(() => {
    if (open) {
      fetchCourses(semester.id);
    }
  }, [open, semester.id, fetchCourses]);

  const handleAddCourse = async (e) => {
    e.preventDefault();
    setCreating(true);
    await createCourse({
      semester_id: semester.id,
      ...form,
      credit_hours: parseFloat(form.credit_hours),
    });
    setCreating(false);
    setShowAdd(false);
    setForm({ course_code: '', course_name: '', instructor: '', credit_hours: 3, color: COLORS[0] });
  };

  return (
    <div className="card overflow-hidden">
      {/* Semester header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-3 sm:px-5 py-4 hover:bg-white/35 transition text-left"
      >
        <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 min-w-0">
          {open ? (
            <ChevronDown size={18} className="text-slate-400 shrink-0" />
          ) : (
            <ChevronRight size={18} className="text-slate-400 shrink-0" />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 text-xl sm:text-lg leading-tight wrap-break-word">{semester.name}</h3>
              {semester.is_current && (
                <span className="badge badge-success text-[10px]">
                  <Star size={10} className="mr-1" /> Current
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {semester.term} {semester.year} · {semCourses.length} course{semCourses.length !== 1 && 's'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="outline" className="rounded-full" onClick={() => setShowAdd(true)}>
            <Plus size={14} />
            <span className="hidden min-[390px]:inline">Add Course</span>
          </Button>
          <button
            onClick={() => deleteSemester(semester.id)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </button>

      {/* Courses grid */}
      {open && (
        <div className="px-3 sm:px-5 pb-5 border-t border-white/50">
          {semCourses.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">
              No courses yet. Add your first course to get started.
            </p>
          ) : (
            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 pt-4">
              {semCourses.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Course Modal */}
      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add Course">
        <form onSubmit={handleAddCourse} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Course Code</label>
              <input
                type="text"
                required
                placeholder="CSE 310"
                value={form.course_code}
                onChange={(e) => setForm({ ...form, course_code: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Credit Hours</label>
              <input
                type="number"
                step="0.5"
                value={form.credit_hours}
                onChange={(e) => setForm({ ...form, credit_hours: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Course Name</label>
            <input
              type="text"
              required
              placeholder="Data Structures & Algorithms"
              value={form.course_name}
              onChange={(e) => setForm({ ...form, course_name: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Instructor</label>
            <input
              type="text"
              placeholder="Dr. Smith"
              value={form.instructor}
              onChange={(e) => setForm({ ...form, instructor: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, color: c })}
                  className="w-8 h-8 rounded-full border-2 transition-all"
                  style={{
                    background: c,
                    borderColor: form.color === c ? '#1e293b' : 'transparent',
                    transform: form.color === c ? 'scale(1.15)' : 'scale(1)',
                  }}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" type="button" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
            <Button size="sm" type="submit" loading={creating}>
              Add Course
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default SemesterSection;
