require('dotenv').config();
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const WebSocket = require('ws');
const User = require('./models/User');
const Message = require('./models/Message');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

app.get('/', (req, res) => {
  res.send('Chat server is running. Use the frontend to chat.');
});

const path = require('path');

// Serve frontend static files
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// For SPA routing - serve index.html for unknown routes (except API paths)
app.get(/^\/(?!messages|users|register|search|profile|set-password).*/, (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Connect to MongoDB once
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

app.post('/register', async (req, res) => {
  const { username, password, displayName, avatarUrl, backgroundUrl } = req.body;
  if (!username || !password || !displayName) return res.status(400).json({ error: 'Missing required fields' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const user = new User({ username, passwordHash: hash, displayName, avatarUrl, backgroundUrl });
    await user.save();
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(400).json({ error: 'Username already exists' });
  }
});

// login endpoint
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing required fields' });
  const user = await User.findOne({ username });
  if (!user || !user.passwordHash) return res.status(401).json({ error: 'Invalid credentials' });
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
  res.json({ success: true, user });
});

// set password for a user
const bcrypt = require('bcrypt');
app.post('/set-password', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'missing' });
  const hash = await bcrypt.hash(password, 10);
  await User.updateOne({ username }, { passwordHash: hash });
  res.json({ success: true });
});

// update profile (displayName, avatarUrl, backgroundUrl)
app.post('/profile', async (req, res) => {
  const { username, displayName, avatarUrl, backgroundUrl } = req.body;
  const user = await User.findOneAndUpdate({ username }, { displayName, avatarUrl, backgroundUrl }, { new: true });
  res.json({ success: true, user });
});

// search users by username or displayName
app.get('/search', async (req, res) => {
  const q = req.query.q || '';
  const users = await User.find({
    $or: [
      { username: { $regex: q, $options: 'i' } },
      { displayName: { $regex: q, $options: 'i' } }
    ]
  }).limit(20);
  res.json(users);
});

app.get('/users', async (req, res) => {
  const users = await User.find();
  res.json(users);
});

app.get('/messages/:user1/:user2', async (req, res) => {
  const { user1, user2 } = req.params;
  const messages = await Message.find({
    $or: [
      { sender: user1, receiver: user2 },
      { sender: user2, receiver: user1 },
    ],
  }).sort({ timestamp: 1 });
  res.json(messages);
});

// world messages
app.get('/messages/world', async (req, res) => {
  const messages = await Message.find({ receiver: 'WORLD' }).sort({ timestamp: 1 });
  res.json(messages);
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  ws.on('message', async (data) => {
    const msg = JSON.parse(data);
  // support world chat: if no receiver or receiver is 'WORLD' use 'WORLD'
  const receiver = (!msg.receiver || msg.receiver.toUpperCase() === 'WORLD') ? 'WORLD' : msg.receiver;
  const message = new Message({ sender: msg.sender, receiver, content: msg.content });
    await message.save();
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  });
});

server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
