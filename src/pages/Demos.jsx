import { Link } from 'react-router-dom';

// Demo apps available
const DEMOS = [
  {
    id: 'contractor-crm',
    name: 'Contractor CRM',
    description: 'Quote generation, invoicing, and customer management for contractors',
    industry: 'Roofing, HVAC, Plumbing',
    features: ['Quote Builder', 'Invoice Generator', 'Customer Database', 'Email Campaigns'],
    price: '$5,000',
    buildTime: '72 hours',
    liveUrl: null, // Will be set when deployed
    demoCredentials: { email: 'demo@buildlab.com', password: 'demo123' },
    packages: [
      '@buildlab/contractor-module',
      '@buildlab/invoice-module',
      '@buildlab/growth-engine/email-blaster',
      '@buildlab/theme-system',
    ],
  },
  {
    id: 'freelancer-invoices',
    name: 'Freelancer Invoices',
    description: 'Simple invoicing and payment tracking for freelancers',
    industry: 'Freelancers, Consultants',
    features: ['Invoice Templates', 'Payment Tracking', 'Client Portal', 'Recurring Invoices'],
    price: '$3,500',
    buildTime: '48 hours',
    liveUrl: null,
    demoCredentials: { email: 'demo@buildlab.com', password: 'demo123' },
    packages: [
      '@buildlab/invoice-module',
      '@buildlab/growth-engine/email-blaster',
    ],
  },
  {
    id: 'agency-dashboard',
    name: 'Agency Dashboard',
    description: 'Client management and project tracking for marketing agencies',
    industry: 'Marketing Agencies, Dev Shops',
    features: ['Client Portal', 'Project Tracking', 'Time Logging', 'Reporting'],
    price: '$12,000',
    buildTime: '1 week',
    liveUrl: null,
    demoCredentials: { email: 'demo@buildlab.com', password: 'demo123' },
    packages: [
      '@buildlab/crm-module',
      '@buildlab/analytics-engine',
      '@buildlab/admin-dashboard',
    ],
  },
  {
    id: 'booking-platform',
    name: 'Service Booking',
    description: 'Appointment scheduling for salons, spas, and fitness studios',
    industry: 'Salons, Spas, Fitness',
    features: ['Calendar Booking', 'SMS Reminders', 'Staff Management', 'Payment'],
    price: '$6,500',
    buildTime: '72 hours',
    liveUrl: null,
    demoCredentials: { email: 'demo@buildlab.com', password: 'demo123' },
    packages: [
      '@buildlab/growth-engine/sms-broadcaster',
      '@buildlab/service-marketplace',
    ],
  },
];

export default function DemosPage() {
  return (
    <div className="demos-page">
      <div className="demos-header">
        <h1>Live Demos</h1>
        <p>See what you can build in 48-72 hours</p>
      </div>

      <div className="demos-grid">
        {DEMOS.map(demo => (
          <div key={demo.id} className="demo-card">
            <div className="demo-header">
              <h2>{demo.name}</h2>
              <span className="demo-price">{demo.price}</span>
            </div>

            <p className="demo-description">{demo.description}</p>

            <div className="demo-meta">
              <span className="demo-industry">{demo.industry}</span>
              <span className="demo-time">{demo.buildTime}</span>
            </div>

            <div className="demo-features">
              <h4>Features</h4>
              <ul>
                {demo.features.map(feature => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </div>

            <div className="demo-packages">
              <h4>Built With</h4>
              <ul>
                {demo.packages.map(pkg => (
                  <li key={pkg}>{pkg}</li>
                ))}
              </ul>
            </div>

            <div className="demo-actions">
              {demo.liveUrl ? (
                <a href={demo.liveUrl} target="_blank" rel="noopener noreferrer" className="btn-primary">
                  View Live Demo
                </a>
              ) : (
                <span className="demo-coming-soon">Demo coming soon</span>
              )}
              <Link to="/intake" className="btn-secondary">Build Something Similar</Link>
            </div>

            {demo.liveUrl && demo.demoCredentials && (
              <div className="demo-credentials">
                <p>Demo login: {demo.demoCredentials.email}</p>
                <p>Password: {demo.demoCredentials.password}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="demos-cta">
        <h2>Ready to Build Your Own?</h2>
        <p>Tell us your idea and get a custom quote in 1 hour.</p>
        <Link to="/intake" className="btn-primary">Start the Intake</Link>
      </div>
    </div>
  );
}
