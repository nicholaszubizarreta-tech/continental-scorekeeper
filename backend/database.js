// ── Dependencies ────────────────────────────────────────────
const { Pool } = require('pg');

// ── Connection Pool ──────────────────────────────────────────
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'continental',
  password: 'postgres',
  port: 5432,
});

// ── Create Tables ────────────────────────────────────────────
async function createTables() {
  const query = `
    CREATE TABLE IF NOT EXISTS games (
      code          TEXT PRIMARY KEY,
      players       JSON NOT NULL,
      scores        JSON NOT NULL,
      doubletes     JSON NOT NULL,
      current_round INTEGER NOT NULL DEFAULT 0,
      seat_order    JSON NOT NULL,
      first_dealer  INTEGER NOT NULL DEFAULT 0,
      status        TEXT NOT NULL DEFAULT 'lobby',
      claimed_by    JSON NOT NULL DEFAULT '[]',
      created_at    TIMESTAMP DEFAULT NOW()
    );
  `;

  try {
    await pool.query(query);
    console.log('Database ready.');
  } catch (err) {
    console.error('Error creating tables:', err);
  }
}

// ── Exports ──────────────────────────────────────────────────
module.exports = { pool, createTables };