import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Navbar({
  projects = [],
  selectedProjectId,
  onProjectChange,
  activeView,
  onViewChange,
  showViewToggle = false,
  showProjectSelector = false,
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleBrandClick = () => {
    if (user?.role === 'admin') {
      navigate('/admin');
    } else {
      navigate('/');
    }
  };

  const initials = user?.full_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '??';

  return (
    <nav className="navbar">
      <div className="navbar__brand" onClick={handleBrandClick}>
        <div className="navbar__brand-icon">🌳</div>
        <span>PlantView</span>
      </div>

      {user?.role === 'admin' && (
        <div className="navbar__nav">
          <button className="navbar__nav-link" onClick={() => navigate('/admin')}>Projects</button>
          <button className="navbar__nav-link" onClick={() => navigate('/admin/clients')}>Clients</button>
        </div>
      )}

      <div className="navbar__center">
        {showProjectSelector && projects.length > 0 && (
          <ProjectSelector
            projects={projects}
            selectedId={selectedProjectId}
            onChange={onProjectChange}
          />
        )}

        {showViewToggle && (
          <div className="view-toggle">
            <button
              className={`view-toggle__btn ${activeView === 'map' ? 'view-toggle__btn--active' : ''}`}
              onClick={() => onViewChange('map')}
            >
              🗺️ Map View
            </button>
            <button
              className={`view-toggle__btn ${activeView === 'analytics' ? 'view-toggle__btn--active' : ''}`}
              onClick={() => onViewChange('analytics')}
            >
              📊 Analytics View
            </button>
          </div>
        )}
      </div>

      <div className="navbar__right">
        <div className="user-menu">
          <div className="user-menu__avatar">{initials}</div>
          <div className="user-menu__info">
            <span className="user-menu__name">{user?.full_name}</span>
            <span className="user-menu__role">{user?.role}</span>
          </div>
        </div>
        <button className="btn btn--logout" onClick={handleLogout}>
          Log Out
        </button>
      </div>
    </nav>
  );
}

function ProjectSelector({ projects, selectedId, onChange }) {
  return (
    <div className="project-selector">
      <select
        className="project-selector__trigger"
        value={selectedId || ''}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="" disabled>Select Project</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </div>
  );
}
