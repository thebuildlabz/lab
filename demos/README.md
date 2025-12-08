# Build Lab Demos

Live working applications built with the Build Lab factory.

## Available Demos

| Demo | Description | Live URL | Source |
|------|-------------|----------|--------|
| contractor-crm | Quote generation and invoicing for contractors | TBD | [View](./contractor-crm/) |
| freelancer-invoices | Simple invoicing for freelancers | TBD | [View](./freelancer-invoices/) |
| agency-dashboard | Client management for agencies | TBD | [View](./agency-dashboard/) |
| booking-platform | Appointment scheduling | TBD | [View](./booking-platform/) |

## Demo Credentials

All demos use the same login:
- Email: demo@buildlab.com
- Password: demo123

## Adding a New Demo

1. Create a folder: `demos/{demo-name}/`
2. Copy from factory template: `factory/templates/{template}`
3. Customize for demo purposes
4. Deploy to Vercel
5. Update this README with live URL

## Factory Packages Used

Each demo showcases different factory packages:

- `@buildlab/invoice-module` - Invoice generation
- `@buildlab/contractor-module` - Contractor-specific features
- `@buildlab/growth-engine/email-blaster` - Email campaigns
- `@buildlab/growth-engine/sms-broadcaster` - SMS notifications
- `@buildlab/crm-module` - Customer management
- `@buildlab/analytics-engine` - Reporting dashboards
