import type { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import type { QueryConfig, QueryExecutor } from './types.js';
import { DatabaseError } from './types.js';

// Unsafe SQL patterns that will be rejected
const UNSAFE_PATTERNS = [
  /;\s*drop\s+/i,
  /;\s*delete\s+from\s+/i,
  /;\s*truncate\s+/i,
  /union\s+select\s+/i,
  /\/\*!\d+\s+/i, // MySQL conditional comments
  /exec\s*\(/i,
  /xp_/i, // Extended stored procedures
  /sp_/i, // System stored procedures
];

// Check for obviously dangerous patterns in SQL text
function validateSqlText(text: string): void {
  for (const pattern of UNSAFE_PATTERNS) {
    if (pattern.test(text)) {
      throw new DatabaseError(
        `SQL contains unsafe pattern: ${pattern.source}`,
        'UNSAFE_SQL_PATTERN',
        text
      );
    }
  }
}

// Ensure values array is provided for parameterized queries
function validateParameters(text: string, values?: unknown[]): void {
  // Count placeholders in the query
  const placeholderCount = (text.match(/\$\d+/g) || []).length;
  
  if (placeholderCount > 0) {
    if (!values || values.length < placeholderCount) {
      throw new DatabaseError(
        `Query has ${placeholderCount} placeholders but only ${values?.length || 0} values provided`,
        'PARAMETER_MISMATCH',
        text
      );
    }
  }
  
  // Validate that no raw values are being concatenated
  // This is a basic check - the real protection comes from parameterized queries
  const suspiciousPatterns = [
    /'[^']*\$\{[^}]+\}[^']*'/, // Template literal interpolation in strings
    /"[^"]*\$\{[^}]+\}[^"]*"/, // Template literal interpolation in identifiers
  ];
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(text)) {
      throw new DatabaseError(
        'Query contains potential string interpolation - use parameterized queries only',
        'UNSAFE_INTERPOLATION',
        text
      );
    }
  }
}

export class QueryExecutorImpl implements QueryExecutor {
  constructor(private readonly client: Pool | PoolClient) {}

  async query<R extends QueryResultRow = QueryResultRow>(
    configOrText: QueryConfig | string,
    values?: unknown[]
  ): Promise<QueryResult<R>> {
    let config: QueryConfig;
    
    if (typeof configOrText === 'string') {
      config = { text: configOrText, values };
    } else {
      config = configOrText;
    }
    
    // Security validations
    validateSqlText(config.text);
    validateParameters(config.text, config.values);
    
    try {
      const result = await this.client.query<R>(config);
      return result;
    } catch (error) {
      const pgError = error as { code?: string; message?: string; detail?: string };
      throw new DatabaseError(
        pgError.message || 'Query execution failed',
        pgError.code,
        config.text,
        error
      );
    }
  }
  
  // Execute a prepared statement
  async prepared<R extends QueryResultRow = QueryResultRow>(
    name: string,
    text: string,
    values: unknown[]
  ): Promise<QueryResult<R>> {
    validateSqlText(text);
    validateParameters(text, values);
    
    try {
      const result = await this.client.query<R>({
        name,
        text,
        values,
      });
      return result;
    } catch (error) {
      const pgError = error as { code?: string; message?: string };
      throw new DatabaseError(
        pgError.message || 'Prepared statement execution failed',
        pgError.code,
        text,
        error
      );
    }
  }
}

export function createQueryExecutor(client: Pool | PoolClient): QueryExecutor {
  return new QueryExecutorImpl(client);
}
