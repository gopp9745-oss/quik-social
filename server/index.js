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

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve static files from server/client folder
const clientPath = path.join(__dirname, 'client');
console.log('Serving client from:', clientPath);
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
