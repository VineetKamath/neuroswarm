import React, { useEffect, useState } from 'react';
import { UserPlus, Database, Users, FileText, ClipboardList, Cpu } from 'lucide-react';
import api from '../api/axios';
import { StaffModal } from '../components/forms';
import { PageHeader, StatCard, Avatar, Badge, Skeleton } from '../components/ui';

export function StaffPage() {
  const [stats, setStats] = useState(null);
  const [staff, setStaff] = useState(null);
  const [adding, setAdding] = useState(false);

  const load = () => {
    api.get('/staff/system-stats').then((r) => setStats(r.data)).catch(() => {});
    api.get('/staff').then((r) => setStaff(r.data)).catch(() => setStaff([]));
  };
  useEffect(load, []);

  const toggle = async (u) => { await api.put(`/staff/${u.id}`, { is_active: !u.is_active }); load(); };
  const ve = stats?.vector_engine;

  return (
    <div className="anim-up">
      <PageHeader eyebrow="Administration" title="Staff & system"
        actions={<button className="btn btn-primary" onClick={() => setAdding(true)}><UserPlus className="h-4 w-4" />Add staff</button>} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Patients" value={stats?.total_patients ?? '-'} icon={Users} loading={!stats} />
        <StatCard label="Clinical notes" value={stats?.total_clinical_notes ?? '-'} icon={FileText} tone="sky" loading={!stats} />
        <StatCard label="Open tasks" value={stats?.pending_care_tasks ?? '-'} icon={ClipboardList} tone="violet" loading={!stats} />
        <StatCard label="Indexed chunks" value={ve?.total_indexed_chunks ?? '-'} hint={ve ? `${ve.native_dim} → ${ve.active_dim} dims (Binary GA)` : ''} icon={Database} tone="emerald" loading={!stats} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="card overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4 text-sm font-bold text-slate-900">Accounts</div>
          {!staff ? <div className="p-5"><Skeleton className="h-40" /></div> : (
            <ul className="divide-y divide-slate-100">
              {staff.map((u) => (
                <li key={u.id} className="flex items-center gap-3 px-5 py-3">
                  <Avatar name={u.full_name} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-800">{u.full_name}</div>
                    <div className="truncate text-xs text-slate-500">{u.email} · {u.department}</div>
                  </div>
                  <Badge tone={u.role === 'ADMIN' ? 'dark' : u.role === 'DOCTOR' ? 'sky' : 'brand'}>{u.role}</Badge>
                  <button onClick={() => toggle(u)} className={u.is_active ? 'btn btn-outline btn-sm' : 'btn btn-primary btn-sm'}>
                    {u.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-900"><Cpu className="h-4 w-4 text-brand-600" />Retrieval engine</div>
          {!ve ? <Skeleton className="h-40" /> : (
            <dl className="space-y-3 text-xs">
              {[
                ['Embedding model', ve.embedding_model],
                ['Patients indexed', ve.total_indexed_patients],
                ['Chunks indexed', ve.total_indexed_chunks],
                ['Vector dimensions', `${ve.active_dim} of ${ve.native_dim}${ve.compression_active ? ' (evolved mask)' : ''}`],
                ['Searchable partitions', ve.partitions],
                ['Language model in loop', 'None, extractive'],
                ['RBAC', stats.rbac_enforcement],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-dashed border-slate-100 pb-2">
                  <dt className="text-slate-500">{k}</dt><dd className="text-right font-mono font-semibold text-slate-800">{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
      <StaffModal open={adding} onClose={() => setAdding(false)} onSaved={load} />
    </div>
  );
}
