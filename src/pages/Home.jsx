import { Link } from 'react-router-dom';

export default function HomePage() {
  return (
    <div className="home">
      <section className="hero">
        <h1>Your App Idea, Built in 48-72 Hours</h1>
        <p>No more waiting for developers. No more $50k agency fees.</p>
        <Link to="/intake" className="cta-button">Start Your App</Link>
      </section>

      <section className="pricing">
        <h2>Simple Pricing</h2>
        <div className="price-grid">
          <div className="price-card">
            <h3>Starter</h3>
            <p className="price">$2,500</p>
            <p>Basic CRUD app</p>
            <ul>
              <li>48 hours</li>
              <li>API + Database</li>
              <li>Admin dashboard</li>
              <li>Source code included</li>
            </ul>
          </div>

          <div className="price-card featured">
            <h3>Pro</h3>
            <p className="price">$10,000</p>
            <p>Multi-user SaaS</p>
            <ul>
              <li>72 hours</li>
              <li>Stripe integration</li>
              <li>Email + SMS</li>
              <li>Analytics dashboard</li>
              <li>Custom domain</li>
            </ul>
          </div>

          <div className="price-card">
            <h3>Enterprise</h3>
            <p className="price">Custom</p>
            <p>Complex integrations</p>
            <ul>
              <li>1 week</li>
              <li>Custom features</li>
              <li>Premium support</li>
              <li>Compliance ready</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="proof">
        <h2>Built in 48-72 Hours</h2>
        <div className="testimonials">
          <blockquote>
            <p>"We saved 6 months and $100k in dev costs."</p>
            <cite>— Sarah, Roofing Co.</cite>
          </blockquote>
          <blockquote>
            <p>"Best decision we made for our SaaS launch."</p>
            <cite>— Mike, Startup CEO</cite>
          </blockquote>
        </div>
      </section>

      <section className="cta">
        <h2>Ready? Lets Build</h2>
        <p>Tell us your idea. Well quote it in 1 hour.</p>
        <Link to="/intake" className="cta-button">Start the Intake</Link>
      </section>

      <footer>
        <p>Full source code included | Hosted on Vercel | 30-day money-back guarantee</p>
      </footer>
    </div>
  );
}
