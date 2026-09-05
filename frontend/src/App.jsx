import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { LoginPage } from './pages/LoginPage';
import { AdminDashboard } from './pages/AdminDashboard';
import { DoctorDashboard } from './pages/DoctorDashboard';
import { NurseDashboard } from './pages/NurseDashboard';
import { PatientListPage } from './pages/PatientListPage';
import { PatientDetailPage } from './pages/PatientDetailPage';
import { TasksPage } from './pages/TasksPage';

export default function App() {
  const { isAuthenticated, role, login } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedPatientId, setSelectedPatientId] = useState(null);

  const handleRoleDemoSwitch = async (email, password) => {
    try {
      await login(email, password);
      setSelectedPatientId(null);
      setActiveTab('dashboard');
    } catch (err) {
      console.error('Demo switch failed:', err);
    }
  };

  const handleNavigateToPatient = (patientId) => {
    setSelectedPatientId(patientId);
  };

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const renderContent = () => {
    if (selectedPatientId) {
      return (
        <PatientDetailPage
          patientId={selectedPatientId}
          onBack={() => setSelectedPatientId(null)}
        />
      );
    }

    if (activeTab === 'patients') {
      return <PatientListPage onSelectPatient={handleNavigateToPatient} />;
    }

    if (activeTab === 'tasks') {
      return <TasksPage />;
    }

    switch (role) {
      case 'ADMIN':
        return <AdminDashboard onNavigateToPatient={handleNavigateToPatient} />;
      case 'DOCTOR':
        return <DoctorDashboard onNavigateToPatient={handleNavigateToPatient} />;
      case 'NURSE':
        return <NurseDashboard onNavigateToPatient={handleNavigateToPatient} />;
      default:
        return <DoctorDashboard onNavigateToPatient={handleNavigateToPatient} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar onSelectRoleDemo={handleRoleDemoSwitch} />
      <div className="flex-1 flex">
        <Sidebar activeTab={selectedPatientId ? 'patients' : activeTab} setActiveTab={(tab) => { setSelectedPatientId(null); setActiveTab(tab); }} />
        <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
