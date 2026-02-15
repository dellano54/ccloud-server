# Setup Guide

## Installation

```bash
# Create project directory
mkdir my-project
cd my-project
npm init -y

# Install dependencies
npm install pg

# Install dev dependencies
npm install -D @types/pg typescript
```

## TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## Database Setup

### 1. Create Database

```bash
# Connect as postgres user
psql -U postgres

# Create database
CREATE DATABASE myapp;

# Verify
\l
```

### 2. Create Application User

```sql
-- Create dedicated user (in psql)
CREATE USER app_user WITH PASSWORD 'your_secure_password';

-- Connect to your database
\c myapp

-- Grant permissions
GRANT CONNECT ON DATABASE myapp TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;

-- Grant table permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;

-- Grant sequence permissions (for SERIAL columns)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Set default permissions for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE ON SEQUENCES TO app_user;
```

### 3. Create Tables

```sql
-- users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- posts table
CREATE TABLE posts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_users_email ON users(email);
```

## Environment Configuration

Create `.env` file:

```bash
# Database connection
PGHOST=localhost
PGPORT=5432
PGDATABASE=myapp
PGUSER=app_user
PGPASSWORD=your_secure_password
PGSSL=false

# Pool configuration
PGMAXCONNECTIONS=20
PGMINCONNECTIONS=2
PGSTATEMENTTIMEOUT=30000
```

Add to `.gitignore`:

```
.env
.env.local
.env.*.local
dist/
node_modules/
```

## Basic Application

```typescript
// src/db.ts
import { createPoolFromEnv, DatabasePool } from 'postgres-dal';

export const db: DatabasePool = createPoolFromEnv();

// Graceful shutdown
process.on('SIGINT', async () => {
  await db.close();
  process.exit(0);
});
```

```typescript
// src/main.ts
import { db } from './db.js';
import { one, many, exec } from 'postgres-dal';

async function main() {
  // Create a user
  const user = await one(db, {
    text: 'INSERT INTO users (email, name) VALUES ($1, $2) RETURNING *',
    values: ['test@example.com', 'Test User'],
  });

  console.log('Created:', user);

  // List all users
  const users = await many(db, {
    text: 'SELECT * FROM users ORDER BY created_at DESC',
  });

  console.log('All users:', users);
}

main().catch(console.error).finally(() => db.close());
```

## Running the Application

```bash
# Compile TypeScript
npx tsc

# Run
node dist/main.js

# Or with ts-node (dev)
npx ts-node src/main.ts

# Or with tsx (faster dev)
npx tsx src/main.ts
```

## Testing

```typescript
// src/db.test.ts
import { createPool } from 'postgres-dal';
import { one, many, exec } from 'postgres-dal';

const testDb = createPool({
  host: 'localhost',
  database: 'myapp_test',
  user: 'app_user',
  password: 'test_password',
  maxConnections: 5,
});

beforeEach(async () => {
  // Clean test data
  await exec(testDb, { text: 'TRUNCATE users, posts CASCADE' });
});

afterAll(async () => {
  await testDb.close();
});

test('create user', async () => {
  const user = await one(testDb, {
    text: 'INSERT INTO users (email, name) VALUES ($1, $2) RETURNING *',
    values: ['test@example.com', 'Test'],
  });

  expect(user).toMatchObject({
    email: 'test@example.com',
    name: 'Test',
  });
});
```

## Docker Setup

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: myapp
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

```bash
# Start database
docker-compose up -d

# Create app user
docker-compose exec postgres psql -U postgres -c "CREATE USER app_user WITH PASSWORD 'app_password';"
docker-compose exec postgres psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE myapp TO app_user;"
```

## Production Deployment

### Environment Variables

```bash
# Use secrets management in production
PGHOST=/cloudsql/project:region:instance
PGUSER=app_user
PGPASSWORD=$(gcloud secrets versions access latest --secret=db-password)
PGSSL=true
PGMAXCONNECTIONS=10  # Lower for serverless
```

### Connection Pool Tuning

| Environment | Max Connections | Min Connections | Timeout |
|-------------|-----------------|-----------------|---------|
| Development | 10 | 1 | 30s |
| Testing | 5 | 0 | 10s |
| Production | 20 | 2 | 30s |
| Serverless | 1-5 | 0 | 10s |

### Health Check

```typescript
// src/health.ts
import { db } from './db.js';
import { one } from 'postgres-dal';

export async function healthCheck(): Promise<boolean> {
  try {
    await one(db, { text: 'SELECT 1' });
    return true;
  } catch {
    return false;
  }
}
```

### Monitoring

```typescript
// Log slow queries
db.pool.on('connect', () => {
  console.log('New client connected');
});

db.pool.on('error', (err) => {
  console.error('Pool error:', err);
});

// Track query performance
const start = Date.now();
const result = await db.query({ ... });
const duration = Date.now() - start;

if (duration > 1000) {
  console.warn(`Slow query (${duration}ms):`, query.text);
}
```
