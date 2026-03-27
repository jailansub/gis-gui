import { useState, useEffect } from 'react';
import api from '../../api/client';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';

export default function AnalyticsView({ project, onLocateOnMap }) {
  const [analytics, setAnalytics] = useState(null);
  const [trees, setTrees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ health: '', search: '' });

  useEffect(() => {
    if (!project) return;
    
    async function fetchData() {
      setLoading(true);
      try {
        const [statsRes, listRes] = await Promise.all([
          api.get(`/projects/${project.id}/analytics`),
          api.get(`/projects/${project.id}/trees/list`)
        ]);
        setAnalytics(statsRes.data);
        setTrees(listRes.data);
      } catch (err) {
        console.error('Failed to fetch analytics', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [project?.id]);

  const filteredTrees = trees.filter(t => {
    if (filter.health && t.health_status !== filter.health) return false;
    if (filter.search && !t.tree_index.toString().includes(filter.search)) return false;
    return true;
  });

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
  if (!analytics) return <div>Failed to load data.</div>;

  const healthData = [
    { name: 'Healthy', value: analytics.health_breakdown.healthy, color: 'var(--accent-green)' },
    { name: 'Moderate', value: analytics.health_breakdown.moderate, color: 'var(--accent-yellow)' },
    { name: 'Poor', value: analytics.health_breakdown.poor, color: 'var(--accent-red)' }
  ].filter(d => d.value > 0);

  return (
    <div className="analytics-page">
      <div className="admin-header">
        <div>
          <h1>Plantation Analytics</h1>
          <p style={{ color: 'var(--text-muted)' }}>Inventory overview for {project.name}.</p>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card kpi-card--blue">
          <div className="kpi-card__label">Total Identified Trees</div>
          <div className="kpi-card__value">{analytics.total_trees.toLocaleString()}</div>
          <div className="kpi-card__sub">Individual tree detections</div>
        </div>
        <div className="kpi-card kpi-card--purple">
          <div className="kpi-card__label">Average Canopy Height</div>
          <div className="kpi-card__value">{analytics.average_height || 0}m</div>
          <div className="kpi-card__sub">Mean height across stand</div>
        </div>
        <div className="kpi-card kpi-card--green">
          <div className="kpi-card__label">Overall Health Score</div>
          <div className="kpi-card__value">{analytics.health_score || 0}%</div>
          <div className="kpi-card__sub">Percentage of healthy trees</div>
        </div>
        <div className="kpi-card kpi-card--yellow">
          <div className="kpi-card__label">Plantation Area</div>
          <div className="kpi-card__value">{analytics.area_hectares || 0} ha</div>
          <div className="kpi-card__sub">Total boundary area</div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <h3 className="chart-card__title">Health Classification</h3>
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={healthData}
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {healthData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                  itemStyle={{ color: 'var(--text-primary)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '1rem' }}>
            {healthData.map(d => (
              <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: d.color }} />
                <span>{d.name}: <strong>{d.value}</strong></span>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-card">
          <h3 className="chart-card__title">Height Distribution (m)</h3>
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.height_distribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                <XAxis dataKey="range" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <RechartsTooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                />
                <Bar dataKey="count" fill="var(--accent-blue)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card__header">
          <h2 className="card__title">Master Tree Inventory</h2>
        </div>

        <div className="table-controls">
          <input 
            type="text" 
            className="input" 
            placeholder="Search by Tree ID..." 
            value={filter.search}
            onChange={(e) => setFilter({...filter, search: e.target.value})}
          />
          <select 
            className="input"
            value={filter.health}
            onChange={(e) => setFilter({...filter, health: e.target.value})}
          >
            <option value="">All Health Status</option>
            <option value="Healthy">Healthy</option>
            <option value="Moderate">Moderate</option>
            <option value="Poor">Poor</option>
          </select>
          <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
            Showing {filteredTrees.length} of {trees.length} trees
          </div>
        </div>
        
        <div className="table-container" style={{ maxHeight: '500px' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Tree ID</th>
                <th>Height (m)</th>
                <th>Health Status</th>
                <th>Coordinates</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrees.slice(0, 100).map((tree) => (
                <tr key={tree.id}>
                  <td style={{ fontWeight: 600 }}>#{tree.tree_index}</td>
                  <td>{tree.height_m}m</td>
                  <td>
                    <span className={`badge badge--${tree.health_status?.toLowerCase()}`}>
                      {tree.health_status}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                    {tree.latitude?.toFixed(6)}, {tree.longitude?.toFixed(6)}
                  </td>
                  <td>
                    <button 
                      className="btn btn--secondary btn--sm"
                      onClick={() => onLocateOnMap(tree)}
                    >
                      📍 Locate on Map
                    </button>
                  </td>
                </tr>
              ))}
              {filteredTrees.length > 100 && (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>
                    Displaying first 100 results. Use filters to narrow down.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
