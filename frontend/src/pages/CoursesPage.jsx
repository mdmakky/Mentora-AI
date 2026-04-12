import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Search, LayoutGrid, List, Filter, GraduationCap } from 'lucide-react';
import useCourseStore from '../stores/courseStore';
import EmptyState from '../components/ui/EmptyState';
import Spinner from '../components/ui/Spinner';

const CoursesPage = () => {
  const navigate = useNavigate();
  const { semesters, courses, loading, fetchSemesters, fetchCourses } = useCourseStore();
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [filterSemester, setFilterSemester] = useState('all');

  useEffect(() => {
    fetchSemesters();
  }, [fetchSemesters]);

  // Fetch courses for all semesters
  useEffect(() => {
    semesters.forEach((sem) => {
      if (!courses[sem.id]) {
        fetchCourses(sem.id);
      }
    });
  }, [semesters, courses, fetchCourses]);

  // Flatten all courses with semester info
  const allCourses = semesters.flatMap((sem) =>
    (courses[sem.id] || []).map((c) => ({ ...c, semesterName: sem.name }))
  );

  // Filter
  const filtered = allCourses.filter((c) => {
    const matchesSearch =
      !search ||
      c.course_name.toLowerCase().includes(search.toLowerCase()) ||
      c.course_code.toLowerCase().includes(search.toLowerCase()) ||
      (c.instructor || '').toLowerCase().includes(search.toLowerCase());
    const matchesSemester =
      filterSemester === 'all' || c.semester_id === filterSemester;
    return matchesSearch && matchesSemester;
  });

  // Loading State - Handled in the render tree now
  return (
    <div className="app-content animate-fade-in">
      {/* Header */}
      <div className="mb-5 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1">My Courses</h1>
        <p className="text-slate-500 text-sm">All your courses across semesters in one place.</p>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search courses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <select
              value={filterSemester}
              onChange={(e) => setFilterSemester(e.target.value)}
              className="pl-8 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition bg-white appearance-none cursor-pointer"
            >
              <option value="all">All Semesters</option>
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1 ml-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`pdf-toolbar-btn ${viewMode === 'grid' ? 'active' : ''}`}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`pdf-toolbar-btn ${viewMode === 'list' ? 'active' : ''}`}
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Results count (hidden while totally empty loading) */}
      {!loading && (
        <p className="text-sm text-slate-500 mb-4">
          {filtered.length} course{filtered.length !== 1 && 's'}
          {search && ` matching "${search}"`}
        </p>
      )}

      {/* Course Grid/List */}
      {loading && semesters.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card overflow-hidden animate-pulse">
              <div className="h-2 bg-slate-200" />
              <div className="p-4 space-y-3">
                <div className="h-4 w-16 bg-slate-200 rounded" />
                <div className="h-5 w-3/4 bg-slate-200 rounded" />
                <div className="flex justify-between">
                  <div className="h-3 w-1/2 bg-slate-100 rounded" />
                  <div className="h-3 w-8 bg-slate-100 rounded" />
                </div>
                <div className="pt-2 border-t border-slate-100">
                  <div className="h-3 w-20 bg-slate-100 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={search ? 'No courses match your search' : 'No courses yet'}
          description={
            search
              ? 'Try adjusting your search or filter.'
              : 'Create a semester on the Dashboard and add courses to get started.'
          }
        />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {filtered.map((course, i) => (
            <div
              key={course.id}
              onClick={() => navigate(`/course/${course.id}`)}
              className="card card-interactive overflow-hidden group animate-slide-up"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="h-2" style={{ background: course.color }} />
              <div className="p-4">
                <span
                  className="inline-block text-xs font-bold px-2.5 py-1 rounded-lg mb-2"
                  style={{
                    background: course.color + '15',
                    color: course.color,
                  }}
                >
                  {course.course_code}
                </span>
                <h4 className="font-semibold text-slate-900 text-sm mb-2 leading-snug line-clamp-2 group-hover:text-emerald-700 transition">
                  {course.course_name}
                </h4>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="truncate">
                    {course.instructor || 'No instructor'}
                  </span>
                  {course.credit_hours && (
                    <span className="flex-shrink-0 ml-2">{course.credit_hours} cr</span>
                  )}
                </div>
                <div className="mt-2 pt-2 border-t border-slate-100">
                  <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <GraduationCap size={10} />
                    {course.semesterName}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((course, i) => (
            <div
              key={course.id}
              onClick={() => navigate(`/course/${course.id}`)}
              className="card card-interactive flex items-center gap-4 px-4 py-3 group animate-slide-up"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ background: course.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500">{course.course_code}</span>
                  <span className="text-slate-300">·</span>
                  <span className="text-sm font-semibold text-slate-900 truncate group-hover:text-emerald-700 transition">
                    {course.course_name}
                  </span>
                </div>
              </div>
              <span className="text-xs text-slate-400 flex-shrink-0 hidden sm:block">
                {course.semesterName}
              </span>
              {course.instructor && (
                <span className="text-xs text-slate-500 flex-shrink-0 hidden md:block">
                  {course.instructor}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CoursesPage;
