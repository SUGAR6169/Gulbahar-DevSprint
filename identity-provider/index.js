const express = require('express');
const jwt = require('jsonwebtoken');
const { createClient } = require('redis');
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const cors = require('cors'); // <--- CORS is included!

const app = express();
app.use(cors());              // <--- CORS is enabled!
app.use(express.json());

// Connect to Redis for the Rate Limiter (3 logins per minute)
const redisClient = createClient({ url: 'redis://redis:6379' });
redisClient.connect().catch(console.error);

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  store: new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
    prefix: 'login_limit:',
  }),
  keyGenerator: (req) => req.body.studentId || req.ip,
  message: { error: 'Too many login attempts.' }
});

// The actual Login Route that the frontend is looking for!
app.post('/login', loginLimiter, (req, res) => {
  const { studentId } = req.body;
  if (!studentId) return res.status(400).json({ error: 'Student ID required' });
  
  // Issue the secure token
  const token = jwt.sign({ studentId }, 'SUPER_SECRET', { expiresIn: '1h' });
  res.json({ token });
});

app.get('/health', (req, res) => res.json({ status: 'OK', service: 'identity-provider' }));

// Notice the new message so we know it updated!
app.listen(3000, () => console.log('Identity Provider running with CORS on port 3000'));