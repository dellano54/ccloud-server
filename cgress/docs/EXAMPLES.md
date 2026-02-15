# Usage Examples

## Basic CRUD Operations

### Create (INSERT)

```typescript
import { createPoolFromEnv, one, exec } from 'postgres-dal';

const db = createPoolFromEnv();

// Insert with RETURNING
const newUser = await one<{ id: number; email: string }>(db, {
  text: 'INSERT INTO users (email, name) VALUES ($1, $2) RETURNING id, email',
  values: ['alice@example.com', 'Alice'],
});

console.log('Created user:', newUser);
// { id: 1, email: 'alice@example.com' }

// Insert without returning (get row count)
const inserted = await exec(db, {
  text: 'INSERT INTO logs (message) VALUES ($1)',
  values: ['User created'],
});

console.log('Rows inserted:', inserted);
```

### Read (SELECT)

```typescript
import { one, many } from 'postgres-dal';

// Get single user
const user = await one<{
  id: number;
  email: string;
  name: string;
}>(db, {
  text: 'SELECT id, email, name FROM users WHERE id = $1',
  values: [1],
});

// Get many users with filtering
const activeUsers = await many<{
  id: number;
  email: string;
}>(db, {
  text: `
    SELECT id, email 
    FROM users 
    WHERE active = $1 
    ORDER BY created_at DESC 
    LIMIT $2 OFFSET $3
  `,
  values: [true, 10, 0],
});

// Search with pattern
const searchResults = await many(db, {
  text: 'SELECT * FROM users WHERE email ILIKE $1',
  values: ['%@example.com'],
});
```

### Update

```typescript
import { exec, one } from 'postgres-dal';

// Update with row count
const updated = await exec(db, {
  text: 'UPDATE users SET name = $1 WHERE id = $2',
  values: ['Alice Smith', 1],
});

console.log('Rows updated:', updated);

// Update with RETURNING
const updatedUser = await one(db, {
  text: 'UPDATE users SET name = $1 WHERE id = $2 RETURNING *',
  values: ['Alice Smith', 1],
});
```

### Delete

```typescript
import { exec } from 'postgres-dal';

const deleted = await exec(db, {
  text: 'DELETE FROM users WHERE id = $1',
  values: [1],
});

console.log('Rows deleted:', deleted);
```

---

## Batch Operations

### Batch Insert

```typescript
import { batchInsert } from 'postgres-dal';

// Insert multiple rows efficiently
await batchInsert(db, 'posts', ['user_id', 'title', 'content'], [
  [1, 'Post 1', 'Content 1'],
  [1, 'Post 2', 'Content 2'],
  [2, 'Post 3', 'Content 3'],
]);
```

### Batch Update (Transaction)

```typescript
await db.transaction(async (tx) => {
  for (const user of usersToUpdate) {
    await exec(tx, {
      text: 'UPDATE users SET name = $1 WHERE id = $2',
      values: [user.name, user.id],
    });
  }
});
```

---

## Transactions

### Basic Transaction

```typescript
await db.transaction(async (tx) => {
  // Create user
  const user = await one(tx, {
    text: 'INSERT INTO users (email) VALUES ($1) RETURNING id',
    values: ['user@example.com'],
  });

  // Create profile
  await exec(tx, {
    text: 'INSERT INTO profiles (user_id, bio) VALUES ($1, $2)',
    values: [user!.id, 'Hello!'],
  });

  // Log action
  await exec(tx, {
    text: 'INSERT INTO audit_log (action, user_id) VALUES ($1, $2)',
    values: ['user_created', user!.id],
  });

  // All succeed or all rollback
});
```

### Transaction with Error Handling

```typescript
try {
  const result = await db.transaction(async (tx) => {
    const account = await one(tx, {
      text: 'SELECT balance FROM accounts WHERE id = $1',
      values: [fromAccountId],
    });

    if (!account || account.balance < amount) {
      throw new Error('Insufficient funds');
    }

    await exec(tx, {
      text: 'UPDATE accounts SET balance = balance - $1 WHERE id = $2',
      values: [amount, fromAccountId],
    });

    await exec(tx, {
      text: 'UPDATE accounts SET balance = balance + $1 WHERE id = $2',
      values: [amount, toAccountId],
    });

    return { transferred: amount };
  });

  console.log('Transfer successful:', result);
} catch (error) {
  console.error('Transfer failed:', error);
  // Funds remain unchanged due to automatic rollback
}
```

### Read-Only Transaction

```typescript
import { createTransactionHelper } from 'postgres-dal';

const { transactionWithOptions } = createTransactionHelper(db.pool);

const report = await transactionWithOptions(
  async (tx) => {
    const users = await many(tx, {
      text: 'SELECT COUNT(*) as count FROM users',
    });
    const posts = await many(tx, {
      text: 'SELECT COUNT(*) as count FROM posts',
    });
    return { users, posts };
  },
  { isolationLevel: 'SERIALIZABLE', readOnly: true }
);
```

