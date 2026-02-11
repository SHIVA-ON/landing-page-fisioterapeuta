/**
 * Servico centralizado para leitura/escrita de configuracoes em site_settings.
 */

const sqlite3 = require('../db/sqlite-pg-compat').verbose();

const DB_PATH = process.env.DATABASE_URL || 'postgres';
const EMAIL_NOTIFICATIONS_KEY = 'email_notifications_enabled';

function getDb() {
  return new sqlite3.Database(DB_PATH);
}

function normalizeSettingValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value).trim();
}

async function getSetting(key, fallbackValue = null) {
  const db = getDb();
  try {
    const row = await new Promise((resolve, reject) => {
      db.get('SELECT value FROM site_settings WHERE key = ?', [key], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    if (!row) return fallbackValue;
    return row.value;
  } finally {
    db.close();
  }
}

async function setSetting(key, value) {
  const db = getDb();
  const normalizedValue = normalizeSettingValue(value);

  try {
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO site_settings (key, value, updated_at)
         VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         updated_at = CURRENT_TIMESTAMP`,
        [key, normalizedValue],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    return normalizedValue;
  } finally {
    db.close();
  }
}

async function isEmailNotificationsEnabled() {
  const value = await getSetting(EMAIL_NOTIFICATIONS_KEY, 'true');
  return value === true || value === 'true' || value === '1' || value === 1;
}

async function setEmailNotificationsEnabled(enabled) {
  return setSetting(EMAIL_NOTIFICATIONS_KEY, enabled ? 'true' : 'false');
}

module.exports = {
  EMAIL_NOTIFICATIONS_KEY,
  getSetting,
  setSetting,
  isEmailNotificationsEnabled,
  setEmailNotificationsEnabled
};

