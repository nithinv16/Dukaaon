# DukaaOn Website

Modern, responsive website for DukaaOn - a tech-enabled distribution and financial inclusion platform for rural and semi-urban retailers.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript (Strict Mode)
- **Styling:** Tailwind CSS with custom design system
- **Animations:** Framer Motion
- **Forms:** React Hook Form
- **Maps:** Leaflet / React Leaflet
- **Database:** Supabase (PostgreSQL)
- **Deployment:** Vercel

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account and project

### Installation

1. Install dependencies:

```bash
npm install
```

2. Set up environment variables:
   - Copy `.env.example` to `.env.local`
   - Fill in your Supabase credentials from the root app

3. Run the development server:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting

## Project Structure

```
DukaaOnWebsite/
├── app/                    # Next.js App Router pages
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   └── globals.css        # Global styles
├── components/            # React components
├── lib/                   # Utility functions and configs
│   └── supabase.ts       # Supabase client
├── types/                 # TypeScript type definitions
│   └── index.ts          # Shared types
├── public/               # Static assets
└── .env.local           # Environment variables (not in git)
```

## Design System

### Colors

- **Primary:** Orange (#FF6B35), Dark (#1A1A1A), Gray (#545454)
- **Secondary:** Blue (#004E89), Green (#2A9D8F)
- **Neutral:** White, Light Gray, Medium Gray, Dark Gray
- **Accent:** Yellow (#FFB703), Red (#E63946)

### Typography

- **Headings:** Inter, Poppins
- **Body:** Inter, Open Sans

### Spacing

Uses a consistent spacing scale from 4px to 96px.

## Environment Variables

See `.env.example` for required environment variables.

## Database Setup

The website uses the existing Supabase database from the root app. Only one new table is needed:

- `enquiry_messages` - For storing visitor inquiries

See the design document for the complete schema.

## Contributing

1. Follow the TypeScript strict mode guidelines
2. Use Prettier for code formatting
3. Follow the established design system
4. Write meaningful commit messages

## License

Private - DukaaOn