---

## Dynamic Queries

### Safe Dynamic Table Names

```typescript
import { setIdentifierWhitelist, safeIdentifier, columns } from 'postgres-dal';

// Define allowed tables
setIdentifierWhitelist(new Set(['users', 'posts', 'comments']));

function getTableData(tableName: string, columnList: string[]) {
  // Validates against whitelist
  const table = safeIdentifier(tableName);
  const cols = columns(columnList);

  return many(db, {
    text: `SELECT ${cols} FROM ${table} LIMIT 100`,
  });
}

// ✅ Works
const users = await getTableData('users', ['id', 'email']);

// ❌ Throws SecurityError
const hacked = await getTableData('users; DROP TABLE users; --', ['*']);
```

### Conditional WHERE Clauses

```typescript
interface SearchParams {
  email?: string;
  name?: string;
  active?: boolean;
}

async function searchUsers(params: SearchParams) {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (params.email) {
    values.push(`%${params.email}%`);
    conditions.push(`email ILIKE $${values.length}`);
  }

  if (params.name) {
    values.push(`%${params.name}%`);
    conditions.push(`name ILIKE $${values.length}`);
  }

  if (params.active !== undefined) {
    values.push(params.active);
    conditions.push(`active = $${values.length}`);
  }

  const whereClause = conditions.length > 0 
    ? `WHERE ${conditions.join(' AND ')}` 
    : '';

  return many(db, {
    text: `SELECT * FROM users ${whereClause} ORDER BY created_at DESC`,
    values,
  });
}

// Usage
const results = await searchUsers({ email: 'alice', active: true });
```

---

## Prepared Statements

### Named Prepared Statements

```typescript
// Define once, execute many times
const getUserById = {
  name: 'get-user-by-id',
  text: 'SELECT id, email, name FROM users WHERE id = $1',
};

// First call: parse and plan
const user1 = await db.query({ ...getUserById, values: [1] });

// Subsequent calls: reuse plan
const user2 = await db.query({ ...getUserById, values: [2] });
const user3 = await db.query({ ...getUserById, values: [3] });
```

### Prepared Statement Cache

```typescript
class UserRepository {
  private statements = {
    getById: {
      name: 'user-get-by-id',
      text: 'SELECT * FROM users WHERE id = $1',
    },
    getByEmail: {
      name: 'user-get-by-email',
      text: 'SELECT * FROM users WHERE email = $1',
    },
    updateName: {
      name: 'user-update-name',
      text: 'UPDATE users SET name = $1 WHERE id = $2',
    },
  };

  async getById(id: number) {
    return one(db, { ...this.statements.getById, values: [id] });
  }

  async getByEmail(email: string) {
    return one(db, { ...this.statements.getByEmail, values: [email] });
  }

  async updateName(id: number, name: string) {
    return exec(db, { ...this.statements.updateName, values: [name, id] });
  }
}
```

---

## Advanced Patterns

### Repository Pattern

```typescript
import { DatabasePool, one, many, exec } from 'postgres-dal';

interface User {
  id: number;
  email: string;
  name: string;
  createdAt: Date;
}

class UserRepository {
  constructor(private db: DatabasePool) {}

  async findById(id: number): Promise<User | null> {
    return one<User>(this.db, {
      text: 'SELECT * FROM users WHERE id = $1',
      values: [id],
    });
  }

  async findAll(limit = 100): Promise<User[]> {
    return many<User>(this.db, {
      text: 'SELECT * FROM users ORDER BY created_at DESC LIMIT $1',
      values: [limit],
    });
  }

  async create(email: string, name: string): Promise<User> {
    return one<User>(this.db, {
      text: 'INSERT INTO users (email, name) VALUES ($1, $2) RETURNING *',
      values: [email, name],
    }) as Promise<User>;
  }

  async update(id: number, updates: Partial<User>): Promise<number> {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.name) {
      values.push(updates.name);
      fields.push(`name = $${values.length}`);
    }

    if (updates.email) {
      values.push(updates.email);
      fields.push(`email = $${values.length}`);
    }

    if (fields.length === 0) return 0;

    values.push(id);
    return exec(this.db, {
      text: `UPDATE users SET ${fields.join(', ')} WHERE id = $${values.length}`,
      values,
    });
  }

  async delete(id: number): Promise<number> {
    return exec(this.db, {
      text: 'DELETE FROM users WHERE id = $1',
      values: [id],
    });
  }
}

// Usage
const users = new UserRepository(db);
const user = await users.create('alice@example.com', 'Alice');
```

### Connection Cleanup

```typescript
import { createPoolFromEnv } from 'postgres-dal';

const db = createPoolFromEnv();

async function main() {
  try {
    // ... your code ...
  } finally {
    // Always close the pool
    await db.close();
  }
}

// Or with process handlers
process.on('SIGINT', async () => {
  await db.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await db.close();
  process.exit(0);
});
```
