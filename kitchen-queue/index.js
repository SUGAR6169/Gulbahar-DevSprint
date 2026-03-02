const express = require('express');
const amqp = require('amqplib');

const app = express();

let channel;
async function connectRabbitMQ() {
  try {
    const conn = await amqp.connect('amqp://rabbitmq:5672');
    channel = await conn.createChannel();
    await channel.assertQueue('kitchen_orders');
    await channel.assertQueue('notifications');
    
    console.log('✅ Kitchen Queue connected to RabbitMQ!');
    
    // Start listening for orders
    channel.consume('kitchen_orders', (msg) => {
      if (msg !== null) {
        const order = JSON.parse(msg.content.toString());
        console.log('🍳 Cooking order:', order.itemId);
        
        // Simulate a 3 to 7 second cooking delay
        setTimeout(() => {
          console.log('🍽️ Order Ready:', order.itemId);
          // Send the "Ready" message to the Notification Hub
          channel.sendToQueue('notifications', Buffer.from(JSON.stringify({ itemId: order.itemId, status: 'Ready' })));
          channel.ack(msg);
        }, Math.floor(Math.random() * 4000) + 3000); 
      }
    });
  } catch (err) {
    console.log('⏳ RabbitMQ not ready, Kitchen retrying in 2 seconds...');
    setTimeout(connectRabbitMQ, 2000);
  }
}
connectRabbitMQ();

app.get('/health', (req, res) => res.json({ status: 'OK', service: 'kitchen-queue' }));
app.listen(3000, () => console.log('Kitchen Queue running on port 3000'));