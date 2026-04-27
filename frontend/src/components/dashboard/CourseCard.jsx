import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, User, Pencil, Trash2 } from 'lucide-react';
import useCourseStore from '../../stores/courseStore';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import ConfirmDialog from '../ui/ConfirmDialog';

const CourseCard = ({ course, onUpdated }) => {
  const navigate = useNavigate();
  const updateCourse = useCourseStore((s) => s.updateCourse);
  const deleteCourse = useCourseStore((s) => s.deleteCourse);
  const [showEdit, setShowEdit] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    course_code: course.course_code || '',
    course_name: course.course_name || '',
    instructor: course.instructor || '',
    credit_hours: course.credit_hours ?? 3,
    color: course.color || '#2563EB',
  });

  const handleEditSubmit = (e) => {
    e.preventDefault();
    setError('');
    // Close modal immediately — store update is optimistic
    setShowEdit(false);
    updateCourse(
      course.id,
      {
        course_code: form.course_code.trim(),
        course_name: form.course_name.trim(),
        instructor: form.instructor.trim() || null,
        credit_hours: Number(form.credit_hours),
        color: form.color,
      },
      course.semester_id
    ).then((result) => {
      if (!result.success) {
        setError(result.error || 'Failed to update course');
        setShowEdit(true);
      }
    });
  };

  const handleDelete = () => {
    setShowDeleteConfirm(false);
    deleteCourse(course.id, course.semester_id);
  };

  return (
    <>
    <div
      className="card card-interactive overflow-hidden group relative"
      onClick={() => navigate(`/course/${course.id}`)}
    >
      <div
        className="absolute top-2 right-2 flex items-center gap-1"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => setShowEdit(true)}
          className="w-7 h-7 rounded-lg bg-white/90 border border-slate-200 text-slate-500 hover:text-emerald-600 hover:border-emerald-200 transition flex items-center justify-center"
          title="Edit course"
        >
          <Pencil size={13} />
        </button>
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          className="w-7 h-7 rounded-lg bg-white/90 border border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-200 transition flex items-center justify-center"
          title="Delete course"
        >
          <Trash2 size={13} />
        </button>
      </div>
      {/* Color bar */}
      <div className="h-2" style={{ background: course.color }} />

      <div className="p-3.5 sm:p-4">
        {/* Course code badge */}
        <span
          className="inline-block text-xs font-bold px-2.5 py-1 rounded-lg mb-3"
          style={{
            background: course.color + '15',
            color: course.color,
          }}
        >
          {course.course_code}
        </span>

        {/* Course name */}
        <h4 className="font-semibold text-slate-900 text-sm mb-2 leading-snug line-clamp-2 group-hover:text-emerald-700 transition">
          {course.course_name}
        </h4>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-slate-500">
          {course.instructor && (
            <span className="flex items-center gap-1 min-w-0">
              <User size={12} />
              <span className="truncate max-w-35">{course.instructor}</span>
            </span>
          )}
          {course.credit_hours && (
            <span className="flex items-center gap-1">
              <FileText size={12} />
              {course.credit_hours} cr
            </span>
          )}
        </div>
      </div>
    </div>

    <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title="Edit Course">
      <form onSubmit={handleEditSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Course Code</label>
            <input
              type="text"
              required
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
              min="0.5"
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
            value={form.course_name}
            onChange={(e) => setForm({ ...form, course_name: e.target.value })}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Instructor</label>
          <input
            type="text"
            value={form.instructor}
            onChange={(e) => setForm({ ...form, instructor: e.target.value })}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Color</label>
          <input
            type="color"
            value={form.color}
            onChange={(e) => setForm({ ...form, color: e.target.value })}
            className="w-12 h-9 rounded border border-slate-200"
          />
        </div>

        {error && <p className="text-sm text-rose-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" type="button" onClick={() => setShowEdit(false)}>
            Cancel
          </Button>
          <Button size="sm" type="submit">
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>

    <ConfirmDialog
      isOpen={showDeleteConfirm}
      onClose={() => setShowDeleteConfirm(false)}
      onConfirm={handleDelete}
      title="Delete Course"
      message={`Are you sure you want to delete "${course.course_name}"? All documents and data inside this course will be permanently removed.`}
      confirmLabel="Delete Course"
      confirmVariant="danger"
    />
    </>
  );
};

export default CourseCard;
