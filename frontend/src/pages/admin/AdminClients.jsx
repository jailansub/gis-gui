import { useState, useEffect } from 'react';
import api from '../../api/client';
import Navbar from '../../components/Navbar';

export default function AdminClients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
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

  const handleDeleteClient = async (clientId) => {
    if (!window.confirm('Are you sure you want to delete this client? All their assigned projects will become unassigned.')) {
      return;
    }

    try {
      await api.delete(`/users/${clientId}`);
      fetchClients();
    } catch (err) {
      alert('Failed to delete client');
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
                        <button 
                          className="btn btn--secondary btn--sm"
                          onClick={() => handleDeleteClient(client.id)}
                          style={{ color: '#ef4444' }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

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
    </div>
  );
}
