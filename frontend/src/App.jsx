import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import ProjectWizard from './pages/admin/ProjectWizard';
import AdminClients from './pages/admin/AdminClients';
import MapView from './pages/client/MapView';
import AnalyticsView from './pages/client/AnalyticsView';

// Layout shim for Client Portal
import { useState, useEffect } from 'react';
import api from './api/client';
import Navbar from './components/Navbar';

function ClientPortal() {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [activeView, setActiveView] = useState('map');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProjects() {
      try {
        const res = await api.get('/projects');
        setProjects(res.data.projects);
        if (res.data.projects.length > 0) {
          setSelectedProjectId(res.data.projects[0].id);
        }
      } catch (err) {
        console.error('Failed to fetch projects', err);
      } finally {
        setLoading(false);
      }
    }
    fetchProjects();
  }, []);

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

  if (projects.length === 0) {
    return (
      <div className="app-layout">
        <Navbar />
        <div className="empty-state">
          <div className="empty-state__icon">📂</div>
          <h2 className="empty-state__title">No Projects Found</h2>
          <p className="empty-state__text">You don't have any projects assigned yet. Please contact an administrator.</p>
        </div>
      </div>
    );
  }

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  return (
    <div className="app-layout">
      <Navbar
        projects={projects}
        selectedProjectId={selectedProjectId}
        onProjectChange={setSelectedProjectId}
        activeView={activeView}
        onViewChange={setActiveView}
        showViewToggle={!!selectedProjectId}
        showProjectSelector={true}
      />
      <main className="page-content page-content--full">
        {activeView === 'map' ? (
          <MapView project={selectedProject} />
        ) : (
          <AnalyticsView project={selectedProject} onLocateOnMap={() => setActiveView('map')} />
        )}
      </main>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          
          {/* Admin Routes */}
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin/projects/new" 
            element={
              <ProtectedRoute requiredRole="admin">
                <ProjectWizard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin/clients" 
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminClients />
              </ProtectedRoute>
            } 
          />

          {/* Client Routes */}
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <ClientPortal />
              </ProtectedRoute>
            } 
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
