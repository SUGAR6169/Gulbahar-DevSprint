const express = require('express');
const amqp = require('amqplib');
const cors = require('cors');

const app = express();
app.use(cors());

let clients = [];

// Real-time SSE Endpoint for Frontend
app.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  clients.push(res);
  req.on('close', () => { clients = clients.filter(client => client !== res); });
});

async function listenForNotifications() {
  const conn = await amqp.connect('amqp://rabbitmq:5672');
  const channel = await conn.createChannel();
  await channel.assertQueue('notifications');

  channel.consume('notifications', (msg) => {
    if (msg !== null) {
      const update = msg.content.toString();
      clients.forEach(client => client.write(`data: ${update}\n\n`));
      channel.ack(msg);
    }
  });
}
listenForNotifications().catch(console.error);

app.get('/health', (req, res) => res.json({ status: 'OK', service: 'notification-hub' }));
app.listen(3000, () => console.log('Notification Hub running on port 3000'));