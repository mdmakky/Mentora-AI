import { useState } from 'react';
import { User, Mail, GraduationCap, Building2, Camera, Lock, CheckCircle, Loader2 } from 'lucide-react';
import useAuthStore from '../stores/authStore';
import toast from 'react-hot-toast';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_AUTH_API_BASE || '/api/v1/auth';

const ProfilePage = () => {
  const { user, updateProfile, getProfile } = useAuthStore();

  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    university: user?.university || '',
    department: user?.department || '',
  });
  const [saving, setSaving] = useState(false);

  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);

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
    if (pwForm.next !== pwForm.confirm) {
      toast.error('Passwords do not match');
      return;
    }
    if (pwForm.next.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setPwSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_BASE}/change-password`, {
        current_password: pwForm.current,
        new_password: pwForm.next,
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Password changed successfully!');
      setPwForm({ current: '', next: '', confirm: '' });
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to change password');
    }
    setPwSaving(false);
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }

    setAvatarLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE}/avatar`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      });
      await getProfile();
      toast.success('Avatar updated!');
    } catch (err) {
      toast.error('Failed to upload avatar');
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
              <CheckCircle size={11} />
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
            <input
              type="password"
              value={pwForm.current}
              onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition"
              placeholder="Your current password"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">New Password</label>
            <input
              type="password"
              value={pwForm.next}
              onChange={(e) => setPwForm({ ...pwForm, next: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition"
              placeholder="Min. 8 characters"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Confirm New Password</label>
            <input
              type="password"
              value={pwForm.confirm}
              onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition"
              placeholder="Repeat new password"
              required
            />
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
