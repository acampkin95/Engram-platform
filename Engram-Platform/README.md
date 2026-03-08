# ENGRAM Platform — Unified Frontend

A Next.js 15 unified frontend for the ENGRAM multi-layer AI memory system.

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
cd Engram-Platform/frontend
npm install
```

### Development

```bash
npm run dev
```

The app will be available at `http://localhost:3002`

### Build

```bash
npm run build
npm start
```

## Project Structure

```
frontend/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout with providers
│   ├── globals.css        # Tailwind v4 CSS-native setup
│   ├── page.tsx           # Redirect to /dashboard
│   └── dashboard/         # Dashboard routes
│       ├── page.tsx       # Redirect to /dashboard/home
│       └── home/
│           └── page.tsx   # Home page placeholder
├── src/
│   ├── components/        # React components
│   │   ├── SWRProvider.tsx
│   │   ├── ThemeProvider.tsx
│   │   └── ui/
│   │       └── Toast.tsx
│   ├── lib/              # Utilities and helpers
│   ├── hooks/            # Custom React hooks
│   ├── stores/           # Zustand stores
│   ├── types/            # TypeScript types
│   └── design-system/    # Design system components
├── package.json
├── tsconfig.json
├── next.config.ts
└── biome.json
```

## Configuration

### Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp ../.env.example .env.local
```

Required variables:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — Clerk authentication key
- `CLERK_SECRET_KEY` — Clerk secret key
- `NEXT_PUBLIC_MEMORY_API_KEY` — Memory API key
- `NEXT_PUBLIC_MEMORY_API_URL` — Memory API endpoint
- `NEXT_PUBLIC_CRAWLER_API_URL` — Crawler API endpoint
- `NEXT_PUBLIC_APP_URL` — Application URL

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **UI**: React 19 with Server Components
- **Styling**: Tailwind CSS v4 (CSS-native)
- **State Management**: Zustand v5
- **Data Fetching**: SWR v2
- **Authentication**: Clerk
- **Linting**: Biome
- **Testing**: Vitest
- **Fonts**: Syne (display), IBM Plex Mono (mono), Instrument Serif (serif)

## Scripts

- `npm run dev` — Start development server (port 3002)
- `npm run build` — Build for production
- `npm start` — Start production server
- `npm run lint` — Run Biome linter
- `npm run test` — Run tests in watch mode
- `npm run test:run` — Run tests once

## Design System

The platform uses a dark-mode-first design system with:
- **Primary Color**: Amber (#F2A93B)
- **Accent Color**: Violet (#7C5CBF)
- **Background**: Deep void (#03020A)
- **Text**: Light purple (#F0EEF8)

Custom animations and utilities are defined in `app/globals.css`.

## Contributing

1. Create a feature branch
2. Make your changes
3. Run `npm run lint` to check code quality
4. Run `npm run test` to verify tests pass
5. Submit a pull request

## License

Proprietary — ENGRAM Platform
