const express = require('express');
const amqp = require('amqplib');
const cors = require('cors');

const app = express();
app.use(cors());

let clients = [];

// The Server-Sent Events (SSE) route for the React Frontend
app.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  clients.push(res);
  req.on('close', () => { clients = clients.filter(client => client !== res); });
});

async function connectRabbitMQ() {
  try {
    const conn = await amqp.connect('amqp://rabbitmq:5672');
    const channel = await conn.createChannel();
    await channel.assertQueue('notifications');
    
    console.log('✅ Notification Hub connected to RabbitMQ!');

    // Listen for "Ready" messages from the Kitchen
    channel.consume('notifications', (msg) => {
      if (msg !== null) {
        const update = msg.content.toString();
        console.log('📣 Broadcasting to frontend:', update);
        // Push the update to all connected web browsers
        clients.forEach(client => client.write(`data: ${update}\n\n`));
        channel.ack(msg);
      }
    });
  } catch (err) {
    console.log('⏳ RabbitMQ not ready, Notification Hub retrying in 2 seconds...');
    setTimeout(connectRabbitMQ, 2000);
  }
}
connectRabbitMQ();

app.get('/health', (req, res) => res.json({ status: 'OK', service: 'notification-hub' }));
app.listen(3000, () => console.log('Notification Hub running on port 3000'));