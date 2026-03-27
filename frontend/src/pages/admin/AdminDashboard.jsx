import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import Navbar from '../../components/Navbar';
import ConfirmModal from '../../components/ConfirmModal';

export default function AdminDashboard() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({ total: 0, processing: 0, ready: 0 });
  
  // Custom Modal State
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    title: '',
    message: '',
    confirmLabel: 'OK',
    cancelLabel: '',
    type: 'info',
    onConfirm: () => {},
    onCancel: () => setConfirmModal(prev => ({ ...prev, show: false }))
  });

  const navigate = useNavigate();

  const fetchProjects = async () => {
    try {
      const res = await api.get('/projects');
      setProjects(res.data.projects);
      
      const stats = res.data.projects.reduce((acc, p) => {
        acc.total++;
        if (p.status === 'processing') acc.processing++;
        if (p.status === 'ready') acc.ready++;
        return acc;
      }, { total: 0, processing: 0, ready: 0 });
      
      setMetrics(stats);
    } catch (err) {
      console.error('Failed to fetch projects', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
    const interval = setInterval(fetchProjects, 10000); // Polling every 10s for status updates
    return () => clearInterval(interval);
  }, []);

  const getStatusBadge = (status) => {
    const labels = {
      'created': 'Created',
      'unassigned': 'Not Assigned',
      'uploading': 'Uploading',
      'processing': 'Processing',
      'ready': 'Ready',
      'error': 'Error'
    };
    return (
      <span className={`badge badge--${status}`}>
        {status === 'processing' && <span className="badge__dot" />}
        {labels[status] || status}
      </span>
    );
  };

  const showConfirm = (title, message, onConfirm, type = 'warning') => {
    setConfirmModal({
      show: true,
      title,
      message,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      type,
      onConfirm: () => {
        onConfirm();
        setConfirmModal(prev => ({ ...prev, show: false }));
      },
      onCancel: () => setConfirmModal(prev => ({ ...prev, show: false }))
    });
  };

  const handleDeleteProject = (projectId) => {
    showConfirm(
      'Delete Project',
      'Are you sure you want to delete this project? This will permanently remove all data and tiles.',
      async () => {
        try {
          await api.delete(`/projects/${projectId}`);
          fetchProjects();
        } catch (err) {
          console.error('Failed to delete project', err);
        }
      },
      'danger'
    );
  };

  return (
    <div className="app-layout">
      <Navbar />
      
      <main className="page-content">
        <div className="admin-header">
          <div>
            <h1>Admin Dashboard</h1>
            <p style={{ color: 'var(--text-muted)' }}>Manage your plantation projects and data processing.</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              className="btn btn--secondary" 
              onClick={() => navigate('/admin/clients')}
            >
              👥 Manage Clients
            </button>
            <button 
              className="btn btn--primary" 
              onClick={() => navigate('/admin/projects/new')}
            >
              ➕ Create New Project
            </button>
          </div>
        </div>

        <div className="kpi-grid">
          <div className="kpi-card kpi-card--blue">
            <div className="kpi-card__label">Total Projects</div>
            <div className="kpi-card__value">{metrics.total}</div>
            <div className="kpi-card__sub">Active in system</div>
          </div>
          <div className="kpi-card kpi-card--yellow">
            <div className="kpi-card__label">Processing Jobs</div>
            <div className="kpi-card__value">{metrics.processing}</div>
            <div className="kpi-card__sub">Background tasks</div>
          </div>
          <div className="kpi-card kpi-card--green">
            <div className="kpi-card__label">Ready Projects</div>
            <div className="kpi-card__value">{metrics.ready}</div>
            <div className="kpi-card__sub">Available to clients</div>
          </div>
          <div className="kpi-card kpi-card--purple">
            <div className="kpi-card__label">System Status</div>
            <div className="kpi-card__value">Healthy</div>
            <div className="kpi-card__sub">All services online</div>
          </div>
        </div>

        <div className="card">
          <div className="card__header">
            <h2 className="card__title">Project List</h2>
          </div>
          
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Project Name</th>
                  <th>Location</th>
                  <th>Assigned Client</th>
                  <th>Status</th>
                  <th>Upload Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && projects.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>Loading projects...</td>
                  </tr>
                ) : projects.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>No projects found. Create one to get started.</td>
                  </tr>
                ) : (
                  projects.map((project) => (
                    <tr key={project.id}>
                      <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{project.name}</td>
                      <td>{project.location || '—'}</td>
                      <td>{project.client_name || 'Unassigned'}</td>
                      <td>{getStatusBadge(project.status)}</td>
                      <td>{new Date(project.created_at).toLocaleDateString()}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            className="btn btn--secondary btn--sm"
                            onClick={() => navigate('/')}
                          >
                            View
                          </button>
                          <button 
                            className="btn btn--secondary btn--sm"
                            onClick={() => handleDeleteProject(project.id)}
                            style={{ color: '#ef4444' }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Custom Confirmation Modal */}
      <ConfirmModal {...confirmModal} />
    </div>
  );
}
