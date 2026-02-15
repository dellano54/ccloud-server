# Performance Guide

## Connection Pooling

### How It Works

The library uses `node-postgres` Pool which maintains persistent connections:

```
┌─────────────────┐
│   Application   │
└────────┬────────┘
         │
    ┌────┴────┐
    │  Pool   │  ← Maintains 2-20 connections
    └────┬────┘
         │
    ┌────┴────┐
    │PostgreSQL│
    └─────────┘
```

### Pool Configuration

```typescript
const db = createPool({
  // Minimum connections to maintain
  minConnections: 2,
  
  // Maximum connections (hard limit)
  maxConnections: 20,
  
  // Close idle connections after 30s
  idleTimeoutMs: 30000,
  
  // Fail if connection takes >5s
  connectionTimeoutMs: 5000,
});
```

### Pool Sizing Formula

```
max_connections = (CPU_cores * 2) + effective_spindle_count

For cloud databases:
- Small (1-2 vCPU): 10-20 connections
- Medium (4 vCPU): 20-40 connections  
- Large (8+ vCPU): 40-100 connections
```

### Per-Application Limits

If multiple app servers connect to one database:

```
db_max_connections = 100
app_servers = 5
connections_per_app = 100 / 5 = 20
```

---

## Query Optimization

### Use Prepared Statements

```typescript
// ❌ Without prepared statement (parse + plan every time)
for (let i = 0; i < 1000; i++) {
  await db.query({
    text: 'SELECT * FROM users WHERE id = $1',
    values: [i],
  });
}

// ✅ With prepared statement (parse + plan once)
for (let i = 0; i < 1000; i++) {
  await db.query({
    name: 'get-user',
    text: 'SELECT * FROM users WHERE id = $1',
    values: [i],
  });
}
```

**Performance Gain:** 20-30% faster for repeated queries

### Batch Operations

```typescript
// ❌ Individual inserts (N round trips)
for (const user of users) {
  await db.query({
    text: 'INSERT INTO users (email) VALUES ($1)',
    values: [user.email],
  });
}

// ✅ Batch insert (1 round trip)
import { batchInsert } from 'postgres-dal';

await batchInsert(
  db,
  'users',
  ['email'],
  users.map(u => [u.email])
);
```

**Performance Gain:** 10-100x faster for bulk operations

### Select Only Needed Columns

```typescript
// ❌ Fetching everything
const result = await db.query({ text: 'SELECT * FROM users' });

// ✅ Fetching only needed columns
const result = await db.query({
  text: 'SELECT id, email FROM users',
});
```

**Performance Gain:** 50-90% less data transfer

---

## Indexing Strategy

### Essential Indexes

```sql
-- Primary keys (automatic)
PRIMARY KEY (id)

-- Foreign keys (manual)
CREATE INDEX idx_posts_user_id ON posts(user_id);

-- Search columns
CREATE INDEX idx_users_email ON users(email);

-- Composite indexes
CREATE INDEX idx_posts_user_published 
  ON posts(user_id, published) 
  WHERE published = true;

-- Partial indexes (smaller, faster)
CREATE INDEX idx_active_users ON users(email) WHERE active = true;
```

### Index Trade-offs

| Operation | Without Index | With Index |
|-----------|---------------|------------|
| SELECT (indexed) | O(n) | O(log n) |
| INSERT | O(1) | O(log n) |
| UPDATE | O(1) | O(log n) |
| DELETE | O(1) | O(log n) |
| Storage | Less | More |

### When NOT to Index

```sql
-- Don't index low-cardinality columns
CREATE INDEX idx_boolean ON users(active);  -- Only 2 values

-- Don't index frequently updated columns
CREATE INDEX idx_login_count ON users(login_count);  -- Updated often

-- Don't index small tables (< 1000 rows)
-- Sequential scan is faster
```

---

## Transaction Performance

### Keep Transactions Short

```typescript
// ❌ Long transaction (holds locks)
await db.transaction(async (tx) => {
  await tx.query({ ... });  // 10ms
  await fetchExternalAPI();  // 500ms ← Lock held!
  await tx.query({ ... });  // 10ms
});

// ✅ Short transaction
const externalData = await fetchExternalAPI();  // 500ms, no lock

await db.transaction(async (tx) => {
  await tx.query({ ... });  // 10ms
  await tx.query({ ... });  // 10ms
  // Total: 20ms with lock
});
```

### Use Appropriate Isolation Level

