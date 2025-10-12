# Dukaaon - B2B E-commerce Platform

## Overview
Dukaaon is a B2B e-commerce platform connecting wholesalers, manufacturers, and retailers. The platform facilitates seamless business transactions with features like real-time inventory management, order processing, and secure payments.

## Features
- Multi-role user system (Customer, Seller, Admin)
- Real-time inventory management
- Location-based vendor discovery
- Secure payment processing
- Order tracking and management
- KYC verification system
- Multi-language support

## Tech Stack
- Next.js
- React Native
- Supabase
- TypeScript
- Redis (for rate limiting)
- Jest (for testing)

## Prerequisites
- Node.js (v14 or higher)
- Redis server
- Supabase account
- Environment variables configured

## Environment Variables
Create a `.env` file in the root directory with the following variables:
```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Rate Limiting
RATE_LIMIT_POINTS=5
RATE_LIMIT_DURATION=3600

# JWT Configuration
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRY=24h

# Redis Configuration
REDIS_URL=your_redis_url

# Monitoring
SENTRY_DSN=your_sentry_dsn
NEW_RELIC_LICENSE_KEY=your_new_relic_key
GA_MEASUREMENT_ID=your_ga_measurement_id

# Security
CORS_ORIGIN=http://localhost:3000
API_KEY=your_api_key
```

## Installation
1. Clone the repository
```bash
git clone https://github.com/yourusername/dukaaon.git
cd dukaaon
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Start the development server
```bash
npm run dev
```

## Testing
Run tests with coverage:
```bash
npm test
```

## Security Features
- JWT-based authentication
- Rate limiting
- Input validation
- XSS protection
- CORS configuration
- Secure API endpoints

## Monitoring
The application includes comprehensive monitoring:
- Error tracking (Sentry)
- Performance monitoring (New Relic)
- Usage analytics (Google Analytics)
- System status monitoring

## Contributing
1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License
This project is licensed under the MIT License - see the LICENSE file for details.

## Support
For support, email support@dukaaon.com or create an issue in the repository.
