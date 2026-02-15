import { Pool, types } from 'pg';
import type { DatabaseConfig, DatabasePool } from './types.js';
import { createQueryExecutor } from './query.js';
import { createTransactionHelper } from './helpers.js';
import { DatabaseError } from './types.js';

// Parse numeric types as numbers instead of strings
// OID 1700 = numeric
const NUMERIC_OID = 1700;
types.setTypeParser(NUMERIC_OID, (val: string) => parseFloat(val));

// OID 20 = bigint, parse as string to avoid precision loss
const BIGINT_OID = 20;
types.setTypeParser(BIGINT_OID, (val: string) => val);

const DEFAULT_CONFIG: Partial<DatabaseConfig> = {
  maxConnections: 20,
  minConnections: 2,
  connectionTimeoutMs: 5000,
  idleTimeoutMs: 30000,
  statementTimeoutMs: 30000,
  queryTimeoutMs: 30000,
};

export function createPool(config: Partial<DatabaseConfig> = {}): DatabasePool {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  
  const pool = new Pool({
    host: mergedConfig.host,
    port: mergedConfig.port,
    database: mergedConfig.database,
    user: mergedConfig.user,
    password: mergedConfig.password,
    ssl: mergedConfig.ssl,
    
    // Hard limits on connections
    max: mergedConfig.maxConnections,
    min: mergedConfig.minConnections,
    
    // Timeouts
    connectionTimeoutMillis: mergedConfig.connectionTimeoutMs,
    idleTimeoutMillis: mergedConfig.idleTimeoutMs,
    statement_timeout: mergedConfig.statementTimeoutMs,
    query_timeout: mergedConfig.queryTimeoutMs,
    
    // Application name for monitoring
    application_name: 'postgres-dal',
  });

  // Error handling for the pool itself
  pool.on('error', (err) => {
    console.error('Unexpected PostgreSQL pool error:', err);
  });

  const queryExecutor = createQueryExecutor(pool);
  const transactionHelper = createTransactionHelper(pool);

  return {
    pool,
    
    query: queryExecutor.query.bind(queryExecutor),
    
    transaction: transactionHelper.transaction.bind(transactionHelper),
    
    async close(): Promise<void> {
      try {
        await pool.end();
      } catch (error) {
        throw new DatabaseError(
          'Failed to close database pool',
          'POOL_CLOSE_ERROR',
          undefined,
          error
        );
      }
    },
  };
}

// Environment-based configuration helper
export function createPoolFromEnv(): DatabasePool {
  const config: Partial<DatabaseConfig> = {
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432', 10),
    database: process.env.PGDATABASE || 'postgres',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || '',
    ssl: process.env.PGSSL === 'true' ? true : undefined,
    maxConnections: parseInt(process.env.PGMAXCONNECTIONS || '20', 10),
    minConnections: parseInt(process.env.PGMINCONNECTIONS || '2', 10),
    statementTimeoutMs: parseInt(process.env.PGSTATEMENTTIMEOUT || '30000', 10),
  };
  
  return createPool(config);
}
