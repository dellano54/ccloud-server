import type { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import type { 
  QueryConfig, 
  QueryExecutor, 
  TransactionClient, 
  IdentifierWhitelist 
} from './types.js';
import { QueryExecutorImpl } from './query.js';
import { DatabaseError, SecurityError } from './types.js';

// Module-level whitelist for identifiers
let globalWhitelist: IdentifierWhitelist = new Set();

export function setIdentifierWhitelist(whitelist: IdentifierWhitelist): void {
  globalWhitelist = whitelist;
}

// Validate and quote identifiers (table names, column names)
export function safeIdentifier(
  identifier: string, 
  whitelist?: IdentifierWhitelist
): string {
  const effectiveWhitelist = whitelist || globalWhitelist;
  
  if (effectiveWhitelist.size > 0 && !effectiveWhitelist.has(identifier)) {
    throw new SecurityError(
      `Identifier "${identifier}" is not in the whitelist`
    );
  }
  
  // PostgreSQL identifier rules:
  // - Max 63 characters (NAMEDATALEN - 1)
  // - Cannot contain null bytes
  // - Double quotes for escaping
  if (identifier.length > 63) {
    throw new SecurityError(
      `Identifier "${identifier}" exceeds maximum length of 63 characters`
    );
  }
  
  if (identifier.includes('\0')) {
    throw new SecurityError('Identifier contains null bytes');
  }
  
  // Check for valid identifier characters
  // PostgreSQL identifiers: letters, digits, underscores, $ (though $ is discouraged)
  // Must start with letter or underscore
  if (!/^[a-zA-Z_][a-zA-Z0-9_$]*$/.test(identifier)) {
    throw new SecurityError(
      `Identifier "${identifier}" contains invalid characters`
    );
  }
  
  // Return properly quoted identifier to handle reserved words safely
  return `"${identifier}"`;
}

// Quote multiple identifiers
export function safeIdentifiers(
  identifiers: string[], 
  whitelist?: IdentifierWhitelist
): string[] {
  return identifiers.map(id => safeIdentifier(id, whitelist));
}

// Build a safe column list for SELECT/INSERT
export function columns(cols: string[], whitelist?: IdentifierWhitelist): string {
  return safeIdentifiers(cols, whitelist).join(', ');
}

// Result helpers
export async function one<R extends QueryResultRow>(
  executor: QueryExecutor,
  config: QueryConfig
): Promise<R | null> {
  const result = await executor.query<R>(config);
  return result.rows[0] || null;
}

export async function many<R extends QueryResultRow>(
  executor: QueryExecutor,
  config: QueryConfig
): Promise<R[]> {
  const result = await executor.query<R>(config);
  return result.rows;
}

export async function exec(
  executor: QueryExecutor,
  config: QueryConfig
): Promise<number> {
  const result = await executor.query(config);
  return result.rowCount || 0;
}

// Batch operations helper
export async function batchInsert<R extends QueryResultRow>(
  executor: QueryExecutor,
  table: string,
  columns: string[],
  rows: unknown[][],
  whitelist?: IdentifierWhitelist
): Promise<QueryResult<R>> {
  if (rows.length === 0) {
    throw new DatabaseError('Cannot insert empty batch');
  }
  
  const safeTable = safeIdentifier(table, whitelist);
  const safeColumns = safeIdentifiers(columns, whitelist);
  
  // Build parameterized values
  const values: unknown[] = [];
  const valuePlaceholders: string[] = [];
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.length !== columns.length) {
      throw new DatabaseError(
        `Row ${i} has ${row.length} values but ${columns.length} columns expected`
      );
    }
    
    const rowPlaceholders: string[] = [];
    for (let j = 0; j < row.length; j++) {
      values.push(row[j]);
      rowPlaceholders.push(`$${values.length}`);
    }
    valuePlaceholders.push(`(${rowPlaceholders.join(', ')})`);
  }
  
  const text = `INSERT INTO ${safeTable} (${safeColumns.join(', ')}) VALUES ${valuePlaceholders.join(', ')}`;
  
  return executor.query<R>({ text, values });
}

// Transaction management
class TransactionClientImpl implements TransactionClient {
  private executor: QueryExecutorImpl;
  private released = false;
  private committed = false;
  
  constructor(private client: PoolClient) {
    this.executor = new QueryExecutorImpl(client);
  }
  
  async query<R extends QueryResultRow = QueryResultRow>(
    configOrText: QueryConfig | string,
    values?: unknown[]
  ): Promise<import('pg').QueryResult<R>> {
    this.ensureActive();
    return this.executor.query(configOrText, values);
  }
  
  async commit(): Promise<void> {
    this.ensureActive();
    await this.client.query('COMMIT');
    this.committed = true;
  }
  
  async rollback(): Promise<void> {
    this.ensureActive();
    await this.client.query('ROLLBACK');
  }
  
  async release(): Promise<void> {
    if (!this.released) {
      if (!this.committed) {
        // Auto-rollback if not committed
        try {
          await this.client.query('ROLLBACK');
        } catch {
          // Ignore rollback errors during cleanup
        }
      }
      this.client.release();
      this.released = true;
    }
  }
  
  private ensureActive(): void {
    if (this.released) {
      throw new DatabaseError('Transaction client has been released');
    }
  }
}

export function createTransactionHelper(pool: Pool) {
  return {
    async transaction<T>(fn: (client: TransactionClient) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      const txClient = new TransactionClientImpl(client);
      
      try {
        await client.query('BEGIN');
        const result = await fn(txClient);
        await txClient.commit();
        return result;
      } catch (error) {
        await txClient.rollback();
        throw error;
      } finally {
        await txClient.release();
      }
    },
    
    // Transaction with isolation level
    async transactionWithOptions<T>(
      fn: (client: TransactionClient) => Promise<T>,
      options: {
        isolationLevel?: 'READ UNCOMMITTED' | 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE';
        readOnly?: boolean;
        deferrable?: boolean;
      } = {}
    ): Promise<T> {
      const client = await pool.connect();
      const txClient = new TransactionClientImpl(client);
      
      const isolation = options.isolationLevel 
        ? `ISOLATION LEVEL ${options.isolationLevel}` 
        : '';
      const readOnly = options.readOnly ? 'READ ONLY' : '';
      const deferrable = options.deferrable ? 'DEFERRABLE' : '';
      
      const beginStmt = ['BEGIN', isolation, readOnly, deferrable]
        .filter(Boolean)
        .join(' ');
      
      try {
        await client.query(beginStmt);
        const result = await fn(txClient);
        await txClient.commit();
        return result;
      } catch (error) {
        await txClient.rollback();
        throw error;
      } finally {
        await txClient.release();
      }
    },
  };
}

// Re-export types
export { TransactionClientImpl };
