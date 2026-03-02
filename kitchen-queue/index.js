const express = require('express');
const amqp = require('amqplib');

const app = express();

async function startWorker() {
  const conn = await amqp.connect('amqp://rabbitmq:5672');
  const channel = await conn.createChannel();
  await channel.assertQueue('kitchen_orders');
  await channel.assertQueue('notifications');

  channel.consume('kitchen_orders', (msg) => {
    if (msg !== null) {
      const order = JSON.parse(msg.content.toString());
      console.log('Cooking order:', order.itemId);
      
      setTimeout(() => {
        // Send to notification hub
        channel.sendToQueue('notifications', Buffer.from(JSON.stringify({ itemId: order.itemId, status: 'Ready' })));
        channel.ack(msg);
      }, Math.floor(Math.random() * 4000) + 3000); // 3-7s delay
    }
  });
}
startWorker().catch(console.error);

app.get('/health', (req, res) => res.json({ status: 'OK', service: 'kitchen-queue' }));
app.listen(3000, () => console.log('Kitchen Queue running on port 3000'));