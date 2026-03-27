import { useState, useEffect } from 'react';
import api from '../../api/client';
import Navbar from '../../components/Navbar';
import MapView from './MapView';
import AnalyticsView from './AnalyticsView';

export default function ClientDashboard() {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [activeView, setActiveView] = useState('map');
  const [loading, setLoading] = useState(true);

  const fetchProjects = async () => {
    try {
      const res = await api.get('/projects');
      setProjects(res.data.projects);
      // Don't auto-select if we want to show the grid first
    } catch (err) {
      console.error('Failed to fetch projects', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
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

  if (!selectedProjectId) {
    return (
      <div className="app-layout">
        <Navbar />
        <main className="page-content">
          <div className="admin-header">
            <div>
              <h1>My Projects</h1>
              <p style={{ color: 'var(--text-muted)' }}>Select a project to view its map and analytics.</p>
            </div>
          </div>

          <div className="project-grid">
            {projects.map((project) => (
              <div key={project.id} className="project-card">
                <div className="project-card__thumbnail">
                  {project.thumbnail_url ? (
                    <img src={project.thumbnail_url} alt={project.name} />
                  ) : (
                    <div className="project-card__placeholder">🗺️</div>
                  )}
                  <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 10 }}>
                    <div className="badge badge--ready">
                       Ready
                    </div>
                  </div>
                </div>
                <div className="project-card__content">
                  <h3 className="project-card__title">{project.name}</h3>
                  <div className="project-card__date">
                    {project.location || 'Unknown Location'} • {new Date(project.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                  <p className="project-card__desc">
                    {project.description || 'View your plantation health and tree inventory data.'}
                  </p>
                  <div className="project-card__footer">
                    <button 
                      className="btn btn--primary" 
                      style={{ flex: 1 }}
                      onClick={() => setSelectedProjectId(project.id)}
                    >
                      Open
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

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
        onBackToDashboard={() => setSelectedProjectId(null)}
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
