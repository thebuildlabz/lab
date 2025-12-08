import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';

// Build stages - maps to GitHub Action progress
const BUILD_STAGES = [
  { id: 'queued', label: 'Queued', icon: '...' },
  { id: 'cloning', label: 'Cloning Template', icon: '...' },
  { id: 'branding', label: 'Applying Branding', icon: '...' },
  { id: 'deploying', label: 'Deploying to Vercel', icon: '...' },
  { id: 'deployed', label: 'Live!', icon: '...' },
];

function getStageIndex(status) {
  const index = BUILD_STAGES.findIndex(s => s.id === status);
  return index >= 0 ? index : 0;
}

export default function StatusPage() {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load project - try API first, fallback to localStorage
  useEffect(() => {
    async function loadProject() {
      // Try API first (production)
      try {
        const res = await fetch('/api/project/' + projectId);
        if (res.ok) {
          const data = await res.json();
          setProject(data);
          setLoading(false);
          return;
        }
      } catch (e) {
        // API not available, fallback to localStorage
      }

      // Fallback: localStorage (demo mode)
      const projects = JSON.parse(localStorage.getItem('buildlab_projects') || '[]');
      const found = projects.find(p => p.id === projectId);

      if (found) {
        // Simulate deployment progress for demo
        setProject({
          ...found,
          status: 'queued',
          template: found.template || 'contractor-crm',
        });
      }
      setLoading(false);
    }

    loadProject();
  }, [projectId]);

  // Poll for updates every 5 seconds if not deployed
  useEffect(() => {
    if (!project || project.status === 'deployed') return;

    const interval = setInterval(async () => {
      // Try API
      try {
        const res = await fetch('/api/project/' + projectId);
        if (res.ok) {
          const data = await res.json();
          setProject(data);
          if (data.status === 'deployed') {
            clearInterval(interval);
          }
          return;
        }
      } catch (e) {
        // API not available
      }

      // Demo mode: simulate progress
      setProject(prev => {
        if (!prev) return prev;
        const stages = ['queued', 'cloning', 'branding', 'deploying', 'deployed'];
        const currentIndex = stages.indexOf(prev.status);
        if (currentIndex < stages.length - 1) {
          const nextStatus = stages[currentIndex + 1]; return { ...prev, status: nextStatus, deployUrl: nextStatus === 'deployed' ? 'https://' + projectId.replace('prj_', '') + '.demo.vercel.app' : prev.deployUrl };
        }
        return prev;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [project, projectId]);

  if (loading) {
    return (
      <div className="status-page">
        <div className="status-header">
          <h1>Loading...</h1>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="status-page">
        <div className="status-header">
          <h1>Project Not Found</h1>
          <p className="project-id">ID: {projectId}</p>
        </div>
        <div className="status-container">
          <p>This project may not exist or has expired.</p>
          <Link to="/intake" className="btn-primary">Start a New Project</Link>
        </div>
      </div>
    );
  }

  const currentStage = getStageIndex(project.status);
  const isDeployed = project.status === 'deployed';
  const progress = Math.round(((currentStage + 1) / BUILD_STAGES.length) * 100);

  return (
    <div className="status-page">
      <div className="status-header">
        <h1>{isDeployed ? 'Your App is Live!' : 'Building Your App...'}</h1>
        <p className="project-id">ID: {projectId}</p>
      </div>

      <div className="status-container">
        {/* Progress */}
        <div className="progress-card">
          <h2>Build Progress</h2>
          <div className="progress-bar">
            <div className="progress-track">
              <div className="progress-fill" style={{ width: progress + '%' }} />
            </div>
            <span className="progress-text">{progress}%</span>
          </div>

          {/* Stage Timeline */}
          <div className="stage-timeline">
            {BUILD_STAGES.map((stage, i) => (
              <div
                key={stage.id}
                className={
                  'stage ' +
                  (i < currentStage ? 'stage-done ' : '') +
                  (i === currentStage ? 'stage-active ' : '') +
                  (i > currentStage ? 'stage-pending' : '')
                }
              >
                <div className="stage-dot">
                  {i < currentStage ? '...' : i === currentStage ? '...' : '...'}
                </div>
                <span className="stage-label">{stage.label}</span>
              </div>
            ))}
          </div>

          {/* Deploy Success */}
          {isDeployed && (
            <div className="deploy-success">
              <h3>Build Complete!</h3>
              <p>Your {project.template} app is ready.</p>
              {project.deployUrl ? (
                <>
                  <a href={project.deployUrl} target="_blank" rel="noopener noreferrer" className="btn-primary">
                    View Live App
                  </a>
                  <p className="demo-creds">
                    Demo login: demo@buildlab.com / demo123
                  </p>
                </>
              ) : (
                <p>Deploy URL will appear here shortly...</p>
              )}
            </div>
          )}
        </div>

        {/* Project Summary */}
        <div className="summary-card">
          <h2>Project Details</h2>
          <div className="summary-grid">
            <div className="summary-item">
              <label>App</label>
              <p>{project.appIdea || project.appName || 'Your App'}</p>
            </div>
            <div className="summary-item">
              <label>Template</label>
              <p>{project.template}</p>
            </div>
            <div className="summary-item">
              <label>Timeline</label>
              <p>{project.timeline || '72h'}</p>
            </div>
            <div className="summary-item">
              <label>Cost</label>
              <p>${(project.estimatedPrice || project.price || 2500).toLocaleString()}</p>
            </div>
            {project.features?.length > 0 && (
              <div className="summary-item">
                <label>Features</label>
                <p>{project.features.join(', ')}</p>
              </div>
            )}
            {project.integrations?.length > 0 && (
              <div className="summary-item">
                <label>Integrations</label>
                <p>{project.integrations.join(', ')}</p>
              </div>
            )}
          </div>
        </div>

        {/* Activity Log */}
        <div className="log-card">
          <h2>Activity</h2>
          <ul className="log-list">
            <li>
              <span className="log-time">{new Date(project.createdAt).toLocaleString()}</span>
              <span className="log-event">Intake submitted</span>
            </li>
            <li>
              <span className="log-time">{new Date(project.createdAt).toLocaleString()}</span>
              <span className="log-event">Template selected: {project.template}</span>
            </li>
            {project.status !== 'queued' && (
              <li>
                <span className="log-time">Now</span>
                <span className="log-event">
                  {isDeployed ? 'Deployed successfully' : 'Build in progress...'}
                </span>
              </li>
            )}
          </ul>
        </div>

        {/* Next Steps */}
        {isDeployed && (
          <div className="summary-card">
            <h2>Next Steps</h2>
            <ul style={{ listStyle: 'decimal', paddingLeft: '1.5rem' }}>
              <li>Test your app with the demo credentials</li>
              <li>Reply to our email with any feedback</li>
              <li>We'll iterate until you're happy</li>
              <li>Receive full source code + handoff docs</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
