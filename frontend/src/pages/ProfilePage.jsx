import { useEffect, useState } from 'react';
import {
  User,
  Mail,
  GraduationCap,
  Building2,
  Camera,
  Lock,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  Target,
  ShieldCheck,
  Clock3,
  BookMarked,
  KeyRound,
  Settings,
  BadgeCheck,
} from 'lucide-react';
import useAuthStore from '../stores/authStore';
import toast from 'react-hot-toast';
import { apiClient } from '../lib/apiClient';
import { getPasswordValidation } from '../utils/passwordValidation';

const GOAL_OPTIONS = [30, 60, 90, 120, 150, 180, 240, 300];

const formatDate = (iso) => (
  !iso
    ? '—'
    : new Date(iso).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
);

const formatGoal = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) return `${remainingMinutes}m`;
  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h ${remainingMinutes}m`;
};

const Field = ({ label, icon: Icon, children }) => (
  <div>
    <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
      {Icon ? <Icon size={12} className="text-slate-400" /> : null}
      {label}
    </label>
    {children}
  </div>
);

const TextInput = ({ label, icon, ...props }) => (
  <Field label={label} icon={icon}>
    <input
      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
      {...props}
    />
  </Field>
);

const PasswordInput = ({ label, value, onChange, show, setShow, borderClass, placeholder }) => (
  <Field label={label}>
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required
        className={`w-full rounded-xl border bg-white px-4 py-2.5 pr-10 text-sm outline-none transition placeholder:text-slate-300 focus:ring-4 ${borderClass || 'border-slate-200 focus:border-emerald-500 focus:ring-emerald-100'}`}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 transition hover:text-slate-500"
      >
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  </Field>
);

const StrengthList = ({ validation }) => (
  <div className="grid grid-cols-1 gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 sm:grid-cols-2">
    {validation.rules.map((rule) => (
      <span
        key={rule.id}
        className={`flex items-center gap-1.5 text-[11px] font-medium ${rule.passed ? 'text-emerald-600' : 'text-slate-400'}`}
      >
        {rule.passed ? <CheckCircle2 size={11} className="shrink-0" /> : <XCircle size={11} className="shrink-0 text-slate-300" />}
        {rule.label}
      </span>
    ))}
  </div>
);

const Chip = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-xl border px-4 py-2 text-xs font-semibold transition ${active ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-500 hover:border-emerald-300 hover:text-emerald-700'}`}
  >
    {children}
  </button>
);

