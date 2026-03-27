import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import Navbar from '../../components/Navbar';

const LAYER_TYPES = [
  { id: 'ortho', label: 'Orthomosaic', description: 'RGB Aerial Imagery (.tif)', ext: '.tif', required: true },
  { id: 'dtm', label: 'DTM', description: 'Digital Terrain Model (.tif)', ext: '.tif', required: true },
  { id: 'dsm', label: 'DSM', description: 'Digital Surface Model (.tif)', ext: '.tif', required: false },
  { id: 'boundary', label: 'Boundary', description: 'Plantation Boundary (shp, shx, dbf, prj)', ext: '.shp, .shx, .dbf, .prj', required: true, multiple: true },
  { id: 'trees', label: 'Tree Inventory', description: 'Tree Height & Count (shp, shx, dbf, prj)', ext: '.shp, .shx, .dbf, .prj', required: true, multiple: true },
  { id: 'health', label: 'Health Data', description: 'Plant Health Analysis (shp, shx, dbf, prj)', ext: '.shp, .shx, .dbf, .prj', required: true, multiple: true },
];

export default function ProjectWizard() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState([]);
  const [error, setError] = useState('');
  
  // Step 1: Details
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    description: '',
    client_id: ''
  });
  
  // Step 2: Granular Uploads
  const [projectId, setProjectId] = useState(null);
  const [uploadStates, setUploadStates] = useState({
    ortho: { files: [], progress: 0, status: 'pending' },
    dtm: { files: [], progress: 0, status: 'pending' },
    dsm: { files: [], progress: 0, status: 'pending' },
    boundary: { files: [], progress: 0, status: 'pending' },
    trees: { files: [], progress: 0, status: 'pending' },
    health: { files: [], progress: 0, status: 'pending' },
  });
  
  // Step 3: Global Processing
  const [processingStatus, setProcessingStatus] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    async function fetchClients() {
      try {
        const res = await api.get('/users/clients');
        setClients(res.data);
      } catch (err) {
        console.error('Failed to fetch clients', err);
      }
    }
    fetchClients();
  }, []);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const res = await api.post('/projects', formData);
      setProjectId(res.data.id);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (type, newFiles) => {
    const fileArray = Array.from(newFiles);
    setUploadStates(prev => {
      const existingFiles = prev[type].files;
      // For multiple-select layers, append. For single-select, replace.
      const isMultiple = LAYER_TYPES.find(t => t.id === type)?.multiple;
      const updatedFiles = isMultiple ? [...existingFiles, ...fileArray] : fileArray;
      
      // Filter out duplicates by name
      const uniqueFiles = updatedFiles.filter((file, index, self) =>
        index === self.findIndex((t) => t.name === file.name)
      );

      return {
        ...prev,
        [type]: { ...prev[type], files: uniqueFiles, status: 'pending', progress: 0 }
      };
    });
  };

  const handleRemoveFile = (type, fileName) => {
    setUploadStates(prev => ({
      ...prev,
      [type]: { 
        ...prev[type], 
        files: prev[type].files.filter(f => f.name !== fileName),
        status: prev[type].files.length <= 1 ? 'pending' : prev[type].status
      }
    }));
  };

  const uploadLayer = async (type) => {
    const state = uploadStates[type];
    if (state.files.length === 0 || state.status === 'completed' || state.status === 'uploading') return;

    setUploadStates(prev => ({
      ...prev,
      [type]: { ...prev[type], status: 'uploading', progress: 0 }
    }));

    const uploadData = new FormData();
    state.files.forEach(file => uploadData.append('files', file));

    try {
      await api.post(`/projects/${projectId}/upload/${type}`, uploadData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadStates(prev => ({
            ...prev,
            [type]: { ...prev[type], progress: percent }
          }));
        }
      });
      setUploadStates(prev => ({
        ...prev,
        [type]: { ...prev[type], status: 'completed', progress: 100 }
      }));
    } catch (err) {
      setUploadStates(prev => ({
        ...prev,
        [type]: { ...prev[type], status: 'error' }
      }));
      setError(`Upload failed for ${type}: ${err.response?.data?.detail || 'Unknown error'}`);
    }
  };

  const uploadAllPending = async () => {
    const pendingLayers = LAYER_TYPES.filter(t => uploadStates[t.id].files.length > 0 && uploadStates[t.id].status === 'pending');
    for (const layer of pendingLayers) {
      await uploadLayer(layer.id);
    }
  };

  const triggerProcessing = async () => {
    setLoading(true);
    try {
      await api.post(`/projects/${projectId}/process`);
      setStep(3);
      startPollingStatus();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to start processing');
      setLoading(false);
    }
  };

  const startPollingStatus = () => {
    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/projects/${projectId}/status`);
        setProcessingStatus(res.data.status);
        if (res.data.status === 'ready' || res.data.status === 'error') {
          clearInterval(interval);
          setLoading(false);
        }
      } catch (err) {
        console.error('Polling failed', err);
      }
    }, 3000);
  };

  const canProcess = LAYER_TYPES.every(t => !t.required || uploadStates[t.id].status === 'completed');

  return (
    <div className="app-layout">
      <Navbar />
      
      <main className="page-content">
        <div className="admin-header">
          <h1>{step === 2 ? `Draft: ${formData.name}` : 'Create New Project'}</h1>
          <button className="btn btn--secondary" onClick={() => navigate('/admin')}>Cancel</button>
        </div>

        <div className="wizard-steps">
          <div className={`wizard-step ${step === 1 ? 'wizard-step--active' : step > 1 ? 'wizard-step--completed' : ''}`}>
            <div className="wizard-step__number">1</div>
            <span>Details</span>
          </div>
          <div className={`wizard-step ${step === 2 ? 'wizard-step--active' : step > 2 ? 'wizard-step--completed' : ''}`}>
            <div className="wizard-step__number">2</div>
            <span>Data Layers</span>
          </div>
          <div className={`wizard-step ${step === 3 ? 'wizard-step--active' : ''}`}>
            <div className="wizard-step__number">3</div>
            <span>Processing</span>
          </div>
        </div>

        {error && <div className="login-error" style={{ maxWidth: '800px', margin: '0 auto 1.5rem' }}>{error}</div>}

        <div className="wizard-container" style={{ maxWidth: '900px', margin: '0 auto' }}>
          {step === 1 && (
            <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
              <form onSubmit={handleCreateProject}>
                <div className="form-group">
                  <label className="label">Project Name</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Pine Plantation Block A"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="label">Location</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. North Ridge, Oregon"
                    value={formData.location}
                    onChange={(e) => setFormData({...formData, location: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label className="label">Assigned Client</label>
                  <select 
                    className="input"
                    value={formData.client_id}
                    onChange={(e) => setFormData({...formData, client_id: e.target.value})}
                    required
                  >
                    <option value="">Select a client...</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.full_name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="label">Description (Optional)</label>
                  <textarea
                    className="input"
                    style={{ minHeight: '80px', resize: 'vertical' }}
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" className="btn btn--primary" disabled={loading}>
                    {loading ? 'Creating...' : 'Next: Upload Data'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {step === 2 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                  Select files for each required category, then click <strong>Upload All</strong> to begin.
                </p>
                <button 
                  className="btn btn--secondary btn--sm"
                  onClick={uploadAllPending}
                  disabled={!LAYER_TYPES.some(t => uploadStates[t.id].files.length > 0 && uploadStates[t.id].status === 'pending')}
                >
                  ☁️ Upload All Pending
                </button>
              </div>
              
              <div className="upload-grid">
                {LAYER_TYPES.map(layer => (
                  <div key={layer.id} className={`upload-card upload-card--${uploadStates[layer.id].status}`}>
                    <div className="upload-card__header">
                      <div>
                        <h3 className="upload-card__title">
                          {layer.label} {layer.required && <span style={{ color: 'var(--accent-red)', fontSize: '14px' }}>*</span>}
                        </h3>
                        <p className="upload-card__desc">{layer.description}</p>
                      </div>
                      <div className="upload-card__badge">
                        {uploadStates[layer.id].status === 'completed' ? '✅' : layer.ext}
                      </div>
                    </div>

                    <div className="upload-card__body">
                      {uploadStates[layer.id].files.length > 0 ? (
                        <div className="upload-card__file-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                          {uploadStates[layer.id].files.map(file => (
                            <div key={file.name} className="file-item" style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '6px 10px',
                              background: 'rgba(255,255,255,0.05)',
                              borderRadius: '6px',
                              fontSize: '12px'
                            }}>
                              <span style={{ 
                                textOverflow: 'ellipsis', 
                                overflow: 'hidden', 
                                whiteSpace: 'nowrap',
                                maxWidth: '180px'
                              }}>
                                📄 {file.name}
                              </span>
                              {uploadStates[layer.id].status === 'pending' && (
                                <button 
                                  className="btn-icon" 
                                  style={{ background: 'none', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', padding: '0 4px', fontSize: '16px' }}
                                  onClick={() => handleRemoveFile(layer.id, file.name)}
                                >
                                  &times;
                                </button>
                              )}
                            </div>
                          ))}

                          {layer.id !== 'ortho' && layer.id !== 'dtm' && layer.id !== 'dsm' && uploadStates[layer.id].files.length > 0 && (
                            (() => {
                              const exts = uploadStates[layer.id].files.map(f => f.name.split('.').pop().toLowerCase());
                              const missing = ['dbf', 'shx', 'prj'].filter(e => !exts.includes(e));
                              return missing.length > 0 ? (
                                <p style={{ color: 'var(--accent-red)', fontSize: '11px', marginTop: '0', paddingLeft: '4px' }}>
                                  ⚠️ Missing: .{missing.join(', .')}! Select all parts.
                                </p>
                              ) : null;
                            })()
                          )}
                          
                          {uploadStates[layer.id].status === 'pending' && (
                            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                              <button 
                                className="btn btn--secondary btn--sm" 
                                style={{ flex: 1 }}
                                onClick={() => document.getElementById(`file-${layer.id}`).click()}
                              >
                                Add More
                              </button>
                              <button 
                                className="btn btn--primary btn--sm" 
                                style={{ flex: 1 }}
                                onClick={() => uploadLayer(layer.id)}
                              >
                                Upload
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <button 
                          className="btn btn--secondary btn--sm"
                          style={{ width: '100%' }}
                          onClick={() => document.getElementById(`file-${layer.id}`).click()}
                        >
                          Select Files
                        </button>
                      )}
                      
                      <input 
                        type="file" 
                        id={`file-${layer.id}`}
                        multiple={layer.multiple}
                        style={{ display: 'none' }}
                        onChange={(e) => handleFileSelect(layer.id, e.target.files)}
                      />
                    </div>

                    {uploadStates[layer.id].status === 'uploading' && (
                      <div className="upload-card__progress">
                        <div className="progress-bar">
                          <div className="progress-bar__fill" style={{ width: `${uploadStates[layer.id].progress}%` }} />
                        </div>
                        <span className="progress-text">{uploadStates[layer.id].progress}%</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="wizard-footer">
                <div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                    Supported formats: GeoTIFF (.tif) for rasters; Shapefiles (.shp, .shx, .dbf, .prj) for vectors.
                  </p>
                  {!canProcess && (
                    <p style={{ color: 'var(--accent-red)', fontSize: '12px', marginTop: '4px' }}>
                      ⚠️ Missing: {LAYER_TYPES.filter(t => t.required && uploadStates[t.id].status !== 'completed').map(t => t.label).join(', ')}
                    </p>
                  )}
                </div>
                <button 
                  className={`btn btn--primary btn--lg ${!canProcess ? 'btn--disabled' : ''}`}
                  disabled={!canProcess || loading}
                  onClick={triggerProcessing}
                >
                  {loading ? 'Starting...' : '🚀 Finalize and Process Project'}
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="card" style={{ textAlign: 'center', padding: '3rem 0' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1.5rem' }}>
                {processingStatus === 'ready' ? '✅' : processingStatus === 'error' ? '❌' : '⚙️'}
              </div>
              <h2 style={{ marginBottom: '1rem' }}>
                {processingStatus === 'ready' 
                  ? 'Project Ready!' 
                  : processingStatus === 'error'
                  ? 'Processing Failed'
                  : 'Processing GIS Data...'}
              </h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', maxWidth: '400px', margin: '0 auto' }}>
                {processingStatus === 'ready'
                  ? 'The plantation inventory is processed. You can now view the map and analytics.'
                  : processingStatus === 'error'
                  ? 'An error occurred during GIS processing. Verify your shapefiles contain the required columns.'
                  : 'We are generating XYZ map tiles and running spatial health analysis. This may take several minutes for large datasets.'}
              </p>
              
              {processingStatus !== 'ready' && processingStatus !== 'error' && (
                <div style={{ width: '300px', margin: '2rem auto' }}>
                  <div className="loading-dots">
                    <span>.</span><span>.</span><span>.</span>
                  </div>
                </div>
              )}

              <div style={{ marginTop: '3rem' }}>
                <button 
                  className="btn btn--primary" 
                  onClick={() => navigate('/admin')}
                  disabled={processingStatus !== 'ready' && processingStatus !== 'error'}
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
