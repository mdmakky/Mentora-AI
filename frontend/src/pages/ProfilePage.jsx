import { useState } from 'react';
import { User, Mail, GraduationCap, Building2, Camera, Lock, CheckCircle2, XCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import useAuthStore from '../stores/authStore';
import toast from 'react-hot-toast';
import { apiClient } from '../lib/apiClient';
import { getPasswordValidation } from '../utils/passwordValidation';

const ProfilePage = () => {
  const { user, updateProfile, getProfile } = useAuthStore();

  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    university: user?.university || '',
    department: user?.department || '',
  });
  const [saving, setSaving] = useState(false);

  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwSaving, setPwSaving] = useState(false);
  
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const passwordValidation = getPasswordValidation(pwForm.newPassword);

  const [avatarLoading, setAvatarLoading] = useState(false);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const result = await updateProfile(form);
    setSaving(false);
    if (result.success) {
      toast.success('Profile updated!');
      getProfile();
    } else {
      toast.error(result.error || 'Failed to update profile');
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (!passwordValidation.isValid) {
      toast.error('Please choose a stronger password that matches all security rules.');
      return;
    }
    setPwSaving(true);
    try {
      await apiClient.put('/auth/change-password', {
        current_password: pwForm.currentPassword,
        new_password: pwForm.newPassword,
      });
      toast.success('Password changed successfully!');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordTouched(false);
    } catch (err) {
      toast.error(err.message || 'Failed to change password');
    }
    setPwSaving(false);
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('File size must be under 5MB'); return; }

    setAvatarLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      await apiClient.postForm('/auth/avatar', formData);
      await getProfile();
      toast.success('Avatar updated!');
    } catch (err) {
      toast.error(err.message || 'Failed to upload avatar');
    }
    setAvatarLoading(false);
  };

  const initials = user?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'U';

  return (
    <div className="app-content animate-fade-in max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1">My Profile</h1>
        <p className="text-slate-500 text-sm">Manage your account information and settings.</p>
      </div>

      {/* Avatar section */}
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-4 sm:gap-5">
          <div className="relative">
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.full_name}
                className="w-20 h-20 rounded-full object-cover ring-4 ring-emerald-100"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-emerald-600 flex items-center justify-center text-white text-2xl font-bold ring-4 ring-emerald-100">
                {initials}
              </div>
            )}
            <label className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center cursor-pointer hover:bg-slate-50 transition shadow-sm">
              {avatarLoading ? <Loader2 size={13} className="animate-spin text-slate-400" /> : <Camera size={13} className="text-slate-600" />}
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </label>
          </div>
          <div>
            <p className="text-lg font-bold text-slate-900">{user?.full_name || 'User'}</p>
            <p className="text-sm text-slate-500 flex items-center gap-1.5">
              <Mail size={13} /> {user?.email}
            </p>
            <div className={`mt-1.5 inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
              user?.email_verified ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
            }`}>
              {user?.email_verified ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
              {user?.email_verified ? 'Verified' : 'Not verified'}
            </div>
          </div>
        </div>
      </div>

      {/* Edit info */}
      <div className="card p-6 mb-6">
        <h2 className="text-base font-bold text-slate-900 mb-5 flex items-center gap-2">
          <User size={16} className="text-emerald-600" /> Personal Information
        </h2>
        <form onSubmit={handleProfileSave} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Full Name</label>
            <input
              type="text"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition"
              placeholder="Your full name"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              <span className="flex items-center gap-1.5"><Building2 size={13} /> University</span>
            </label>
            <input
              type="text"
              value={form.university}
              onChange={(e) => setForm({ ...form, university: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition"
              placeholder="Your university"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              <span className="flex items-center gap-1.5"><GraduationCap size={13} /> Department</span>
            </label>
            <input
              type="text"
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition"
              placeholder="e.g. Computer Science"
            />
          </div>
          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition disabled:opacity-60"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : null}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Change password */}
      <div className="card p-6">
        <h2 className="text-base font-bold text-slate-900 mb-5 flex items-center gap-2">
          <Lock size={16} className="text-emerald-600" /> Change Password
        </h2>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Current Password</label>
            <div className="relative">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={pwForm.currentPassword}
                onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 pr-12 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition"
                placeholder="Your current password"
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
              >
                {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">New Password</label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={pwForm.newPassword}
                onChange={(e) => { setPwForm({ ...pwForm, newPassword: e.target.value }); setPasswordTouched(true); }}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 pr-12 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition"
                placeholder="Min. 8 characters"
                required
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
              >
                {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {passwordTouched && (
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 mb-2">Security rules</p>
                <ul className="space-y-1">
                  {passwordValidation.rules.map((rule) => (
                    <li key={rule.id} className={`flex items-center gap-2 text-xs ${rule.passed ? 'text-emerald-700' : 'text-slate-500'}`}>
                      {rule.passed
                        ? <CheckCircle2 size={12} className="flex-shrink-0 text-emerald-500" />
                        : <XCircle size={12} className="flex-shrink-0 text-slate-300" />}
                      {rule.label}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Confirm New Password</label>
             <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={pwForm.confirmPassword}
                onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })}
                className={`w-full rounded-xl border px-4 py-2.5 pr-12 text-sm outline-none transition focus:ring-4 ${
                   pwForm.confirmPassword && pwForm.newPassword !== pwForm.confirmPassword
                     ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100'
                     : pwForm.confirmPassword && pwForm.newPassword === pwForm.confirmPassword
                     ? 'border-emerald-400 focus:border-emerald-500 focus:ring-emerald-100'
                     : 'border-slate-200 focus:border-emerald-500 focus:ring-emerald-100'
                }`}
                placeholder="Repeat new password"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={pwSaving}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl transition disabled:opacity-60"
            >
              {pwSaving ? <Loader2 size={15} className="animate-spin" /> : null}
              {pwSaving ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfilePage;