const SidebarButton = ({ active, icon: Icon, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition ${active ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
  >
    <span
      className={`flex h-8 w-8 items-center justify-center rounded-lg ${active ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}
    >
      <Icon size={15} />
    </span>
    <span>{label}</span>
  </button>
);

const PanelHeader = ({ title, subtitle }) => (
  <div className="mb-6 border-b border-slate-100 pb-4">
    <h2 className="text-lg font-bold text-slate-900">{title}</h2>
    {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
  </div>
);

const ProfilePage = () => {
  const { user, updateProfile, getProfile } = useAuthStore();
  const isGoogleUser = !user?.password_hash;
  const initials = user?.full_name?.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'U';

  const [activePanel, setActivePanel] = useState('profile');
  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    university: user?.university || '',
    department: user?.department || '',
    current_semester: user?.current_semester ?? 1,
    study_goal_minutes: user?.study_goal_minutes ?? 120,
  });
  const [saving, setSaving] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);

  const [changePasswordForm, setChangePasswordForm] = useState({ current: '', next: '', confirm: '' });
  const [changePasswordSaving, setChangePasswordSaving] = useState(false);
  const [changePasswordTouched, setChangePasswordTouched] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState({ current: false, next: false, confirm: false });
  const changePasswordValidation = getPasswordValidation(changePasswordForm.next);

  const [setPasswordForm, setSetPasswordForm] = useState({ next: '', confirm: '' });
  const [setPasswordSaving, setSetPasswordSaving] = useState(false);
  const [setPasswordTouched, setSetPasswordTouched] = useState(false);
  const [showSetPassword, setShowSetPassword] = useState({ next: false, confirm: false });
  const setPasswordValidation = getPasswordValidation(setPasswordForm.next);

  useEffect(() => {
    if (!user) return;
    setForm({
      full_name: user.full_name || '',
      university: user.university || '',
      department: user.department || '',
      current_semester: user.current_semester ?? 1,
      study_goal_minutes: user.study_goal_minutes ?? 120,
    });
  }, [user]);

  const confirmBorder = (first, second) => {
    if (!second) return undefined;
    return first !== second
      ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100'
      : 'border-emerald-400 focus:border-emerald-500 focus:ring-emerald-100';
  };

  const handleProfileSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    const result = await updateProfile(form);
    setSaving(false);

    if (result.success) {
      toast.success('Profile updated!');
      getProfile();
      return;
    }

    toast.error(result.error || 'Failed to update profile');
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();

    if (changePasswordForm.next !== changePasswordForm.confirm) {
      toast.error('Passwords do not match');
      return;
    }

    if (!changePasswordValidation.isValid) {
      toast.error('Password is too weak');
      return;
    }

    setChangePasswordSaving(true);
    try {
      await apiClient.put('/auth/change-password', {
        current_password: changePasswordForm.current,
        new_password: changePasswordForm.next,
      });
      toast.success('Password updated!');
      setChangePasswordForm({ current: '', next: '', confirm: '' });
      setChangePasswordTouched(false);
    } catch (error) {
      toast.error(error.message || 'Failed');
    }
    setChangePasswordSaving(false);
  };

  const handleSetPassword = async (event) => {
    event.preventDefault();

    if (setPasswordForm.next !== setPasswordForm.confirm) {
      toast.error('Passwords do not match');
      return;
    }

    if (!setPasswordValidation.isValid) {
      toast.error('Password is too weak');
      return;
    }

    setSetPasswordSaving(true);
    try {
      await apiClient.post('/auth/set-password', { new_password: setPasswordForm.next });
      toast.success('Password added!');
      setSetPasswordForm({ next: '', confirm: '' });
      setSetPasswordTouched(false);
      getProfile();
    } catch (error) {
      toast.error(error.message || 'Failed');
    }
    setSetPasswordSaving(false);
  };

  const handleAvatarUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5 MB');
      return;
    }

    setAvatarLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await apiClient.postForm('/auth/avatar', formData);
      await getProfile();
      toast.success('Photo updated!');
    } catch (error) {
      toast.error(error.message || 'Upload failed');
    }
    setAvatarLoading(false);
  };

  return (
    <div className="app-content animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Account Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Manage your profile details and account security.</p>
      </div>

      <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <div className="grid min-h-170 grid-cols-1 lg:grid-cols-[260px_1fr]">
          <aside className="border-b border-slate-200 bg-slate-50/70 p-5 lg:border-b-0 lg:border-r">
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Settings</p>
              <h2 className="mt-2 text-lg font-bold text-slate-900">Your Workspace</h2>
              <p className="mt-1 text-sm text-slate-500">Switch between profile, security and account details.</p>
            </div>

            <div className="space-y-2">
              <SidebarButton
                active={activePanel === 'profile'}
                icon={User}
                label="Profile Settings"
                onClick={() => setActivePanel('profile')}
              />
              <SidebarButton
                active={activePanel === 'security'}
                icon={isGoogleUser ? KeyRound : Lock}
                label={isGoogleUser ? 'Add Password' : 'Password'}
                onClick={() => setActivePanel('security')}
              />
              <SidebarButton
                active={activePanel === 'account'}
                icon={Settings}
                label="Account Details"
                onClick={() => setActivePanel('account')}
              />
            </div>
          </aside>

          <section className="p-5 sm:p-7">
            {activePanel === 'profile' ? (
              <>
                <PanelHeader
                  title="Profile Settings"
                  subtitle="Update your personal details, academic information and study goal."
                />

                <div className="mb-8 flex flex-col gap-5 rounded-2xl border border-slate-200 bg-slate-50/40 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="relative shrink-0">
                      {user?.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt={user.full_name}
                          className="h-24 w-24 rounded-full object-cover ring-4 ring-white shadow-md"
                        />
                      ) : (
                        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-linear-to-br from-emerald-500 to-teal-600 font-['Sora'] text-3xl font-bold text-white ring-4 ring-white shadow-md">
                          {initials}
                        </div>
                      )}
                      <label className="absolute bottom-0 right-0 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-emerald-600 text-white shadow-md transition hover:bg-emerald-700">
                        {avatarLoading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                        <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                      </label>
                    </div>

                    <div>
                      <h3 className="text-lg font-bold text-slate-900">{user?.full_name || 'My Profile'}</h3>
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                        <Mail size={13} className="text-slate-400" />
                        {user?.email}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold ${user?.email_verified ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                          {user?.email_verified ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                          {user?.email_verified ? 'Verified' : 'Unverified'}
                        </span>
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-medium ${isGoogleUser ? 'border-blue-200 bg-blue-50 text-blue-600' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                          {isGoogleUser ? 'Google account' : 'Email account'}
                        </span>
                        {user?.is_admin ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-700">
                            <ShieldCheck size={10} />
                            Admin
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Member Since</p>
                    <p className="mt-1 font-medium text-slate-700">{formatDate(user?.created_at)}</p>
                  </div>
                </div>

                <form onSubmit={handleProfileSave} className="space-y-5">
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <TextInput
                        label="Full Name"
                        placeholder="Your full name"
                        value={form.full_name}
                        onChange={(event) => setForm({ ...form, full_name: event.target.value })}
                      />
                    </div>

                    <TextInput
                      label="University"
                      icon={Building2}
                      placeholder="e.g. JUST"
                      value={form.university}
                      onChange={(event) => setForm({ ...form, university: event.target.value })}
                    />

                    <TextInput
                      label="Department"
                      icon={GraduationCap}
                      placeholder="e.g. Computer Science"
                      value={form.department}
                      onChange={(event) => setForm({ ...form, department: event.target.value })}
                    />
                  </div>

                  <Field label="Current Semester" icon={BookMarked}>
                    <div className="flex flex-wrap gap-2">
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((semester) => (
                        <Chip
                          key={semester}
                          active={form.current_semester === semester}
                          onClick={() => setForm({ ...form, current_semester: semester })}
                        >
                          Semester {semester}
                        </Chip>
                      ))}
                    </div>
                  </Field>

                  <Field label="Daily Study Goal" icon={Target}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="text-xs text-slate-400">This appears on your analytics progress bar.</span>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-600">
                        {formatGoal(form.study_goal_minutes)} / day
                      </span>
                    </div>

                    <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-linear-to-r from-emerald-400 to-emerald-600 transition-all duration-300"
                        style={{ width: `${Math.min((form.study_goal_minutes / 300) * 100, 100)}%` }}
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {GOAL_OPTIONS.map((minutes) => (
                        <Chip
                          key={minutes}
                          active={form.study_goal_minutes === minutes}
                          onClick={() => setForm({ ...form, study_goal_minutes: minutes })}
                        >
                          {formatGoal(minutes)}
                        </Chip>
                      ))}
                    </div>
                  </Field>

                  <div className="flex justify-end border-t border-slate-100 pt-5">
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                      {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </>
            ) : null}

            {activePanel === 'security' ? (
              isGoogleUser ? (
                <>
                  <PanelHeader
                    title="Add Password"
                    subtitle="Set a password so you can sign in with email in addition to Google."
                  />

                  <form onSubmit={handleSetPassword} className="max-w-2xl space-y-4">
                    <PasswordInput
                      label="New Password"
                      value={setPasswordForm.next}
                      onChange={(event) => {
                        setSetPasswordForm({ ...setPasswordForm, next: event.target.value });
                        setSetPasswordTouched(true);
                      }}
                      show={showSetPassword.next}
                      setShow={(value) => setShowSetPassword({ ...showSetPassword, next: value })}
                      placeholder="Minimum 8 characters"
                    />

                    {setPasswordTouched ? <StrengthList validation={setPasswordValidation} /> : null}

                    <PasswordInput
                      label="Confirm Password"
                      value={setPasswordForm.confirm}
                      onChange={(event) => setSetPasswordForm({ ...setPasswordForm, confirm: event.target.value })}
                      show={showSetPassword.confirm}
                      setShow={(value) => setShowSetPassword({ ...showSetPassword, confirm: value })}
                      placeholder="Repeat password"
                      borderClass={confirmBorder(setPasswordForm.next, setPasswordForm.confirm)}
                    />

                    <div className="flex justify-end border-t border-slate-100 pt-5">
                      <button
                        type="submit"
                        disabled={setPasswordSaving}
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                      >
                        {setPasswordSaving ? <Loader2 size={14} className="animate-spin" /> : null}
                        {setPasswordSaving ? 'Setting…' : 'Set Password'}
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <>
                  <PanelHeader
                    title="Password"
                    subtitle="Use a strong password you do not reuse elsewhere."
                  />

                  <form onSubmit={handleChangePassword} className="max-w-2xl space-y-4">
                    <PasswordInput
                      label="Current Password"
                      value={changePasswordForm.current}
                      onChange={(event) => setChangePasswordForm({ ...changePasswordForm, current: event.target.value })}
                      show={showChangePassword.current}
                      setShow={(value) => setShowChangePassword({ ...showChangePassword, current: value })}
                      placeholder="Your current password"
                    />

                    <PasswordInput
                      label="New Password"
                      value={changePasswordForm.next}
                      onChange={(event) => {
                        setChangePasswordForm({ ...changePasswordForm, next: event.target.value });
                        setChangePasswordTouched(true);
                      }}
                      show={showChangePassword.next}
                      setShow={(value) => setShowChangePassword({ ...showChangePassword, next: value })}
                      placeholder="Minimum 8 characters"
                    />

                    {changePasswordTouched ? <StrengthList validation={changePasswordValidation} /> : null}

                    <PasswordInput
                      label="Confirm New Password"
                      value={changePasswordForm.confirm}
                      onChange={(event) => setChangePasswordForm({ ...changePasswordForm, confirm: event.target.value })}
                      show={showChangePassword.confirm}
                      setShow={(value) => setShowChangePassword({ ...showChangePassword, confirm: value })}
                      placeholder="Repeat new password"
                      borderClass={confirmBorder(changePasswordForm.next, changePasswordForm.confirm)}
                    />

                    <div className="flex items-center justify-between border-t border-slate-100 pt-5">
                      <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
                        <Clock3 size={11} />
                        Takes effect immediately.
                      </p>
                      <button
                        type="submit"
                        disabled={changePasswordSaving}
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                      >
                        {changePasswordSaving ? <Loader2 size={14} className="animate-spin" /> : null}
                        {changePasswordSaving ? 'Updating…' : 'Update Password'}
                      </button>
                    </div>
                  </form>
                </>
              )
            ) : null}

            {activePanel === 'account' ? (
              <>
                <PanelHeader
                  title="Account Details"
                  subtitle="Reference information about your account and sign-in method."
                />

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Email</p>
                    <p className="mt-2 text-sm font-medium text-slate-800">{user?.email || '—'}</p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Sign-in Method</p>
                    <p className="mt-2 text-sm font-medium text-slate-800">{isGoogleUser ? 'Google' : 'Email & Password'}</p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Verification</p>
                    <p className="mt-2 flex items-center gap-2 text-sm font-medium text-slate-800">
                      {user?.email_verified ? <BadgeCheck size={16} className="text-emerald-600" /> : <XCircle size={16} className="text-amber-600" />}
                      {user?.email_verified ? 'Verified' : 'Not verified'}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Created</p>
                    <p className="mt-2 text-sm font-medium text-slate-800">{formatDate(user?.created_at)}</p>
                  </div>
                </div>
              </>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
