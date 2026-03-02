const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const pool = new Pool({
  connectionString: 'postgres://iut_admin:secretpassword@postgres:5432/cafeteria_db'
});

// Initialize Database Tables
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS inventory (
        id VARCHAR(50) PRIMARY KEY,
        stock INT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS processed_orders (
        idempotency_key VARCHAR(100) PRIMARY KEY,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      -- Insert dummy stock for our iftar box if it doesn't exist
      INSERT INTO inventory (id, stock) VALUES ('iftar_box_1', 500) ON CONFLICT DO NOTHING;
    `);
    console.log('Database tables initialized.');
  } catch (err) {
    console.error('DB Init Error:', err);
  }
}
initDB();

// The Idempotent Stock Deduction Route
app.post('/deduct', async (req, res) => {
  const { itemId, idempotencyKey } = req.body;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN'); // Start Transaction
    
    // 1. IDEMPOTENCY CHECK: Have we seen this exact order request before?
    const check = await client.query('SELECT 1 FROM processed_orders WHERE idempotency_key = $1', [idempotencyKey]);
    if (check.rowCount > 0) {
      await client.query('ROLLBACK');
      return res.status(200).json({ message: 'Order already processed successfully (Idempotent)' });
    }

    // 2. STOCK DEDUCTION (Optimistic)
    const update = await client.query(
      'UPDATE inventory SET stock = stock - 1 WHERE id = $1 AND stock > 0 RETURNING stock',
      [itemId]
    );

    if (update.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Item out of stock!' });
    }

    // 3. RECORD THE KEY
    await client.query('INSERT INTO processed_orders (idempotency_key) VALUES ($1)', [idempotencyKey]);
    
    await client.query('COMMIT'); // Save everything safely
    res.json({ success: true, remainingStock: update.rows[0].stock });
    
  } catch (err) {
    await client.query('ROLLBACK'); // Undo everything if it crashed midway
    res.status(500).json({ error: 'Database transaction failed' });
  } finally {
    client.release();
  }
});
// New Endpoint to check current stock
app.get('/stock/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT stock FROM inventory WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ stock: result.rows[0].stock });
  } catch (err) {
    res.status(500).json({ error: 'DB error' });
  }
});
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'OK', service: 'stock-service' });
  } catch (e) {
    res.status(503).json({ status: 'Unavailable', service: 'stock-service' });
  }
});

app.listen(3000, () => console.log('Stock Service running with Idempotency on port 3000'));