import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2, Star, Pencil } from 'lucide-react';
import useCourseStore from '../../stores/courseStore';
import CourseCard from './CourseCard';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import ConfirmDialog from '../ui/ConfirmDialog';

const COLORS = ['#2563EB', '#059669', '#7C3AED', '#DC2626', '#D97706', '#0891B2', '#E11D48', '#4F46E5'];

const SEMESTER_TERMS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];

const extractSemesterNumber = (semester) => {
  const text = `${semester?.term || ''} ${semester?.name || ''}`.toLowerCase();
  const match = text.match(/\b([1-8])(?:st|nd|rd|th)?\b/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value >= 1 && value <= 8 ? value : null;
};

const SemesterSection = ({ semester, onDataChanged }) => {
  const [open, setOpen] = useState(semester.is_current);
  const [showAdd, setShowAdd] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditSemester, setShowEditSemester] = useState(false);
  const [semesterError, setSemesterError] = useState('');
  const [form, setForm] = useState({
    course_code: '',
    course_name: '',
    instructor: '',
    credit_hours: 3,
    color: COLORS[0],
  });
  const [semesterForm, setSemesterForm] = useState({
    name: semester.name || '',
    year: semester.year || new Date().getFullYear(),
    term: semester.term || '1st',
    is_current: Boolean(semester.is_current),
  });

  const { courses, semesters, fetchCourses, createCourse, deleteSemester, updateSemester } = useCourseStore();
  const semCourses = courses[semester.id] || [];

  const usedSemesterNumbers = new Set(
    (semesters || [])
      .filter((s) => s.id !== semester.id)
      .map((s) => extractSemesterNumber(s))
      .filter((n) => Number.isFinite(n))
  );
  const availableTerms = SEMESTER_TERMS.filter((term, index) => !usedSemesterNumbers.has(index + 1));

  useEffect(() => {
    setSemesterForm({
      name: semester.name || '',
      year: semester.year || new Date().getFullYear(),
      term: semester.term || '1st',
      is_current: Boolean(semester.is_current),
    });
  }, [semester.id, semester.name, semester.term, semester.year, semester.is_current]);

  useEffect(() => {
    if (open) {
      fetchCourses(semester.id);
    }
  }, [open, semester.id, fetchCourses]);

  const handleAddCourse = async (e) => {
    e.preventDefault();
    // Close modal and reset form immediately — store update is optimistic
    const payload = {
      semester_id: semester.id,
      ...form,
      credit_hours: parseFloat(form.credit_hours),
    };
    setShowAdd(false);
    setForm({ course_code: '', course_name: '', instructor: '', credit_hours: 3, color: COLORS[0] });
    const result = await createCourse(payload);
    if (!result.success) {
      // Rollback already done in store; just notify parent to re-fetch
      onDataChanged?.();
    }
  };

  const handleSaveSemester = async (e) => {
    e.preventDefault();
    setSemesterError('');
    if (!availableTerms.includes(semesterForm.term) && semesterForm.term !== semester.term) {
      setSemesterError('This semester number already exists.');
      return;
    }
    // Close modal immediately — store update is optimistic
    setShowEditSemester(false);
    const result = await updateSemester(semester.id, {
      name: semesterForm.name.trim(),
      year: parseInt(semesterForm.year, 10),
      term: semesterForm.term,
      is_current: semesterForm.is_current,
    });
    if (!result.success) {
      setSemesterError(result.error || 'Failed to update semester');
      setShowEditSemester(true);
    }
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
            onClick={() => {
              setSemesterError('');
              setShowEditSemester(true);
            }}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 transition"
            title="Edit semester"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
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
                  <CourseCard key={course.id} course={course} onUpdated={onDataChanged} />
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
            <Button size="sm" type="submit">
              Add Course
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => {
          setShowDeleteConfirm(false);
          deleteSemester(semester.id);
        }}
        title="Delete Semester"
        message={`Delete "${semester.name}" and all courses inside it? This cannot be undone.`}
        confirmLabel="Delete Semester"
        confirmVariant="danger"
      />

      <Modal isOpen={showEditSemester} onClose={() => setShowEditSemester(false)} title="Edit Semester">
        <form onSubmit={handleSaveSemester} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Semester</label>
              <select
                value={semesterForm.term}
                onChange={(e) => {
                  const term = e.target.value;
                  setSemesterForm((prev) => ({ ...prev, term, name: `${term} Semester ${prev.year}` }));
                }}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition bg-white"
              >
                {[semester.term, ...availableTerms]
                  .filter((value, index, arr) => arr.indexOf(value) === index)
                  .map((term) => (
                    <option key={term} value={term}>{term}</option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Year</label>
              <input
                type="number"
                required
                value={semesterForm.year}
                onChange={(e) => {
                  const year = e.target.value;
                  setSemesterForm((prev) => ({ ...prev, year, name: `${prev.term} Semester ${year}` }));
                }}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Semester Name</label>
            <input
              type="text"
              required
              value={semesterForm.name}
              onChange={(e) => setSemesterForm((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={semesterForm.is_current}
              onChange={(e) => setSemesterForm((prev) => ({ ...prev, is_current: e.target.checked }))}
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            Set as current semester
          </label>

          {semesterError && <p className="text-sm text-rose-600">{semesterError}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" type="button" onClick={() => setShowEditSemester(false)}>
              Cancel
            </Button>
            <Button size="sm" type="submit">
              Save Semester
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default SemesterSection;
