const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const db = require('./models/db');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const postRoutes = require('./routes/posts');
const messageRoutes = require('./routes/messages');
const groupRoutes = require('./routes/groups');
const friendRoutes = require('./routes/friends');
const notificationRoutes = require('./routes/notifications');
const storiesRoutes = require('./routes/stories');
const reactionsRoutes = require('./routes/reactions');
const bookmarksRoutes = require('./routes/bookmarks');
const pollsRoutes = require('./routes/polls');
const profileViewsRoutes = require('./routes/profileViews');
const analyticsRoutes = require('./routes/analytics');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware - increased limit for images
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static files - determine correct paths
const fs = require('fs');
let clientPath = path.join(__dirname, 'client');
if (!fs.existsSync(clientPath)) {
  clientPath = path.join(__dirname, '../client');
}
if (!fs.existsSync(clientPath)) {
  clientPath = path.join(process.cwd(), 'client');
}

// Serve uploads folder - check multiple locations
let uploadsPath = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsPath)) {
  uploadsPath = path.join(__dirname, '../uploads');
}
if (!fs.existsSync(uploadsPath)) {
  uploadsPath = path.join(process.cwd(), 'uploads');
}
console.log('Serving uploads from:', uploadsPath);
app.use('/uploads', express.static(uploadsPath));
console.log('Serving client from:', clientPath);
console.log('__dirname:', __dirname);
console.log('process.cwd():', process.cwd());
app.use(express.static(clientPath));
app.get('/', (req, res) => {
  res.sendFile(path.join(clientPath, 'index.html'));
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/stories', storiesRoutes);
app.use('/api/reactions', reactionsRoutes);
app.use('/api/bookmarks', bookmarksRoutes);
app.use('/api/polls', pollsRoutes);
app.use('/api/profile-views', profileViewsRoutes);
app.use('/api/analytics', analyticsRoutes);

// Socket.io
const connectedUsers = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', (userId) => {
    connectedUsers.set(userId, socket.id);
    socket.userId = userId;
    console.log(`User ${userId} joined`);
  });

  socket.on('sendMessage', (data) => {
    const { recipientId, message, senderId } = data;
    const recipientSocket = connectedUsers.get(recipientId);
    
    if (recipientSocket) {
      io.to(recipientSocket).emit('newMessage', {
        senderId,
        message,
        timestamp: new Date().toISOString()
      });
    }
  });

  socket.on('disconnect', () => {
    if (socket.userId) {
      connectedUsers.delete(socket.userId);
    }
    console.log('User disconnected:', socket.id);
  });
});

app.set('io', io);

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await db.read();
    console.log('Database loaded successfully');
    
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Quik server running on http://localhost:${PORT}`);
      console.log(`Access from other devices: http://YOUR_IP:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
