import { useNavigate } from 'react-router-dom';
import { FileText, User } from 'lucide-react';

const CourseCard = ({ course }) => {
  const navigate = useNavigate();

  return (
    <div
      className="card card-interactive overflow-hidden group"
      onClick={() => navigate(`/course/${course.id}`)}
    >
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
  );
};

export default CourseCard;
