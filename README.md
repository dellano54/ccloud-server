# CCloud Core

This directory contains the core services and libraries for the CCloud ecosystem.

## Structure

- `backend/`: The main Express.js API server.
- `cgress/`: A high-performance PostgreSQL data access layer.

## Development

This project uses npm workspaces. To get started, run:

```bash
# Install dependencies for all packages
npm install

# Build all packages
npm run build

# Start the backend in development mode
npm run dev:backend
```

## Architecture

CCloud follows a modular architecture where the `backend` consumes the `cgress` library for secure and efficient database operations.
