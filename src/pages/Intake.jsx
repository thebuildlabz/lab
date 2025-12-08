import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

// Pricing calculator
function calculatePrice(data) {
  let base = 2500;
  base += (data.features?.length || 0) * 500;
  base += (data.integrations?.length || 0) * 1000;
  if (data.timeline === '48h') base *= 1.2;
  return Math.round(base);
}

// Generate project ID
function generateProjectId() {
  return 'prj_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

const STEPS = [
  {
    id: 'idea',
    title: 'What are you building?',
    subtitle: 'Describe your app idea in 1-2 sentences',
    type: 'textarea',
    field: 'appIdea',
    placeholder: 'e.g., A platform for freelancers to create and send invoices',
  },
  {
    id: 'problem',
    title: 'What problem does it solve?',
    subtitle: 'Be specific. Who is struggling?',
    type: 'textarea',
    field: 'problem',
    placeholder: 'e.g., Freelancers waste 2+ hours per week creating invoices in Excel',
  },
  {
    id: 'customer',
    title: 'Who is your customer?',
    subtitle: 'Who will pay for this?',
    type: 'radio',
    field: 'targetCustomer',
    options: [
      { label: 'Freelancers', value: 'freelancers' },
      { label: 'Small Business Owners', value: 'smb' },
      { label: 'Enterprises', value: 'enterprise' },
      { label: 'Agencies', value: 'agencies' },
      { label: 'Other', value: 'other' },
    ],
  },
  {
    id: 'features',
    title: 'Core features (pick 3-5)',
    subtitle: 'What is the MVP?',
    type: 'checkbox',
    field: 'features',
    options: [
      'User authentication',
      'Data collection / Forms',
      'Payment processing',
      'Email notifications',
      'SMS notifications',
      'Reporting / Analytics',
      'Admin dashboard',
      'Mobile responsive',
      'API integrations',
      'File uploads',
    ],
  },
  {
    id: 'integrations',
    title: 'Any integrations needed?',
    subtitle: 'Third-party services to connect',
    type: 'checkbox',
    field: 'integrations',
    options: [
      'Stripe (payments)',
      'Slack (notifications)',
      'Google Sheets (data sync)',
      'Zapier (automation)',
      'Mailchimp (email lists)',
      'Twilio (SMS)',
      'QuickBooks (accounting)',
      'HubSpot (CRM)',
      'None',
    ],
  },
  {
    id: 'timeline',
    title: 'Timeline',
    subtitle: 'How fast do you need it?',
    type: 'radio',
    field: 'timeline',
    options: [
      { label: '48 hours (Rush +20%)', value: '48h' },
      { label: '72 hours (Standard)', value: '72h' },
      { label: '1 week (Complex)', value: '1w' },
    ],
  },
  {
    id: 'contact',
    title: 'Your contact info',
    subtitle: 'Where should we send updates?',
    type: 'contact',
    fields: ['name', 'email', 'company'],
  },
];

export default function IntakePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get('ref');
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({
    appIdea: '',
    problem: '',
    targetCustomer: '',
    features: [],
    integrations: [],
    timeline: '72h',
    name: '',
    email: '',
    company: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const currentStep = STEPS[step];
  const estimatedPrice = calculatePrice(formData);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCheckboxChange = (field, option, checked) => {
    setFormData(prev => ({
      ...prev,
      [field]: checked
        ? [...(prev[field] || []), option]
        : (prev[field] || []).filter(o => o !== option),
    }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);

    try {
      // Try production API first
      const response = await fetch('/api/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appIdea: formData.appIdea,
          problem: formData.problem,
          name: formData.name,
          email: formData.email,
          features: formData.features,
          integrations: formData.integrations,
          timeline: formData.timeline,
          targetCustomer: formData.targetCustomer,
          ref: refCode,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        navigate('/status/' + data.projectId);
        return;
      }

      // Fallback: localStorage demo mode
      console.log('API unavailable, using demo mode');
      const projectId = generateProjectId();
      const project = {
        id: projectId,
        ...formData,
        estimatedPrice,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      const projects = JSON.parse(localStorage.getItem('buildlab_projects') || '[]');
      projects.push(project);
      localStorage.setItem('buildlab_projects', JSON.stringify(projects));
      navigate('/status/' + projectId);
    } catch (error) {
      console.error('Submit error:', error);
      alert('Error submitting form. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderInput = () => {
    switch (currentStep.type) {
      case 'textarea':
        return (
          <textarea
            value={formData[currentStep.field] || ''}
            onChange={e => handleChange(currentStep.field, e.target.value)}
            placeholder={currentStep.placeholder}
            rows={4}
          />
        );

      case 'radio':
        return (
          <div className="options-list">
            {currentStep.options.map(opt => {
              const option = typeof opt === 'string' ? { label: opt, value: opt } : opt;
              return (
                <label key={option.value} className="option">
                  <input
                    type="radio"
                    name={currentStep.field}
                    value={option.value}
                    checked={formData[currentStep.field] === option.value}
                    onChange={e => handleChange(currentStep.field, e.target.value)}
                  />
                  <span>{option.label}</span>
                </label>
              );
            })}
          </div>
        );

      case 'checkbox':
        return (
          <div className="options-list">
            {currentStep.options.map(option => (
              <label key={option} className="option">
                <input
                  type="checkbox"
                  checked={(formData[currentStep.field] || []).includes(option)}
                  onChange={e => handleCheckboxChange(currentStep.field, option, e.target.checked)}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        );

      case 'contact':
        return (
          <div className="contact-fields">
            <input
              type="text"
              placeholder="Your name"
              value={formData.name}
              onChange={e => handleChange('name', e.target.value)}
            />
            <input
              type="email"
              placeholder="Email address"
              value={formData.email}
              onChange={e => handleChange('email', e.target.value)}
            />
            <input
              type="text"
              placeholder="Company (optional)"
              value={formData.company}
              onChange={e => handleChange('company', e.target.value)}
            />
          </div>
        );

      default:
        return null;
    }
  };

  const canProceed = () => {
    const field = currentStep.field;
    if (currentStep.type === 'contact') {
      return formData.name && formData.email;
    }
    if (currentStep.type === 'checkbox') {
      return (formData[field] || []).length > 0;
    }
    return formData[field];
  };

  const priceDisplay = '$' + estimatedPrice.toLocaleString();

  return (
    <div className="intake-page">
      <div className="intake-header">
        <h1>Build Lab Intake</h1>
        <p>Your idea. Live in 48-72 hours.</p>
      </div>

      <div className="intake-container">
        <div className="progress-bar">
          <div className="progress-info">
            <span>Step {step + 1} of {STEPS.length}</span>
            <span className="estimate">Est: {priceDisplay} | {formData.timeline}</span>
          </div>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: ((step + 1) / STEPS.length * 100) + '%' }}
            />
          </div>
        </div>

        <div className="step-card">
          <h2>{currentStep.title}</h2>
          <p className="subtitle">{currentStep.subtitle}</p>
          <div className="step-input">
            {renderInput()}
          </div>
        </div>

        <div className="nav-buttons">
          <button
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            className="btn-secondary"
          >
            Back
          </button>

          {step === STEPS.length - 1 ? (
            <button
              onClick={handleSubmit}
              disabled={!canProceed() || submitting}
              className="btn-primary"
            >
              {submitting ? 'Submitting...' : 'Submit & Start Building'}
            </button>
          ) : (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="btn-primary"
            >
              Next
            </button>
          )}
        </div>

        <div className="proof-card">
          <p className="proof-label">Built in 48 hours</p>
          <p className="proof-quote">
            "We went from idea to live invoicing tool in 2 days."
          </p>
          <p className="proof-cite">- Sarah, Freelance Designer</p>
        </div>
      </div>
    </div>
  );
}
