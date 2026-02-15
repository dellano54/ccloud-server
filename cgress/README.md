# PostgreSQL Data Access Layer

A secure, high-performance PostgreSQL data access layer for Node.js with zero ORM overhead.

## Features

- **Security First**: Parameterized queries enforced at the helper level, SQL injection impossible by construction
- **Performance**: Connection pooling, prepared statements, minimal abstraction layers
- **Type Safety**: Full TypeScript support with typed query results
- **Zero Hidden Queries**: Explicit SQL, no magic, no runtime schema reflection

## Installation

```bash
npm install pg
npm install -D @types/pg typescript
```

## Quick Start

```typescript
import { createPoolFromEnv, one, many, exec } from './index.js';

const db = createPoolFromEnv();

// SELECT single row
const user = await one<User>(db, {
  text: 'SELECT * FROM users WHERE id = $1',
  values: [1],
});

// SELECT many rows
const users = await many<User>(db, {
  text: 'SELECT * FROM users WHERE active = $1',
  values: [true],
});

// INSERT/UPDATE/DELETE
const rowCount = await exec(db, {
  text: 'UPDATE users SET name = $1 WHERE id = $2',
  values: ['New Name', 1],
});

// Transaction
await db.transaction(async (tx) => {
  await tx.query({ text: 'INSERT INTO users...', values: [...] });
  await tx.query({ text: 'INSERT INTO posts...', values: [...] });
});
```

## Configuration

### Environment Variables

```bash
PGHOST=localhost
PGPORT=5432
PGDATABASE=myapp
PGUSER=app_user
PGPASSWORD=secure_password
PGMAXCONNECTIONS=20
PGSTATEMENTTIMEOUT=30000
```

### Programmatic Configuration

```typescript
import { createPool } from './index.js';

const db = createPool({
  host: 'localhost',
  port: 5432,
  database: 'myapp',
  user: 'app_user',
  password: 'secure_password',
  maxConnections: 20,
  minConnections: 2,
  statementTimeoutMs: 30000,
  queryTimeoutMs: 30000,
});
```

## Security

### Identifier Whitelist

Dynamic table/column names are validated against a whitelist:

```typescript
import { setIdentifierWhitelist, safeIdentifier } from './index.js';

setIdentifierWhitelist(new Set(['users', 'posts', 'comments']));

// This will throw if 'malicious_table' is not in the whitelist
const table = safeIdentifier('malicious_table');
```

### Parameterized Queries

All queries must use parameterized values:

```typescript
// ✅ Safe - uses parameters
await db.query({
  text: 'SELECT * FROM users WHERE email = $1',
  values: [userEmail],
});

// ❌ Rejected - string concatenation
await db.query({
  text: `SELECT * FROM users WHERE email = '${userEmail}'`,
});
```

## API Reference

### Query Helpers

- `one<T>(executor, config)` - Returns first row or null
- `many<T>(executor, config)` - Returns all rows as array
- `exec(executor, config)` - Returns affected row count
- `batchInsert<T>(executor, table, columns, rows)` - Batch insert multiple rows

### Transactions

```typescript
await db.transaction(async (tx) => {
  // All queries use same connection
  const user = await one(tx, { ... });
  await exec(tx, { ... });
  // Auto-commit on success, rollback on error
});
```

### Prepared Statements

```typescript
// Named prepared statement (cached by PostgreSQL)
await db.query({
  name: 'get-user-by-id',
  text: 'SELECT * FROM users WHERE id = $1',
  values: [userId],
});
```

## Database Setup

```sql
-- Create application user with least privilege
CREATE USER app_user WITH PASSWORD 'secure_password';

-- Grant specific permissions
GRANT CONNECT ON DATABASE myapp TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Revoke dangerous permissions
REVOKE CREATE ON SCHEMA public FROM app_user;
```

## Documentation

- [API Reference](./docs/API.md) - Complete API documentation
- [Security Guide](./docs/SECURITY.md) - Security best practices and setup
- [Examples](./docs/EXAMPLES.md) - Usage examples and patterns
- [Setup Guide](./docs/SETUP.md) - Installation and configuration
- [Performance Guide](./docs/PERFORMANCE.md) - Optimization and tuning

## License

MIT