```typescript
import { createTransactionHelper } from 'postgres-dal';

const { transactionWithOptions } = createTransactionHelper(db.pool);

// Read-only reports (weakest isolation, best performance)
await transactionWithOptions(
  async (tx) => { /* read queries */ },
  { isolationLevel: 'READ COMMITTED', readOnly: true }
);

// Critical financial data (strongest isolation)
await transactionWithOptions(
  async (tx) => { /* transfer logic */ },
  { isolationLevel: 'SERIALIZABLE' }
);
```

| Isolation Level | Dirty Read | Non-Repeatable | Phantom | Performance |
|-----------------|------------|----------------|---------|-------------|
| READ UNCOMMITTED | Yes | Yes | Yes | Fastest |
| READ COMMITTED | No | Yes | Yes | Fast |
| REPEATABLE READ | No | No | Yes | Medium |
| SERIALIZABLE | No | No | No | Slowest |

---

## Query Timeout Configuration

### Statement Timeout

```typescript
const db = createPool({
  // Kill queries running > 30 seconds
  statementTimeoutMs: 30000,
});
```

### Query Timeout

```typescript
const db = createPool({
  // Abort query if no response in 30 seconds
  queryTimeoutMs: 30000,
});
```

### Per-Query Override

```typescript
// Fast query - short timeout
await db.query({
  text: 'SELECT * FROM users WHERE id = $1',
  values: [1],
  // Uses pool default (30s)
});

// Slow report - longer timeout
await db.query({
  text: 'SELECT * FROM complex_analytics_view',
  // Consider using a separate pool for analytics
});
```

---

## Memory Management

### Result Set Streaming

For large result sets, use cursors:

```typescript
const client = await db.pool.connect();

try {
  await client.query('BEGIN');
  
  const cursor = await client.query({
    text: 'DECLARE my_cursor CURSOR FOR SELECT * FROM large_table',
  });
  
  let batch;
  do {
    batch = await client.query('FETCH 1000 FROM my_cursor');
    // Process batch.rows
  } while (batch.rows.length === 1000);
  
  await client.query('CLOSE my_cursor');
  await client.query('COMMIT');
} finally {
  client.release();
}
```

### Pagination

```typescript
// ❌ OFFSET (slow for large pages)
await db.query({
  text: 'SELECT * FROM users ORDER BY id LIMIT $1 OFFSET $2',
  values: [10, 100000],  // Scans 100,010 rows!
});

// ✅ Keyset pagination (fast)
await db.query({
  text: 'SELECT * FROM users WHERE id > $1 ORDER BY id LIMIT $2',
  values: [lastSeenId, 10],  // Index seek only
});
```

---

## Monitoring

### Pool Metrics

```typescript
// Log pool status every minute
setInterval(() => {
  console.log('Pool status:', {
    total: db.pool.totalCount,
    idle: db.pool.idleCount,
    waiting: db.pool.waitingCount,
  });
}, 60000);
```

### Query Performance Logging

```typescript
async function timedQuery<T>(label: string, config: QueryConfig) {
  const start = performance.now();
  try {
    return await db.query<T>(config);
  } finally {
    const duration = performance.now() - start;
    console.log(`[${label}] ${duration.toFixed(2)}ms`);
    
    if (duration > 1000) {
      console.warn('Slow query detected:', config.text);
    }
  }
}
```

### PostgreSQL Statistics

```sql
-- Find slow queries
SELECT 
  query,
  calls,
  mean_exec_time,
  total_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Check index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Check table bloat
SELECT 
  schemaname,
  tablename,
  n_tup_ins,
  n_tup_upd,
  n_tup_del
FROM pg_stat_user_tables
WHERE n_tup_del > n_tup_ins * 0.1;
```

---

## Benchmarks

### Expected Performance

| Operation | Latency (local) | Latency (network) |
|-----------|-----------------|-------------------|
| Simple SELECT | 0.1-0.5ms | 1-5ms |
| Simple INSERT | 0.5-1ms | 2-10ms |
| Transaction (2 ops) | 1-2ms | 5-20ms |
| Batch Insert (100) | 2-5ms | 10-50ms |
| Prepared Statement | 0.05-0.2ms | 0.5-2ms |

### Load Test Example

```typescript
import { createPool, many } from 'postgres-dal';

const db = createPool({ maxConnections: 20 });

async function loadTest() {
  const start = Date.now();
  const concurrent = 100;
  
  const promises = Array(concurrent).fill(null).map(() =>
    many(db, {
      text: 'SELECT * FROM users WHERE active = $1 LIMIT 10',
      values: [true],
    })
  );
  
  await Promise.all(promises);
  
  const duration = Date.now() - start;
  console.log(`${concurrent} queries in ${duration}ms`);
  console.log(`Throughput: ${(concurrent / (duration / 1000)).toFixed(0)} req/s`);
}

loadTest().finally(() => db.close());
```
