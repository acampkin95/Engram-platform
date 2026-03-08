# Crawl4AI Frontend

React + Vite frontend for the Crawl4AI OSINT Dashboard.

## Tech Stack

- React 18 with TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- React Router v6 for routing
- Axios for API requests
- WebSocket for real-time updates
- Lucide React for icons

## Getting Started

### Install Dependencies

```bash
npm install
```

### Development

```bash
npm run dev
```

The dev server starts at `http://localhost:3000` with API proxy to `http://localhost:11235`.

### Build

```bash
npm run build
```

### Preview

```bash
npm run preview
```

### Type Checking

```bash
npm run typecheck
```

### Linting

```bash
npm run lint
```

### Testing

```bash
# Run tests
npm test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

## Project Structure

```
src/
├── components/          # React components
│   ├── Navigation.tsx  # Main navigation
│   └── __tests__/      # Component tests
├── context/            # React context providers
│   ├── ThemeContext.tsx
│   └── __tests__/      # Context tests
├── layouts/            # Page layouts
│   └── Dashboard.tsx
├── lib/               # Utility libraries
│   ├── api.ts         # Axios client
│   ├── websocket.ts   # WebSocket client
│   └── __tests__/     # Library tests
├── pages/             # Page components (Task 6)
├── App.tsx           # Main router
├── main.tsx          # Entry point
└── index.css         # Global styles
```

## Features

- Dark mode support
- Responsive navigation
- API client with error handling
- WebSocket client with auto-reconnect
- TypeScript strict mode
- Tailwind CSS styling

## API Integration

All API requests are proxied through Vite to the backend at `http://localhost:11235/api`.

WebSocket connection: `ws://localhost:11235/ws`
