// ── Dependencies ────────────────────────────────────────────
const { Pool } = require('pg');

// ── Connection Pool ──────────────────────────────────────────
// A pool manages multiple connections to the database
const pool = new Pool({
  user: 'postgres',       // default PostgreSQL user
  host: 'localhost',      // database is on our own machine
  database: 'continental', // the database we created in pgAdmin
  password: 'postgres',   // the password you set during installation
  port: 5432,             // default PostgreSQL port
});

// ── Create Tables ────────────────────────────────────────────
// This runs when the server starts and creates the table if it
// doesn't already exist. Safe to run multiple times.
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