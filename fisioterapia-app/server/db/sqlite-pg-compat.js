/**
 * Compatibilidade mínima com a API do sqlite3 usando PostgreSQL.
 * Permite manter as rotas existentes com db.run/db.get/db.all.
 */

const { Pool } = require('pg');

let pool;

function getPool() {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL nao configurada');
  }

  const useSsl = process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production';

  pool = new Pool({
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : false
  });

  return pool;
}

function convertPlaceholders(sql) {
  let index = 0;
  let inSingle = false;
  let inDouble = false;
  let result = '';

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];

    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      result += ch;
      continue;
    }

    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      result += ch;
      continue;
    }

    if (ch === '?' && !inSingle && !inDouble) {
      index += 1;
      result += `$${index}`;
      continue;
    }

    result += ch;
  }

  return result;
}

class PgCompatDatabase {
  constructor(_ignoredPath, _ignoredModeOrCb, maybeCb) {
    if (typeof _ignoredModeOrCb === 'function') {
      _ignoredModeOrCb(null);
    } else if (typeof maybeCb === 'function') {
      maybeCb(null);
    }
  }

  run(sql, params, callback) {
    const cb = typeof params === 'function' ? params : callback;
    const values = Array.isArray(params) ? params : [];
    let convertedSql = convertPlaceholders(sql);
    if (/^\s*insert\s+/i.test(convertedSql) && !/\breturning\b/i.test(convertedSql)) {
      convertedSql = `${convertedSql.trim()} RETURNING id`;
    }

    getPool()
      .query(convertedSql, values)
      .then((res) => {
        const ctx = {
          lastID: res.rows && res.rows[0] && res.rows[0].id ? res.rows[0].id : undefined,
          changes: res.rowCount || 0
        };
        if (cb) cb.call(ctx, null);
      })
      .catch((err) => {
        if (cb) cb(err);
      });
  }

  get(sql, params, callback) {
    const cb = typeof params === 'function' ? params : callback;
    const values = Array.isArray(params) ? params : [];
    const convertedSql = convertPlaceholders(sql);

    getPool()
      .query(convertedSql, values)
      .then((res) => {
        if (cb) cb(null, res.rows[0]);
      })
      .catch((err) => {
        if (cb) cb(err);
      });
  }

  all(sql, params, callback) {
    const cb = typeof params === 'function' ? params : callback;
    const values = Array.isArray(params) ? params : [];
    const convertedSql = convertPlaceholders(sql);

    getPool()
      .query(convertedSql, values)
      .then((res) => {
        if (cb) cb(null, res.rows);
      })
      .catch((err) => {
        if (cb) cb(err);
      });
  }

  close(callback) {
    if (callback) callback(null);
  }
}

module.exports = {
  verbose() {
    return {
      Database: PgCompatDatabase,
      OPEN_READONLY: 1
    };
  },
  getPool
};
