import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Always prefer explicit local env parts; fall back to DATABASE_URL only if parts are missing.
const hasDbParts = process.env.DB_HOST && process.env.DB_USER && process.env.DB_PASSWORD && process.env.DB_NAME;
const connectionString = hasDbParts
  ? `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME}`
  : process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('Database configuration missing. Please set DB_HOST/DB_USER/DB_PASSWORD/DB_NAME (and optionally DB_PORT).');
}

const isProduction = process.env.NODE_ENV === 'production';

export const pool = new Pool({
  connectionString,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});