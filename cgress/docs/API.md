# API Reference

## Core Functions

### `createPool(config)`

Creates a new PostgreSQL connection pool with security and performance defaults.

```typescript
import { createPool } from 'postgres-dal';

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

**Parameters:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `host` | string | 'localhost' | PostgreSQL server host |
| `port` | number | 5432 | PostgreSQL server port |
| `database` | string | 'postgres' | Database name |
| `user` | string | 'postgres' | Database user |
| `password` | string | '' | Database password |
| `ssl` | boolean \| object | undefined | SSL configuration |
| `maxConnections` | number | 20 | Maximum pool connections |
| `minConnections` | number | 2 | Minimum pool connections |
| `connectionTimeoutMs` | number | 5000 | Connection timeout |
| `idleTimeoutMs` | number | 30000 | Idle connection timeout |
| `statementTimeoutMs` | number | 30000 | Per-statement timeout |
| `queryTimeoutMs` | number | 30000 | Query execution timeout |

**Returns:** `DatabasePool`

---

### `createPoolFromEnv()`

Creates a pool from environment variables.

```typescript
const db = createPoolFromEnv();
```

**Environment Variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `PGHOST` | localhost | Server host |
| `PGPORT` | 5432 | Server port |
| `PGDATABASE` | postgres | Database name |
| `PGUSER` | postgres | Database user |
| `PGPASSWORD` | '' | Database password |
| `PGSSL` | false | Enable SSL |
| `PGMAXCONNECTIONS` | 20 | Max connections |
| `PGMINCONNECTIONS` | 2 | Min connections |
| `PGSTATEMENTTIMEOUT` | 30000 | Statement timeout (ms) |

---

## Query Helpers

### `one<T>(executor, config)`

Executes a query and returns the first row or `null`.

```typescript
const user = await one<User>(db, {
  text: 'SELECT * FROM users WHERE id = $1',
  values: [1],
});
// Returns: User | null
```

**Parameters:**
- `executor`: `QueryExecutor` (db pool or transaction client)
- `config`: `QueryConfig` with `text` and optional `values`

**Returns:** `Promise<T | null>`

---

### `many<T>(executor, config)`

Executes a query and returns all rows as an array.

```typescript
const users = await many<User>(db, {
  text: 'SELECT * FROM users WHERE active = $1',
  values: [true],
});
// Returns: User[]
```

**Returns:** `Promise<T[]>`

---

### `exec(executor, config)`

Executes a query and returns the affected row count.

```typescript
const updated = await exec(db, {
  text: 'UPDATE users SET name = $1 WHERE id = $2',
  values: ['New Name', 1],
});
// Returns: number (rows affected)
```

**Returns:** `Promise<number>`

---

### `batchInsert<T>(executor, table, columns, rows, whitelist?)`

Inserts multiple rows in a single query.

```typescript
await batchInsert<Post>(db, 'posts', ['user_id', 'title'], [
  [1, 'Post 1'],
  [1, 'Post 2'],
  [2, 'Post 3'],
]);
```

**Parameters:**
- `executor`: `QueryExecutor`
- `table`: Table name (validated against whitelist)
- `columns`: Array of column names
- `rows`: Array of value arrays
- `whitelist`: Optional override for identifier whitelist

**Returns:** `Promise<QueryResult<T>>`

---

## Security Helpers

### `safeIdentifier(identifier, whitelist?)`

Validates and quotes a SQL identifier (table/column name).

```typescript
import { setIdentifierWhitelist, safeIdentifier } from 'postgres-dal';

setIdentifierWhitelist(new Set(['users', 'posts']));

const table = safeIdentifier('users'); // Returns: "users"
const bad = safeIdentifier('hack');    // Throws: SecurityError
```

**Validation Rules:**
- Must be in whitelist (if whitelist is set)
- Max 63 characters
- No null bytes
- Must match `/^[a-zA-Z_][a-zA-Z0-9_$]*$/`
- Returns double-quoted identifier

---

### `safeIdentifiers(identifiers, whitelist?)`

Validates and quotes multiple identifiers.

```typescript
const cols = safeIdentifiers(['id', 'email', 'name']);
// Returns: ['"id"', '"email"', '"name"']
```

---

### `columns(cols, whitelist?)`

Joins validated column names for SELECT/INSERT.

```typescript
const colList = columns(['id', 'email']);
// Returns: '"id", "email"'
```

---

### `setIdentifierWhitelist(whitelist)`

Sets the global identifier whitelist.

```typescript
setIdentifierWhitelist(new Set(['users', 'posts', 'comments']));
```

---

## Transactions

### `db.transaction(fn)`

Executes a function within a database transaction.

```typescript
await db.transaction(async (tx) => {
  const user = await one<User>(tx, {
    text: 'INSERT INTO users (email) VALUES ($1) RETURNING *',
    values: ['test@example.com'],
  });
  
  await exec(tx, {
    text: 'INSERT INTO posts (user_id, title) VALUES ($1, $2)',
    values: [user!.id, 'Hello'],
  });
  
  // Auto-commits on success
  // Auto-rollback on error
});
```

**Transaction Client Methods:**
- `query(config)` - Execute query within transaction
- `commit()` - Commit transaction manually
- `rollback()` - Rollback transaction manually
- `release()` - Release connection (auto-rollback if not committed)

---

## Direct Pool Query

### `db.query(config)`

Execute a query directly on the pool.

```typescript
// Basic query
const result = await db.query({
  text: 'SELECT * FROM users WHERE id = $1',
  values: [1],
});

// Prepared statement (named)
const result = await db.query({
  name: 'get-user',
  text: 'SELECT * FROM users WHERE id = $1',
  values: [1],
});
```

---

## Pool Management

### `db.close()`

Gracefully closes the connection pool.

```typescript
await db.close();
```

---

## Error Types

### `DatabaseError`

```typescript
class DatabaseError extends Error {
  code?: string;      // PostgreSQL error code
  query?: string;     // Query that failed
  cause?: unknown;    // Original error
}
```

### `SecurityError`

```typescript
class SecurityError extends Error {
  // Thrown for whitelist violations, unsafe SQL patterns
}
```

---

## Type Definitions

```typescript
interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean | object;
  maxConnections: number;
  minConnections: number;
  connectionTimeoutMs: number;
  idleTimeoutMs: number;
  statementTimeoutMs: number;
  queryTimeoutMs: number;
}

interface QueryConfig<R = any> {
  text: string;
  values?: unknown[];
  name?: string;  // For prepared statements
}

interface QueryExecutor {
  query<R>(config: QueryConfig<R>): Promise<QueryResult<R>>;
}

interface TransactionClient extends QueryExecutor {
  commit(): Promise<void>;
  rollback(): Promise<void>;
  release(): Promise<void>;
}

interface DatabasePool extends QueryExecutor {
  pool: Pool;
  transaction<T>(fn: (client: TransactionClient) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
```
