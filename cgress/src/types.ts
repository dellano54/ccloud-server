import type { Pool, QueryResult, QueryResultRow } from 'pg';

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean | object;
  
  // Pool configuration
  maxConnections: number;
  minConnections: number;
  connectionTimeoutMs: number;
  idleTimeoutMs: number;
  statementTimeoutMs: number;
  queryTimeoutMs: number;
}

export interface QueryConfig {
  text: string;
  values?: unknown[];
  name?: string; // For prepared statements
  rowMode?: 'array' | 'object';
}

export interface QueryExecutor {
  query<R extends QueryResultRow = QueryResultRow>(
    config: QueryConfig
  ): Promise<QueryResult<R>>;
  
  query<R extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[]
  ): Promise<QueryResult<R>>;
}

export interface TransactionClient extends QueryExecutor {
  commit(): Promise<void>;
  rollback(): Promise<void>;
  release(): Promise<void>;
}

export interface DatabasePool extends QueryExecutor {
  pool: Pool;
  transaction<T>(fn: (client: TransactionClient) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export type QueryValue = string | number | boolean | Date | null | Buffer | object;

export type IdentifierWhitelist = ReadonlySet<string>;

export class DatabaseError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly query?: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityError';
  }
}
