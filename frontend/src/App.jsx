import React, { Suspense, lazy } from 'react';
import { useAuth } from './context/AuthContext';
import { useRoute } from './lib/router';
import { Shell } from './components/Shell';
import { Spinner } from './components/ui';
import { LoginPage } from './pages/LoginPage';
import { Dashboard } from './pages/Dashboard';
import { PatientsPage } from './pages/PatientsPage';
import { PatientDetailPage } from './pages/PatientDetailPage';
import { TasksPage } from './pages/TasksPage';
import { StaffPage } from './pages/StaffPage';
const BioLabPage = lazy(() => import('./pages/BioLabPage').then((m) => ({ default: m.BioLabPage })));

export default function App() {
  const { isAuthenticated, loading, role } = useAuth();
  const [section, param] = useRoute();

  if (loading) {
    return <div className="flex h-full items-center justify-center text-slate-400"><Spinner className="h-6 w-6" /></div>;
  }
  if (!isAuthenticated) return <LoginPage />;

  let page;
  let active = section;
  switch (section) {
    case 'patients':
      page = param ? <PatientDetailPage patientId={param} /> : <PatientsPage />;
      break;
    case 'tasks': page = <TasksPage />; break;
    case 'biolab':
      page = (
        <Suspense fallback={<div className="flex h-96 items-center justify-center text-slate-400"><Spinner className="h-6 w-6" /></div>}>
          <BioLabPage chapter={param} />
        </Suspense>
      );
      break;
    case 'staff': page = role === 'ADMIN' ? <StaffPage /> : <Dashboard />; break;
    default: page = <Dashboard />; active = 'dashboard';
  }

  return <Shell active={active} wide={section === 'biolab'} routeKey={section === 'biolab' ? 'biolab' : `${section}/${param || ''}`}>{page}</Shell>;
}
