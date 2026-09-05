import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Activity, Shield, Stethoscope, HeartPulse, Lock, Mail, ArrowRight, AlertCircle } from 'lucide-react';

export const LoginPage = () => {
  const { login, sessionExpired } = useAuth();
  const [email, setEmail] = useState('admin@medimind.org');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const demoAccounts = [
    {
      role: 'Hospital Admin',
      email: 'admin@medimind.org',
      password: 'password123',
      name: 'Dr. Arthur Hastings',
      icon: Shield,
    },
    {
      role: 'Physician / Doctor',
      email: 'dr.chen@medimind.org',
      password: 'password123',
      name: 'Dr. Melinda Chen, MD',
      icon: Stethoscope,
    },
    {
      role: 'Nursing Staff',
      email: 'nurse.sarah@medimind.org',
      password: 'password123',
      name: 'Sarah Jenkins, RN',
      icon: HeartPulse,
    },
  ];

  const handleSelectDemo = (acc) => {
    setEmail(acc.email);
    setPassword(acc.password);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await login(email, password);
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-sky-600 text-white shadow-md mb-4">
          <Activity className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">MediMind Clinical Portal</h2>
        <p className="mt-1 text-sm text-slate-500">
          Role-Secured EHR & Patient-Scoped Clinical RAG Assistant
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 rounded-2xl sm:px-10">
          {sessionExpired && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              Your session has expired. Please sign in again to continue.
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              {error}
            </div>
          )}

          <div className="mb-6">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Quick Demo Role Sign-In:
            </label>
            <div className="grid grid-cols-3 gap-2">
              {demoAccounts.map((acc, idx) => {
                const Icon = acc.icon;
                const isSelected = email === acc.email;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectDemo(acc)}
                    className={"p-2.5 rounded-xl border text-left transition flex flex-col items-center text-center " + (isSelected ? "border-sky-500 bg-sky-50 ring-2 ring-sky-500/20" : "border-slate-200 bg-slate-50 hover:bg-slate-100")}
                  >
                    <Icon className="w-4 h-4 text-slate-700 mb-1" />
                    <span className="text-[11px] font-bold text-slate-900 leading-tight">{acc.role.split('/')[0]}</span>
                    <span className="text-[10px] text-slate-500 truncate w-full mt-0.5">{acc.name.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Hospital Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@medimind.org"
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl text-sm transition shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Sign In to Clinical Portal'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        <div className="mt-4 text-center text-xs text-slate-400">
          Protected Health Information System • Strictly Audited & Encrypted
        </div>
      </div>
    </div>
  );
};
