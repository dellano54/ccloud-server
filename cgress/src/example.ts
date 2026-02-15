import { createPoolFromEnv } from './db.js';
import { one, many, exec, batchInsert, safeIdentifier, columns, setIdentifierWhitelist } from './helpers.js';
import type { DatabasePool } from './types.js';

// Define your table whitelist
const TABLE_WHITELIST = new Set([
  'users',
  'posts',
  'comments',
  'categories',
]);

// Set global whitelist
setIdentifierWhitelist(TABLE_WHITELIST);

// Type definitions for your tables
interface User {
  id: number;
  email: string;
  name: string;
  created_at: Date;
}

interface Post {
  id: number;
  user_id: number;
  title: string;
  content: string;
  published: boolean;
  created_at: Date;
}

// Initialize pool
const db: DatabasePool = createPoolFromEnv();

// SELECT examples
async function selectExamples(): Promise<void> {
  console.log('=== SELECT Examples ===\n');
  
  // 1. Get single user by ID
  const user = await one<User>(db, {
    text: 'SELECT id, email, name, created_at FROM users WHERE id = $1',
    values: [1],
  });
  console.log('Single user:', user);
  
  // 2. Get many users with filtering
  const users = await many<User>(db, {
    text: 'SELECT id, email, name, created_at FROM users WHERE created_at > $1 ORDER BY created_at DESC LIMIT $2',
    values: [new Date('2024-01-01'), 10],
  });
  console.log('Recent users:', users);
  
  // 3. Using safeIdentifier for dynamic table/column access
  const tableName = safeIdentifier('users'); // Validates against whitelist
  const columnList = columns(['id', 'email', 'name']);
  
  const dynamicResult = await many<User>(db, {
    text: `SELECT ${columnList} FROM ${tableName} WHERE email LIKE $1`,
    values: ['%@example.com'],
  });
  console.log('Users with example.com emails:', dynamicResult);
}

// INSERT examples
async function insertExamples(): Promise<void> {
  console.log('\n=== INSERT Examples ===\n');
  
  // 1. Single insert with RETURNING
  const newUser = await one<User>(db, {
    text: 'INSERT INTO users (email, name) VALUES ($1, $2) RETURNING id, email, name, created_at',
    values: ['alice@example.com', 'Alice'],
  });
  console.log('Created user:', newUser);
  
  // 2. Batch insert multiple rows
  const batchResult = await batchInsert<Post>(
    db,
    'posts',
    ['user_id', 'title', 'content', 'published'],
    [
      [newUser!.id, 'First Post', 'Hello World', true],
      [newUser!.id, 'Second Post', 'More content', false],
      [newUser!.id, 'Third Post', 'Draft post', false],
    ]
  );
  console.log('Batch insert row count:', batchResult.rowCount);
}

// UPDATE examples
async function updateExamples(): Promise<void> {
  console.log('\n=== UPDATE Examples ===\n');
  
  // 1. Update single row
  const updatedRows = await exec(db, {
    text: 'UPDATE users SET name = $1 WHERE id = $2',
    values: ['Alice Updated', 1],
  });
  console.log('Updated rows:', updatedRows);
  
  // 2. Update with conditions
  const publishedCount = await exec(db, {
    text: 'UPDATE posts SET published = $1 WHERE user_id = $2 AND created_at < $3',
    values: [true, 1, new Date()],
  });
  console.log('Published posts:', publishedCount);
  
  // 3. Update with RETURNING
  const updatedPost = await one<Post>(db, {
    text: 'UPDATE posts SET title = $1 WHERE id = $2 RETURNING *',
    values: ['Updated Title', 1],
  });
  console.log('Updated post:', updatedPost);
}

// Transaction example
async function transactionExample(): Promise<void> {
  console.log('\n=== Transaction Example ===\n');
  
  try {
    const result = await db.transaction(async (tx) => {
      // All operations in this block use the same connection
      // and are part of the same transaction
      
      // 1. Create a user
      const user = await one<User>(tx, {
        text: 'INSERT INTO users (email, name) VALUES ($1, $2) RETURNING *',
        values: ['transaction@example.com', 'Transaction User'],
      });
      
      // 2. Create posts for that user
      await batchInsert<Post>(
        tx,
        'posts',
        ['user_id', 'title', 'content', 'published'],
        [
          [user!.id, 'Transaction Post 1', 'Content 1', true],
          [user!.id, 'Transaction Post 2', 'Content 2', true],
        ]
      );
      
      // 3. Update user with post count
      await exec(tx, {
        text: 'UPDATE users SET name = $1 WHERE id = $2',
        values: [`${user!.name} (2 posts)`, user!.id],
      });
      
      // Return the created user
      return user;
    });
    
    console.log('Transaction completed successfully:', result);
  } catch (error) {
    console.error('Transaction failed:', error);
    throw error;
  }
}

// Prepared statement example
async function preparedStatementExample(): Promise<void> {
  console.log('\n=== Prepared Statement Example ===\n');
  
  // Using named prepared statements for repeated queries
  const userIds = [1, 2, 3, 4, 5];
  
  for (const userId of userIds) {
    const user = await db.query<User>({
      name: 'get-user-by-id', // Prepared statement name
      text: 'SELECT id, email, name FROM users WHERE id = $1',
      values: [userId],
    });
    console.log(`User ${userId}:`, user.rows[0]);
  }
}

// Error handling example
async function errorHandlingExample(): Promise<void> {
  console.log('\n=== Error Handling Example ===\n');
  
  try {
    // This will fail - invalid table name (not in whitelist)
    const tableName = safeIdentifier('malicious_table');
    await db.query({
      text: `SELECT * FROM ${tableName}`,
    });
  } catch (error) {
    console.log('Security error caught:', (error as Error).message);
  }
  
  try {
    // This will fail - SQL injection attempt blocked
    const maliciousInput = "'; DROP TABLE users; --";
    await db.query({
      text: 'SELECT * FROM users WHERE email = $1',
      values: [maliciousInput], // Safe - parameterized
    });
    console.log('Malicious input handled safely');
  } catch (error) {
    console.log('Query error:', (error as Error).message);
  }
}

// Main execution
async function main(): Promise<void> {
  console.log('PostgreSQL Data Access Layer - Examples\n');
  console.log('=====================================\n');
  
  try {
    await selectExamples();
    await insertExamples();
    await updateExamples();
    await transactionExample();
    await preparedStatementExample();
    await errorHandlingExample();
    
    console.log('\n=== All examples completed ===');
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main };
