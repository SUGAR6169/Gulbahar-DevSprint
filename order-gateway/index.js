const express = require('express');
const jwt = require('jsonwebtoken');
const { createClient } = require('redis');
const amqp = require('amqplib');
const cors = require('cors');
const crypto = require('crypto'); // Used to generate unique idempotency keys

const app = express();
app.use(cors());
app.use(express.json());

const redisClient = createClient({ url: 'redis://redis:6379' });
redisClient.connect().catch(console.error);

let rabbitChannel;
async function connectRabbitMQ() {
  const conn = await amqp.connect('amqp://rabbitmq:5672');
  rabbitChannel = await conn.createChannel();
  await rabbitChannel.assertQueue('kitchen_orders');
}
connectRabbitMQ().catch(console.error);

let totalOrders = 0;
let failedOrders = 0;
let requestLogs = []; // Array to hold { timestamp, latency } for the 30-second window

app.post('/orders', async (req, res) => {
  const startTime = Date.now();
  totalOrders++;
  
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) {
    failedOrders++;
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    jwt.verify(token, 'SUPER_SECRET');
    const { itemId } = req.body;
    
    // Check Redis Cache first
    const stock = await redisClient.get(`stock:${itemId}`);
    if (stock !== null && parseInt(stock) <= 0) {
      failedOrders++;
      return res.status(400).json({ error: 'Item out of stock' });
    }

    // Generate Unique Key & Call Stock Service (Node 18 has native fetch)
    const idempotencyKey = crypto.randomUUID();
    const stockRes = await fetch('http://stock-service:3000/deduct', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, idempotencyKey })
    });

    if (!stockRes.ok) {
      failedOrders++;
      return res.status(400).json({ error: 'Stock deduction failed (Sold Out or DB Error)' });
    }

    // Forward to kitchen
    rabbitChannel.sendToQueue('kitchen_orders', Buffer.from(JSON.stringify({ itemId, status: 'Pending' })));
    
    // Track Latency
    const latency = Date.now() - startTime;
    requestLogs.push({ timestamp: Date.now(), latency });
    
    res.status(202).json({ message: 'Order forwarded to kitchen' });
  } catch (err) {
    failedOrders++;
    res.status(403).json({ error: 'Invalid Token or Gateway Error' });
  }
});

// The 30-Second Rolling Window Metrics
app.get('/metrics', (req, res) => {
  const thirtySecondsAgo = Date.now() - 30000;
  
  // Clean up old logs (keep only the last 30 seconds)
  requestLogs = requestLogs.filter(log => log.timestamp >= thirtySecondsAgo);
  
  const recentCount = requestLogs.length;
  const recentLatencySum = requestLogs.reduce((sum, log) => sum + log.latency, 0);
  const avgLatency = recentCount > 0 ? (recentLatencySum / recentCount) : 0;

  res.json({
    total_orders: totalOrders,
    failure_count: failedOrders,
    avg_latency_ms: avgLatency.toFixed(0)
  });
});

// A route to intentionally simulate a database jam so you can trigger the Visual Alert
app.post('/simulate-lag', async (req, res) => {
  const startTime = Date.now();
  await new Promise(resolve => setTimeout(resolve, 2000)); // Fake 2 second delay
  requestLogs.push({ timestamp: Date.now(), latency: Date.now() - startTime });
  res.json({ message: 'Simulated 2000ms server lag' });
});

app.post('/chaos', (req, res) => {
  res.json({ message: 'Gateway killed.' });
  process.exit(1);
});

app.get('/health', (req, res) => res.json({ status: 'OK', service: 'order-gateway' }));

app.listen(3000, () => console.log('Order Gateway running on port 3000'));