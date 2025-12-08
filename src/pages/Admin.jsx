import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const ADMIN_PASSWORD = 'buildlab2024';

export default function AdminDashboard() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [stats, setStats] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [flags, setFlags] = useState([]);

  useEffect(() => {
    if (localStorage.getItem('admin_auth') === 'true') {
      setAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    fetchDashboardData();
  }, [authenticated]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      localStorage.setItem('admin_auth', 'true');
      setAuthenticated(true);
    } else {
      alert('Invalid password');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_auth');
    setAuthenticated(false);
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
        setProjects(data.projects || []);
        setFlags(data.flags || []);
      }
    } catch (err) {
      console.error('Failed to fetch admin data:', err);
    }
    setLoading(false);
  };

  const toggleFlag = async (name, currentValue) => {
    try {
      await fetch('/api/admin/flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, enabled: !currentValue }),
      });
      fetchDashboardData();
    } catch (err) {
      console.error('Failed to toggle flag:', err);
    }
  };

  if (!authenticated) {
    return (
      <div className="admin-login">
        <div className="login-card">
          <h1>Admin Access</h1>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              placeholder="Enter admin password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="submit">Login</button>
          </form>
          <Link to="/" className="back-link">Back to site</Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-header">
          <h1>Loading Dashboard...</h1>
        </div>
      </div>
    );
  }

  const priceMap = {
    'basic-crud': 2500,
    'contractor-crm': 10000,
    'booking-platform': 7500,
    'freelancer-invoices': 5000,
    'agency-dashboard': 8000,
  };

  const safeStats = stats || {};

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div>
          <h1>Build Lab Dashboard</h1>
          <p className="admin-subtitle">Real-time business metrics</p>
        </div>
        <button onClick={handleLogout} className="logout-btn">Logout</button>
      </div>

      <div className="stats-grid">
        <StatCard title="Total Intakes" value={safeStats.totalIntakes || 0} icon="📥" />
        <StatCard title="Deployed" value={safeStats.deployed || 0} icon="🚀" highlight />
        <StatCard title="Conversion Rate" value={(safeStats.conversionRate || 0) + '%'} icon="📈" />
        <StatCard title="Revenue" value={'$' + (safeStats.revenue || 0).toLocaleString()} icon="💰" highlight />
        <StatCard title="Avg Build Time" value={(safeStats.avgBuildTime || 0) + 'm'} icon="⏱️" />
      </div>

      <div className="admin-section">
        <h2>Template Performance</h2>
        <div className="template-grid">
          {(safeStats.templateBreakdown || []).map((t) => (
            <div key={t.template} className="template-card">
              <div className="template-name">{t.template}</div>
              <div className="template-stats">
                <span>{t.count} builds</span>
                <span className="template-revenue">${(t.count * (priceMap[t.template] || 5000)).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="admin-section">
        <h2>Feature Flags</h2>
        <div className="flags-grid">
          {['contractor-crm', 'freelancer-invoices', 'booking-platform', 'agency-dashboard', 'basic-crud'].map((template) => {
            const flag = flags.find(f => f.name === template);
            const isEnabled = flag ? flag.enabled : true;
            return (
              <div key={template} className={'flag-card ' + (isEnabled ? 'enabled' : 'disabled')}>
                <span className="flag-name">{template}</span>
                <button
                  onClick={() => toggleFlag(template, isEnabled)}
                  className={'flag-toggle ' + (isEnabled ? 'on' : 'off')}
                >
                  {isEnabled ? 'ON' : 'OFF'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="admin-section">
        <h2>Recent Projects</h2>
        <div className="projects-table">
          <table>
            <thead>
              <tr>
                <th>App Name</th>
                <th>Email</th>
                <th>Template</th>
                <th>Status</th>
                <th>Price</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.project_id}>
                  <td className="app-name">{p.app_name}</td>
                  <td className="email">{p.email}</td>
                  <td><span className="template-badge">{p.template}</span></td>
                  <td>
                    <span className={'status-badge status-' + p.status}>
                      {p.status}
                    </span>
                  </td>
                  <td className="price">${(p.price || priceMap[p.template] || 5000).toLocaleString()}</td>
                  <td className="date">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td>
                    <Link to={'/status/' + p.project_id} className="view-link">View</Link>
                  </td>
                </tr>
              ))}
              {projects.length === 0 && (
                <tr>
                  <td colSpan="7" className="empty-state">No projects yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="admin-section">
        <h2>Pipeline</h2>
        <div className="pipeline">
          <PipelineStage title="Pending" count={projects.filter(p => p.status === 'pending').length} color="#6b7280" />
          <div className="pipeline-arrow">→</div>
          <PipelineStage title="Building" count={projects.filter(p => p.status === 'building').length} color="#3b82f6" />
          <div className="pipeline-arrow">→</div>
          <PipelineStage title="Deployed" count={projects.filter(p => p.status === 'deployed').length} color="#10b981" />
          <div className="pipeline-arrow">→</div>
          <PipelineStage title="Failed" count={projects.filter(p => p.status === 'failed').length} color="#ef4444" />
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, highlight }) {
  return (
    <div className={'stat-card ' + (highlight ? 'highlight' : '')}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-content">
        <div className="stat-value">{value}</div>
        <div className="stat-title">{title}</div>
      </div>
    </div>
  );
}

function PipelineStage({ title, count, color }) {
  return (
    <div className="pipeline-stage" style={{ borderColor: color }}>
      <div className="pipeline-count" style={{ color: color }}>{count}</div>
      <div className="pipeline-title">{title}</div>
    </div>
  );
}
