/**
 * Regras de negocio de agendamento.
 */

const sqlite3 = require('../db/sqlite-pg-compat').verbose();

const DB_PATH = process.env.DATABASE_URL || 'postgres';

function getDb() {
  return new sqlite3.Database(DB_PATH);
}

async function createAppointmentRecord(data, ipAddress) {
  const db = getDb();

  try {
    const insertedId = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO booking_requests
         (name, email, phone, preferred_date, preferred_time, service_type, notes, ip_address)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.name,
          data.email || null,
          data.phone,
          data.date,
          data.time,
          data.service,
          data.notes || null,
          ipAddress || null
        ],
        function onInsert(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });

    return insertedId;
  } finally {
    db.close();
  }
}

module.exports = {
  createAppointmentRecord
};

