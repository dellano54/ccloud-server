# Security Guide

## SQL Injection Prevention

This library makes SQL injection **impossible by construction** through multiple defense layers.

### Layer 1: Parameterized Queries (Enforced)

All values must be passed via the `values` array. String concatenation is detected and rejected.

```typescript
// ✅ SAFE - Values are parameterized
await db.query({
  text: 'SELECT * FROM users WHERE email = $1',
  values: [userInput],
});

// ❌ REJECTED - Pattern detection fails
await db.query({
  text: `SELECT * FROM users WHERE email = '${userInput}'`,
});
```

### Layer 2: Unsafe Pattern Detection

The query validator rejects known dangerous patterns:

```typescript
// These patterns trigger SecurityError:
/;\s*drop\s+/i           // DROP statements
/;\s*delete\s+from\s+/i  // DELETE without WHERE
/union\s+select\s+/i      // UNION injection
/\/\*!\d+\s+/i            // MySQL conditional comments
/exec\s*\(/i              // EXEC calls
```

### Layer 3: Identifier Whitelist

Dynamic table/column names must be explicitly whitelisted:

```typescript
import { setIdentifierWhitelist, safeIdentifier } from 'postgres-dal';

setIdentifierWhitelist(new Set(['users', 'posts', 'comments']));

// ✅ ALLOWED
safeIdentifier('users');  // Returns: "users"

// ❌ REJECTED
safeIdentifier('users; DROP TABLE users; --');
// Throws: SecurityError: Identifier contains invalid characters
```

---

## Identifier Validation Rules

Identifiers must pass all checks:

1. **Whitelist Check**: Must be in the global whitelist (if set)
2. **Length Check**: Max 63 characters (PostgreSQL limit)
3. **Null Byte Check**: Cannot contain `\0`
4. **Character Check**: Must match `/^[a-zA-Z_][a-zA-Z0-9_$]*$/`
5. **Quoting**: Always returned double-quoted

```typescript
// Valid identifiers
safeIdentifier('users');        // "users"
safeIdentifier('user_id');      // "user_id"
safeIdentifier('_temp');        // "_temp"

// Invalid identifiers
safeIdentifier('users;drop');   // SecurityError: invalid characters
safeIdentifier('a'.repeat(64)); // SecurityError: exceeds 63 chars
safeIdentifier('users--');      // SecurityError: invalid characters
```

---

## Least-Privilege Database Setup

### 1. Create Application User

```sql
-- Create dedicated application user
CREATE USER app_user WITH PASSWORD 'strong_random_password';

-- Prevent user from creating objects
ALTER USER app_user WITH NOCREATEDB NOCREATEROLE NOSUPERUSER;
```

### 2. Grant Specific Permissions

```sql
-- Connect to database
GRANT CONNECT ON DATABASE myapp TO app_user;

-- Schema usage
GRANT USAGE ON SCHEMA public TO app_user;

-- Table permissions (specific, not ALL)
GRANT SELECT, INSERT, UPDATE, DELETE ON users TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON posts TO app_user;
GRANT SELECT ON audit_log TO app_user;  -- Read-only

-- Sequence permissions (for SERIAL columns)
GRANT USAGE ON SEQUENCE users_id_seq TO app_user;
GRANT USAGE ON SEQUENCE posts_id_seq TO app_user;

-- Default permissions for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE ON SEQUENCES TO app_user;
```

### 3. Row-Level Security (RLS)

```sql
-- Enable RLS on tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY users_own_data ON users
  FOR ALL
  TO app_user
  USING (id = current_setting('app.current_user_id')::int);

CREATE POLICY posts_own_data ON posts
  FOR ALL
  TO app_user
  USING (user_id = current_setting('app.current_user_id')::int);
```

### 4. Connection Limits

```sql
-- Limit concurrent connections per user
ALTER USER app_user WITH CONNECTION LIMIT 10;
```

---

## Prepared Statements

Use named prepared statements for frequently executed queries:

```typescript
// First execution: PostgreSQL parses and plans
await db.query({
  name: 'get-user-by-email',
  text: 'SELECT * FROM users WHERE email = $1',
  values: ['alice@example.com'],
});

// Subsequent executions: Reuse cached plan
await db.query({
  name: 'get-user-by-email',
  text: 'SELECT * FROM users WHERE email = $1',
  values: ['bob@example.com'],
});
```

**Benefits:**
- Prevents SQL injection (plan is cached, values are bound)
- Improves performance (skip parse/plan phase)
- Reduces memory usage on PostgreSQL

---

## Transaction Security

### Automatic Rollback

Transactions automatically rollback on error:

```typescript
try {
  await db.transaction(async (tx) => {
    await tx.query({ text: 'INSERT INTO users...', values: [...] });
    await tx.query({ text: 'INSERT INTO posts...', values: [...] });
    throw new Error('Something went wrong');
    // Automatic ROLLBACK happens here
  });
} catch (error) {
  // Database is unchanged
}
```

### Manual Control

```typescript
await db.transaction(async (tx) => {
  // ... queries ...
  
  if (shouldAbort) {
    await tx.rollback();
    return;
  }
  
  await tx.commit();
});
```

---

## Environment Security

### Never Commit Secrets

```bash
# .env (add to .gitignore!)
PGHOST=localhost
PGPORT=5432
PGDATABASE=myapp
PGUSER=app_user
PGPASSWORD=your_strong_password_here
PGSSL=true
```

### Use Secrets Management

```typescript
// For production, use a secrets manager
import { createPool } from 'postgres-dal';
import { getSecret } from './secrets.js';

const dbPassword = await getSecret('db-password');

const db = createPool({
  host: process.env.PGHOST,
  password: dbPassword, // From secrets manager
  // ...
});
```

---

## Security Checklist

- [ ] Application user has minimal permissions (no CREATE, DROP)
- [ ] Connection limits set on database user
- [ ] SSL enabled for production connections
- [ ] Identifier whitelist configured
- [ ] Strong database passwords
- [ ] Secrets not committed to version control
- [ ] Row-level security enabled where needed
- [ ] Query timeouts configured
- [ ] Audit logging enabled on PostgreSQL
