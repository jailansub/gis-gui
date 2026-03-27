import { useState, useEffect } from 'react';
import api from '../../api/client';
import Navbar from '../../components/Navbar';

export default function AdminClients() {
  const [clients, setClients] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    full_name: '',
    role: 'client'
  });
  const [error, setError] = useState(null);

  const fetchClients = async () => {
    try {
      const res = await api.get('/users/clients');
      setClients(res.data);
    } catch (err) {
      console.error('Failed to fetch clients', err);
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await api.get('/projects');
      setAllProjects(res.data.projects);
    } catch (err) {
      console.error('Failed to fetch projects', err);
    }
  };

  const loadData = async () => {
    setLoading(true);
    await Promise.all([fetchClients(), fetchProjects()]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddClient = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/users', formData);
      setShowAddModal(false);
      setFormData({ username: '', password: '', full_name: '', role: 'client' });
      fetchClients();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to add client');
    }
  };

  const handleEditOpen = (client) => {
    setEditingClient(client);
    setFormData({
      username: client.username,
      password: '', // Leave empty for no change
      full_name: client.full_name,
      role: client.role
    });
    setError(null);
    setShowEditModal(true);
  };

  const handleUpdateClient = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const updateData = { ...formData };
      if (!updateData.password) delete updateData.password;
      
      await api.put(`/users/${editingClient.id}`, updateData);
      setShowEditModal(false);
      fetchClients();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update client');
    }
  };

  const handleDeleteClient = async (clientId) => {
    if (!window.confirm('Are you sure you want to delete this client? All their assigned projects will become unassigned.')) {
      return;
    }

    try {
      await api.delete(`/users/${clientId}`);
      fetchClients();
      fetchProjects();
    } catch (err) {
      alert('Failed to delete client');
    }
  };

  const toggleProjectAssignment = async (projectId, clientId) => {
    try {
      await api.put(`/projects/${projectId}`, { client_id: clientId });
      fetchProjects();
      fetchClients();
    } catch (err) {
      alert('Failed to update project assignment');
    }
  };

  return (
    <div className="app-layout">
      <Navbar />
      
      <main className="page-content">
        <div className="admin-header">
          <div>
            <h1>Client Management</h1>
            <p style={{ color: 'var(--text-muted)' }}>Create and manage client accounts and their access.</p>
          </div>
          <button 
            className="btn btn--primary" 
            onClick={() => setShowAddModal(true)}
          >
            ➕ Add New Client
          </button>
        </div>

        <div className="card">
          <div className="card__header">
            <h2 className="card__title">Client list</h2>
          </div>
          
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Full Name</th>
                  <th>Username</th>
                  <th>Assigned Projects</th>
                  <th>Join Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>Loading clients...</td>
                  </tr>
                ) : clients.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>No clients found.</td>
                  </tr>
                ) : (
                  clients.map((client) => (
                    <tr key={client.id}>
                      <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{client.full_name}</td>
                      <td>{client.username}</td>
                      <td>
                        <span className={`badge ${client.project_count > 0 ? 'badge--ready' : 'badge--created'}`}>
                          {client.project_count} Projects
                        </span>
                      </td>
                      <td>{new Date(client.created_at).toLocaleDateString()}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button 
                            className="btn btn--secondary btn--sm"
                            onClick={() => handleEditOpen(client)}
                          >
                            Edit
                          </button>
                          <button 
                            className="btn btn--secondary btn--sm"
                            onClick={() => handleDeleteClient(client.id)}
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

      {/* Add Client Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Add New Client</h2>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleAddClient} className="wizard-form">
              {error && <div className="error-message" style={{ marginBottom: '1rem' }}>{error}</div>}
              
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  required 
                  value={formData.full_name}
                  onChange={e => setFormData({...formData, full_name: e.target.value})}
                  placeholder="e.g. John Doe"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Username</label>
                <input 
                  type="text" 
                  className="form-input" 
                  required 
                  value={formData.username}
                  onChange={e => setFormData({...formData, username: e.target.value})}
                  placeholder="johndoe123"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <input 
                  type="password" 
                  className="form-input" 
                  required 
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  placeholder="Minimum 6 characters"
                />
              </div>

              <div className="wizard-actions" style={{ marginTop: '1.5rem' }}>
                <button type="button" className="btn btn--secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn--primary">Create Account</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Client Modal */}
      {showEditModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '800px', width: '90%' }}>
            <div className="modal-header">
              <h2 className="modal-title">Edit Client: {editingClient?.full_name}</h2>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>&times;</button>
            </div>
            
            <div className="edit-modal-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              {/* Profile Details */}
              <div>
                <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Account Details</h3>
                <form onSubmit={handleUpdateClient} className="wizard-form">
                  {error && <div className="error-message" style={{ marginBottom: '1rem' }}>{error}</div>}
                  
                  <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      required 
                      value={formData.full_name}
                      onChange={e => setFormData({...formData, full_name: e.target.value})}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Username</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      required 
                      value={formData.username}
                      onChange={e => setFormData({...formData, username: e.target.value})}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">New Password (leave blank to keep current)</label>
                    <input 
                      type="password" 
                      className="form-input" 
                      value={formData.password}
                      onChange={e => setFormData({...formData, password: e.target.value})}
                      placeholder="Minimum 6 characters"
                    />
                  </div>

                  <div className="wizard-actions" style={{ marginTop: '1.5rem' }}>
                    <button type="submit" className="btn btn--primary">Save Changes</button>
                  </div>
                </form>
              </div>

              {/* Project Assignment */}
              <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '2rem' }}>
                <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Project Assignments</h3>
                
                <div className="assigned-projects-list" style={{ marginBottom: '2rem' }}>
                  <label className="form-label">Currently Assigned</label>
                  {allProjects.filter(p => p.client_id === editingClient.id).length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>No projects assigned.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {allProjects.filter(p => p.client_id === editingClient.id).map(p => (
                        <div key={p.id} className="project-assignment-item" style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          padding: '0.5rem 0.75rem',
                          background: 'rgba(255,255,255,0.05)',
                          borderRadius: '6px'
                        }}>
                          <span style={{ fontSize: '0.9rem' }}>{p.name}</span>
                          <button 
                            className="btn btn--secondary btn--sm" 
                            style={{ color: '#ef4444', padding: '2px 8px' }}
                            onClick={() => toggleProjectAssignment(p.id, null)}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="available-projects">
                  <label className="form-label">Assign New Project</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {allProjects.filter(p => p.client_id !== editingClient.id).length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No other projects available.</p>
                    ) : (
                      <select 
                        className="form-input"
                        onChange={(e) => {
                          if (e.target.value) {
                            toggleProjectAssignment(e.target.value, editingClient.id);
                            e.target.value = '';
                          }
                        }}
                        value=""
                      >
                        <option value="">Select a project to assign...</option>
                        {allProjects.filter(p => p.client_id !== editingClient.id).map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} {p.client_name ? `(Assigned to ${p.client_name})` : '(Unassigned)'}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="modal-footer" style={{ marginTop: '2rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', textAlign: 'right' }}>
              <button type="button" className="btn btn--secondary" onClick={() => setShowEditModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
