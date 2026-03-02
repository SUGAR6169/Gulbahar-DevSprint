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
// A mock database of valid students
const validUsers = {
  "200041122": "iftar2026", // Student ID : Password
  "190041200": "password123",
  "admin": "admin"
};

app.post('/login', loginLimiter, (req, res) => {
  const { studentId, password } = req.body;
  
  if (!studentId || !password) {
    return res.status(400).json({ error: 'Student ID and password are required' });
  }

  // ACTUALLY CHECK THE CREDENTIALS
  if (validUsers[studentId] && validUsers[studentId] === password) {
    // Password is correct, issue the secure token
    const token = jwt.sign({ studentId }, 'SUPER_SECRET', { expiresIn: '1h' });
    return res.json({ token });
  } else {
    // Password or ID is wrong, reject them!
    return res.status(401).json({ error: 'Invalid Student ID or Password' });
  }
});

app.get('/health', (req, res) => res.json({ status: 'OK', service: 'identity-provider' }));

// Notice the new message so we know it updated!
app.listen(3000, () => console.log('Identity Provider running with CORS on port 3000'));