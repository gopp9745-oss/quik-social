const express = require('express')
const cors = require('cors')
const crypto = require('crypto')

// ===== КОНФИГУРАЦИЯ =====
const USE_MONGODB = process.env.USE_MONGODB === 'true' || true;
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://quikuser:quikpassword123@cluster0.jf8hps1.mongodb.net/?appName=Cluster0';

const PORT = process.env.PORT || 3000
const STORE_FILE = require('path').join(__dirname, 'store.json')

// ===== MONGODB SETUP =====
let mongoose;
let User, Post, Group, Message;
let mongoConnected = false;

async function initMongoDB() {
  if (!USE_MONGODB) return false;
  
  try {
    mongoose = require('mongoose');
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB connected!');
    mongoConnected = true;
    
    // Схемы
    const userSchema = new mongoose.Schema({
      username: String,
      password: String,
      firstName: { type: String, default: '' },
      lastName: { type: String, default: '' },
      avatar: { type: String, default: '' },
      bio: { type: String, default: '' },
      isPrivate: { type: Boolean, default: false },
      createdAt: { type: Date, default: Date.now }
    });
    
    const postSchema = new mongoose.Schema({
      authorId: String,
      content: String,
      image: String,
      likesCount: { type: Number, default: 0 },
      commentsCount: { type: Number, default: 0 },
      createdAt: { type: Date, default: Date.now }
    });
    
    const groupSchema = new mongoose.Schema({
      name: String,
      description: String,
      ownerId: String,
      membersCount: { type: Number, default: 1 },
      createdAt: { type: Date, default: Date.now }
    });
    
    const messageSchema = new mongoose.Schema({
      senderId: String,
      recipientId: String,
      text: String,
      read: { type: Boolean, default: false },
      createdAt: { type: Date, default: Date.now }
    });

    const notificationSchema = new mongoose.Schema({
      userId: String,
      type: String, // like, comment, message, follow
      fromUserId: String,
      postId: String,
      text: String,
      read: { type: Boolean, default: false },
      createdAt: { type: Date, default: Date.now }
    });

    const followSchema = new mongoose.Schema({
      followerId: String,
      followingId: String,
      approved: { type: Boolean, default: false },
      createdAt: { type: Date, default: Date.now }
    });
    
    const followRequestSchema = new mongoose.Schema({
      fromUserId: String,
      toUserId: String,
      status: { type: String, default: 'pending' }, // pending, approved, rejected
      createdAt: { type: Date, default: Date.now }
    });

    const botLogSchema = new mongoose.Schema({
      botId: String,
      action: String,
      targetId: String,
      createdAt: { type: Date, default: Date.now }
    });
    
    User = mongoose.model('User', userSchema);
    Post = mongoose.model('Post', postSchema);
    Group = mongoose.model('Group', groupSchema);
    Message = mongoose.model('Message', messageSchema);
    Notification = mongoose.model('Notification', notificationSchema);
    Follow = mongoose.model('Follow', followSchema);
    BotLog = mongoose.model('BotLog', botLogSchema);
    FollowRequest = mongoose.model('FollowRequest', followRequestSchema);
    
    return true;
  } catch(e) {
    console.error('MongoDB error:', e.message);
    return false;
  }
}

// ===== FILE-BASED STORAGE =====
const fs = require('fs')

function loadStore(){
  try{
    if(!fs.existsSync(STORE_FILE)){
      const base = { users: [], posts: [], groups: [], messages: [] }
      fs.writeFileSync(STORE_FILE, JSON.stringify(base, null, 2))
      return base
    }
    const raw = fs.readFileSync(STORE_FILE,'utf8')
    return JSON.parse(raw || '{"users":[],"posts":[],"groups":[],"messages":[]}')
  }catch(e){
    console.error('Failed to load store', e)
    return { users:[], posts:[], groups:[], messages:[] }
  }
}

function saveStore(store){
  try{
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2))
    return true
  }catch(e){ console.error('Failed to save store', e); return false }
}

// ===== APP SETUP =====
const app = express()
app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))
app.use(express.static(require('path').join(__dirname)))
app.use('/uploads', express.static(require('path').join(__dirname, 'uploads')))

// Create uploads directory
const uploadsDir = require('path').join(__dirname, 'uploads');
if (!require('fs').existsSync(uploadsDir)) {
    require('fs').mkdirSync(uploadsDir);
}

// Multer for file uploads
const multer = require('multer');
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const ext = file.originalname.split('.').pop();
        cb(null, `${generateId()}.${ext}`);
    }
});
const upload = multer({ storage });

// Generate UUID
function generateId() {
  return crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Simple JWT-like token
function createToken(user) {
  return Buffer.from(JSON.stringify({ userId: user._id || user.id, time: Date.now() })).toString('base64');
}

function verifyToken(token) {
  try {
    return JSON.parse(Buffer.from(token, 'base64').toString());
  } catch(e) { return null; }
}

// Check if MongoDB is actually connected
const isMongoReady = () => mongoConnected && mongoose && User;

// ===== ROUTES - АВТОМАТИЧЕСКИ ПЕРЕКЛЮЧАЮТСЯ МЕЖДУ MONGODB И FILE =====

// Auth: Register
app.post('/api/auth/register', async (req, res) => {
  const { username, password, firstName, lastName } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  
  try {
    let user;
    if (isMongoReady()) {
      const existing = await User.findOne({ username });
      if (existing) return res.status(400).json({ error: 'User already exists' });
      
      user = await User.create({ username, password, firstName: firstName || '', lastName: lastName || '', avatar: '', bio: '' });
    } else {
      const store = loadStore();
      const existing = store.users.find(u => u.username === username);
      if (existing) return res.status(400).json({ error: 'User already exists' });
      
      user = { id: generateId(), username, password, firstName: firstName || '', lastName: lastName || '', avatar: '', bio: '', createdAt: new Date().toISOString() };
      store.users.push(user);
      saveStore(store);
    }
    
    const token = createToken(user);
    res.json({ token, user: { id: user._id || user.id, username: user.username, email: username + '@quik.local', firstName: user.firstName, lastName: user.lastName, avatar: user.avatar } });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Auth: Login
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  
  try {
    let user;
    if (isMongoReady()) {
      user = await User.findOne({ username, password });
      if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    } else {
      const store = loadStore();
      user = store.users.find(u => u.username === username && u.password === password);
      if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    const token = createToken(user);
    res.json({ token, user: { id: user._id || user.id, username: user.username, email: user.email || username + '@quik.local', firstName: user.firstName, lastName: user.lastName, avatar: user.avatar, bio: user.bio } });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Auth: Me
app.get('/api/auth/me', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  
  const data = verifyToken(token);
  if (!data) return res.status(401).json({ error: 'Invalid token' });
  
  try {
    let user;
    if (isMongoReady()) {
      user = await User.findById(data.userId);
      if (!user) return res.status(404).json({ error: 'User not found' });
    } else {
      const store = loadStore();
      user = store.users.find(u => u.id === data.userId);
      if (!user) return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ id: user._id || user.id, username: user.username, email: user.email, firstName: user.firstName, lastName: user.lastName, avatar: user.avatar, bio: user.bio });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Auth: Update Profile
app.put('/api/auth/profile', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  
  const data = verifyToken(token);
  if (!data) return res.status(401).json({ error: 'Invalid token' });
  
  const { firstName, lastName, bio } = req.body;
  
  try {
    let user;
    if (mongoose) {
      user = await User.findById(data.userId);
      if (!user) return res.status(404).json({ error: 'User not found' });
      
      if (firstName !== undefined) user.firstName = firstName;
      if (lastName !== undefined) user.lastName = lastName;
      if (bio !== undefined) user.bio = bio;
      await user.save();
    } else {
      const store = loadStore();
      const userIndex = store.users.findIndex(u => u.id === data.userId);
      if (userIndex === -1) return res.status(404).json({ error: 'User not found' });
      
      if (firstName !== undefined) store.users[userIndex].firstName = firstName;
      if (lastName !== undefined) store.users[userIndex].lastName = lastName;
      if (bio !== undefined) store.users[userIndex].bio = bio;
      user = store.users[userIndex];
      saveStore(store);
    }
    
    res.json({ id: user._id || user.id, username: user.username, email: user.email, firstName: user.firstName, lastName: user.lastName, avatar: user.avatar, bio: user.bio });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Get posts
app.get('/api/posts', async (req, res) => {
  try {
    let posts;
    if (mongoose) {
      posts = await Post.find().sort({ createdAt: -1 });
    } else {
      const store = loadStore();
      posts = store.posts.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    
    const result = await Promise.all(posts.map(async p => {
      let authorName = 'Unknown';
      if (mongoose) {
        const author = await User.findById(p.authorId);
        authorName = author?.username || 'Unknown';
      } else {
        const store = loadStore();
        const author = store.users.find(u => u.id === p.authorId);
        authorName = author?.username || 'Unknown';
      }
      return { ...p.toObject(), authorName };
    }));
    
    res.json(result);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Get posts for user profile
app.get('/api/posts/user/:userId', async (req, res) => {
  try {
    let posts;
    if (mongoose) {
      posts = await Post.find({ authorId: req.params.userId }).sort({ createdAt: -1 });
    } else {
      const store = loadStore();
      posts = store.posts.filter(p => p.authorId === req.params.userId).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    
    const result = await Promise.all(posts.map(async p => {
      let authorName = 'Unknown';
      if (mongoose) {
        const author = await User.findById(p.authorId);
        authorName = author?.username || 'Unknown';
      } else {
        const store = loadStore();
        const author = store.users.find(u => u.id === p.authorId);
        authorName = author?.username || 'Unknown';
      }
      return { ...p.toObject(), authorName };
    }));
    
    res.json(result);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Create post
app.post('/api/posts', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const data = verifyToken(token);
  if (!data) return res.status(401).json({ error: 'Not authenticated' });
  
  const { content, image } = req.body;
  
  try {
    let post;
    if (mongoose) {
      post = await Post.create({ authorId: data.userId, content, image: image || '', likesCount: 0, commentsCount: 0 });
    } else {
      const store = loadStore();
      post = { id: generateId(), authorId: data.userId, content, image: image || '', likesCount: 0, commentsCount: 0, createdAt: new Date().toISOString() };
      store.posts.push(post);
      saveStore(store);
    }
    res.json(post);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Like post
app.post('/api/posts/:id/like', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const data = verifyToken(token);
  if (!data) return res.status(401).json({ error: 'Not authenticated' });
  
  try {
    if (mongoose) {
      const post = await Post.findById(req.params.id);
      if (post) {
        post.likesCount = (post.likesCount || 0) + 1;
        await post.save();
        res.json({ likesCount: post.likesCount });
      } else {
        res.status(404).json({ error: 'Post not found' });
      }
    } else {
      const store = loadStore();
      const post = store.posts.find(p => p.id === req.params.id);
      if (post) {
        post.likesCount = (post.likesCount || 0) + 1;
        saveStore(store);
        res.json({ likesCount: post.likesCount });
      } else {
        res.status(404).json({ error: 'Post not found' });
      }
    }
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Get users
app.get('/api/users', async (req, res) => {
  try {
    if (mongoose) {
      const users = await User.find();
      res.json(users.map(u => ({ id: u._id, username: u.username, firstName: u.firstName, lastName: u.lastName, avatar: u.avatar })));
    } else {
      const store = loadStore();
      res.json(store.users.map(u => ({ id: u.id, username: u.username, firstName: u.firstName, lastName: u.lastName, avatar: u.avatar })));
    }
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Get groups
app.get('/api/groups', async (req, res) => {
  try {
    if (mongoose) {
      const groups = await Group.find();
      res.json(groups);
    } else {
      const store = loadStore();
      res.json(store.groups);
    }
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Create group
app.post('/api/groups', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const data = verifyToken(token);
  if (!data) return res.status(401).json({ error: 'Not authenticated' });
  
  const { name, description } = req.body;
  
  try {
    let group;
    if (mongoose) {
      group = await Group.create({ name, description: description || '', ownerId: data.userId, membersCount: 1 });
    } else {
      const store = loadStore();
      group = { id: generateId(), name, description: description || '', ownerId: data.userId, membersCount: 1, createdAt: new Date().toISOString() };
      store.groups.push(group);
      saveStore(store);
    }
    res.json(group);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Get conversations with user info
app.get('/api/messages/conversations', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const data = verifyToken(token);
  if (!data) return res.status(401).json({ error: 'Not authenticated' });
  
  try {
    let messages, allUsers;
    if (mongoose) {
      messages = await Message.find({ $or: [{ senderId: data.userId }, { recipientId: data.userId }] });
      allUsers = await User.find();
    } else {
      const store = loadStore();
      messages = store.messages.filter(m => m.senderId === data.userId || m.recipientId === data.userId);
      allUsers = store.users;
    }
    
    const convMap = {};
    messages.forEach(m => {
      const otherId = m.senderId === data.userId ? m.recipientId : m.senderId;
      if (!convMap[otherId]) {
        const otherUser = allUsers.find(u => (u._id?.toString() || u.id) === otherId);
        convMap[otherId] = { 
          id: otherId, 
          lastMessage: m,
          otherUser: otherUser ? { id: otherUser._id || otherUser.id, username: otherUser.username, firstName: otherUser.firstName, lastName: otherUser.lastName } : null
        };
      }
    });
    
    res.json(Object.values(convMap));
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Get conversation with messages
app.get('/api/messages/conversation/:userId', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const data = verifyToken(token);
  if (!data) return res.status(401).json({ error: 'Not authenticated' });
  
  try {
    let user, messages;
    if (mongoose) {
      user = await User.findById(req.params.userId);
      messages = await Message.find({
        $or: [
          { senderId: data.userId, recipientId: req.params.userId },
          { senderId: req.params.userId, recipientId: data.userId }
        ]
      }).sort({ createdAt: 1 });
    } else {
      const store = loadStore();
      user = store.users.find(u => u.id === req.params.userId);
      messages = store.messages.filter(m => 
        (m.senderId === data.userId && m.recipientId === req.params.userId) ||
        (m.senderId === req.params.userId && m.recipientId === data.userId)
      ).sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt));
    }
    res.json({ 
      id: req.params.userId, 
      otherUser: user ? { id: user._id || user.id, username: user.username, firstName: user.firstName, lastName: user.lastName } : null,
      messages: messages 
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Send message
app.post('/api/messages/:conversationId', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const data = verifyToken(token);
  if (!data) return res.status(401).json({ error: 'Not authenticated' });
  
  const { text } = req.body;
  
  try {
    let message;
    if (mongoose) {
      message = await Message.create({ senderId: data.userId, recipientId: req.params.conversationId, text });
    } else {
      const store = loadStore();
      message = { id: generateId(), senderId: data.userId, recipientId: req.params.conversationId, text, createdAt: new Date().toISOString() };
      store.messages.push(message);
      saveStore(store);
    }
    res.json(message);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Comments: Get comments for a post
app.get('/api/posts/:postId/comments', async (req, res) => {
  try {
    let comments;
    if (mongoose) {
      const Comment = mongoose.model('Comment', new mongoose.Schema({
        postId: String, authorId: String, text: String, createdAt: { type: Date, default: Date.now }
      }));
      comments = await Comment.find({ postId: req.params.postId }).sort({ createdAt: 1 });
    } else {
      const store = loadStore();
      comments = (store.comments || []).filter(c => c.postId === req.params.postId).sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt));
    }
    res.json(comments);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Comments: Add comment to post
app.post('/api/posts/:postId/comments', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const data = verifyToken(token);
  if (!data) return res.status(401).json({ error: 'Not authenticated' });
  
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Comment text required' });
  
  try {
    let comment;
    if (mongoose) {
      const Comment = mongoose.model('Comment', new mongoose.Schema({
        postId: String, authorId: String, text: String, createdAt: { type: Date, default: Date.now }
      }));
      comment = await Comment.create({ postId: req.params.postId, authorId: data.userId, text });
      await Post.findByIdAndUpdate(req.params.postId, { $inc: { commentsCount: 1 } });
    } else {
      const store = loadStore();
      if (!store.comments) store.comments = [];
      comment = { id: generateId(), postId: req.params.postId, authorId: data.userId, text, createdAt: new Date().toISOString() };
      store.comments.push(comment);
      const post = store.posts.find(p => p.id === req.params.postId);
      if (post) post.commentsCount = (post.commentsCount || 0) + 1;
      saveStore(store);
    }
    res.json(comment);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Delete post
app.delete('/api/posts/:id', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const data = verifyToken(token);
  if (!data) return res.status(401).json({ error: 'Not authenticated' });
  
  try {
    if (mongoose) {
      const post = await Post.findOne({ _id: req.params.id, authorId: data.userId });
      if (!post) return res.status(404).json({ error: 'Post not found or not authorized' });
      await Post.findByIdAndDelete(req.params.id);
    } else {
      const store = loadStore();
      const postIndex = store.posts.findIndex(p => p.id === req.params.id && p.authorId === data.userId);
      if (postIndex === -1) return res.status(404).json({ error: 'Post not found or not authorized' });
      store.posts.splice(postIndex, 1);
      saveStore(store);
    }
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Get notifications
app.get('/api/notifications', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const data = verifyToken(token);
  if (!data) return res.status(401).json({ error: 'Not authenticated' });
  
  try {
    let notifications;
    if (mongoose) {
      notifications = await Notification.find({ userId: data.userId }).sort({ createdAt: -1 }).limit(50);
    } else {
      const store = loadStore();
      notifications = (store.notifications || []).filter(n => n.userId === data.userId).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 50);
    }
    res.json(notifications);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Mark notifications as read
app.post('/api/notifications/read', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const data = verifyToken(token);
  if (!data) return res.status(401).json({ error: 'Not authenticated' });
  
  try {
    if (mongoose) {
      await Notification.updateMany({ userId: data.userId, read: false }, { read: true });
    } else {
      const store = loadStore();
      if (store.notifications) {
        store.notifications.forEach(n => { if (n.userId === data.userId) n.read = true; });
        saveStore(store);
      }
    }
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Get unread notifications count
app.get('/api/notifications/unread', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const data = verifyToken(token);
  if (!data) return res.status(401).json({ error: 'Not authenticated' });
  
  try {
    let count;
    if (mongoose) {
      count = await Notification.countDocuments({ userId: data.userId, read: false });
    } else {
      const store = loadStore();
      count = (store.notifications || []).filter(n => n.userId === data.userId && !n.read).length;
    }
    res.json({ count });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Follow: Follow user
app.post('/api/users/:userId/follow', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const data = verifyToken(token);
  if (!data) return res.status(401).json({ error: 'Not authenticated' });
  
  if (data.userId === req.params.userId) {
    return res.status(400).json({ error: 'Cannot follow yourself' });
  }
  
  try {
    if (mongoose) {
      const existing = await Follow.findOne({ followerId: data.userId, followingId: req.params.userId });
      if (existing) return res.status(400).json({ error: 'Already following' });
      
      await Follow.create({ followerId: data.userId, followingId: req.params.userId });
    } else {
      const store = loadStore();
      if (!store.follows) store.follows = [];
      const existing = store.follows.find(f => f.followerId === data.userId && f.followingId === req.params.userId);
      if (existing) return res.status(400).json({ error: 'Already following' });
      
      store.follows.push({ followerId: data.userId, followingId: req.params.userId, createdAt: new Date().toISOString() });
      saveStore(store);
    }
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Follow: Unfollow user
app.delete('/api/users/:userId/follow', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const data = verifyToken(token);
  if (!data) return res.status(401).json({ error: 'Not authenticated' });
  
  try {
    if (mongoose) {
      await Follow.deleteOne({ followerId: data.userId, followingId: req.params.userId });
    } else {
      const store = loadStore();
      if (store.follows) {
        store.follows = store.follows.filter(f => !(f.followerId === data.userId && f.followingId === req.params.userId));
        saveStore(store);
      }
    }
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Get followers
app.get('/api/users/:userId/followers', async (req, res) => {
  try {
    let followers;
    if (mongoose) {
      const follows = await Follow.find({ followingId: req.params.userId });
      const followerIds = follows.map(f => f.followerId);
      followers = await User.find({ _id: { $in: followerIds } });
    } else {
      const store = loadStore();
      const followIds = (store.follows || []).filter(f => f.followingId === req.params.userId).map(f => f.followerId);
      followers = store.users.filter(u => followIds.includes(u.id));
    }
    res.json(followers.map(u => ({ id: u._id || u.id, username: u.username, firstName: u.firstName, lastName: u.lastName })));
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Get following
app.get('/api/users/:userId/following', async (req, res) => {
  try {
    let following;
    if (mongoose) {
      const follows = await Follow.find({ followerId: req.params.userId });
      const followingIds = follows.map(f => f.followingId);
      following = await User.find({ _id: { $in: followingIds } });
    } else {
      const store = loadStore();
      const followIds = (store.follows || []).filter(f => f.followerId === req.params.userId).map(f => f.followingId);
      following = store.users.filter(u => followIds.includes(u.id));
    }
    res.json(following.map(u => ({ id: u._id || u.id, username: u.username, firstName: u.firstName, lastName: u.lastName })));
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Get user profile with stats
app.get('/api/users/:userId/profile', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const currentUserId = token ? verifyToken(token)?.userId : null;
  
  try {
    let user, followersCount, followingCount, postsCount;
    
    if (mongoose) {
      user = await User.findById(req.params.userId);
      if (!user) return res.status(404).json({ error: 'User not found' });
      
      followersCount = await Follow.countDocuments({ followingId: req.params.userId });
      followingCount = await Follow.countDocuments({ followerId: req.params.userId });
      postsCount = await Post.countDocuments({ authorId: req.params.userId });
    } else {
      const store = loadStore();
      user = store.users.find(u => u.id === req.params.userId);
      if (!user) return res.status(404).json({ error: 'User not found' });
      
      followersCount = (store.follows || []).filter(f => f.followingId === req.params.userId).length;
      followingCount = (store.follows || []).filter(f => f.followerId === req.params.userId).length;
      postsCount = (store.posts || []).filter(p => p.authorId === req.params.userId).length;
    }
    
    // Check if verified
    let verified = false;
    if (followersCount >= 1000000) verified = 'gold';
    else if (followersCount >= 10000) verified = 'silver';
    else if (followersCount >= 1000) verified = 'blue';
    
    // Check if following
    let isFollowing = false;
    if (currentUserId && mongoose) {
      const follow = await Follow.findOne({ followerId: currentUserId, followingId: req.params.userId });
      isFollowing = !!follow;
    } else if (currentUserId) {
      const store = loadStore();
      isFollowing = (store.follows || []).some(f => f.followerId === currentUserId && f.followingId === req.params.userId);
    }
    
    res.json({ 
      id: user._id || user.id, 
      username: user.username, 
      firstName: user.firstName, 
      lastName: user.lastName,
      avatar: user.avatar,
      bio: user.bio,
      followersCount,
      followingCount,
      postsCount,
      verified,
      isFollowing
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Admin: Get all users
app.get('/api/admin/users', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const data = verifyToken(token);
  
  // Simple admin check - in production use proper admin role
  if (!data || data.userId !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }
  
  try {
    let users;
    if (mongoose) {
      users = await User.find();
    } else {
      const store = loadStore();
      users = store.users;
    }
    
    const result = users.map(u => ({
      id: u._id || u.id,
      username: u.username,
      firstName: u.firstName,
      lastName: u.lastName,
      createdAt: u.createdAt
    }));
    
    res.json(result);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Admin: Add followers
app.post('/api/admin/add-followers', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const data = verifyToken(token);
  
  if (!data || data.userId !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }
  
  const { targetUserId, count } = req.body;
  
  try {
    // Add fake followers (for demo)
    res.json({ success: true, added: count });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Admin: Add likes
app.post('/api/admin/add-likes', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const data = verifyToken(token);
  
  if (!data || data.userId !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }
  
  const { postId, count } = req.body;
  
  try {
    if (mongoose) {
      const post = await Post.findById(postId);
      if (post) {
        post.likesCount = (post.likesCount || 0) + count;
        await post.save();
      }
    } else {
      const store = loadStore();
      const post = store.posts.find(p => p.id === postId);
      if (post) {
        post.likesCount = (post.likesCount || 0) + count;
        saveStore(store);
      }
    }
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Upload image for post (as Base64 for persistence on Render)
app.post('/api/posts/upload', upload.single('image'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Read file and convert to base64
    const fs = require('fs');
    const imagePath = req.file.path;
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = req.file.mimetype;
    const dataUrl = `data:${mimeType};base64,${base64Image}`;
    
    // Delete the temp file
    fs.unlinkSync(imagePath);
    
    res.json({ image: dataUrl });
});

// Get all posts feed (for feed)
app.get('/api/feed', async (req, res) => {
  try {
    let posts;
    if (isMongoReady()) {
      posts = await Post.find().sort({ createdAt: -1 }).limit(50);
    } else {
      const store = loadStore();
      posts = store.posts.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 50);
    }
    
    const result = await Promise.all(posts.map(async p => {
      let authorName = 'Unknown';
      if (isMongoReady()) {
        const author = await User.findById(p.authorId);
        authorName = author?.username || 'Unknown';
      } else {
        const store = loadStore();
        const author = store.users.find(u => u.id === p.authorId);
        authorName = author?.username || 'Unknown';
      }
      return { ...p.toObject(), authorName };
    }));
    
    res.json(result);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Search users
app.get('/api/search', async (req, res) => {
  const query = req.query.q || '';
  if (query.length < 2) return res.json([]);
  
  try {
    let users;
    if (isMongoReady()) {
      users = await User.find({ username: { $regex: query, $options: 'i' } }).limit(20);
    } else {
      const store = loadStore();
      users = store.users.filter(u => u.username.toLowerCase().includes(query.toLowerCase())).slice(0, 20);
    }
    res.json(users.map(u => ({ id: u._id || u.id, username: u.username, firstName: u.firstName, lastName: u.lastName, avatar: u.avatar })));
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Mark messages as read
app.post('/api/messages/read/:userId', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const data = verifyToken(token);
  if (!data) return res.status(401).json({ error: 'Not authenticated' });
  
  try {
    if (isMongoReady()) {
      await Message.updateMany({ senderId: req.params.userId, recipientId: data.userId, read: false }, { read: true });
    } else {
      const store = loadStore();
      store.messages.forEach(m => {
        if (m.senderId === req.params.userId && m.recipientId === data.userId) m.read = true;
      });
      saveStore(store);
    }
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Get unread messages count
app.get('/api/messages/unread', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const data = verifyToken(token);
  if (!data) return res.status(401).json({ error: 'Not authenticated' });
  
  try {
    let count;
    if (isMongoReady()) {
      count = await Message.countDocuments({ recipientId: data.userId, read: false });
    } else {
      const store = loadStore();
      count = store.messages.filter(m => m.recipientId === data.userId && !m.read).length;
    }
    res.json({ count });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Update privacy settings
app.put('/api/auth/privacy', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const data = verifyToken(token);
  if (!data) return res.status(401).json({ error: 'Not authenticated' });
  
  const { isPrivate } = req.body;
  
  try {
    if (mongoose) {
      await User.findByIdAndUpdate(data.userId, { isPrivate: isPrivate });
    } else {
      const store = loadStore();
      const userIndex = store.users.findIndex(u => u.id === data.userId);
      if (userIndex !== -1) {
        store.users[userIndex].isPrivate = isPrivate;
        saveStore(store);
      }
    }
    res.json({ success: true, isPrivate });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Send follow request
app.post('/api/users/:userId/follow-request', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const data = verifyToken(token);
  if (!data) return res.status(401).json({ error: 'Not authenticated' });
  
  if (data.userId === req.params.userId) {
    return res.status(400).json({ error: 'Cannot follow yourself' });
  }
  
  try {
    if (mongoose) {
      const existing = await FollowRequest.findOne({ fromUserId: data.userId, toUserId: req.params.userId, status: 'pending' });
      if (existing) return res.status(400).json({ error: 'Request already sent' });
      
      await FollowRequest.create({ fromUserId: data.userId, toUserId: req.params.userId, status: 'pending' });
    } else {
      const store = loadStore();
      if (!store.followRequests) store.followRequests = [];
      const existing = store.followRequests.find(r => r.fromUserId === data.userId && r.toUserId === req.params.userId && r.status === 'pending');
      if (existing) return res.status(400).json({ error: 'Request already sent' });
      
      store.followRequests.push({ id: generateId(), fromUserId: data.userId, toUserId: req.params.userId, status: 'pending', createdAt: new Date().toISOString() });
      saveStore(store);
    }
    res.json({ success: true, message: 'Follow request sent' });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Get follow requests (for current user)
app.get('/api/follow-requests', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const data = verifyToken(token);
  if (!data) return res.status(401).json({ error: 'Not authenticated' });
  
  try {
    let requests;
    if (mongoose) {
      requests = await FollowRequest.find({ toUserId: data.userId, status: 'pending' }).populate('fromUserId');
    } else {
      const store = loadStore();
      requests = (store.followRequests || []).filter(r => r.toUserId === data.userId && r.status === 'pending');
      requests = requests.map(r => {
        const fromUser = store.users.find(u => u.id === r.fromUserId);
        return { ...r, fromUserId: fromUser ? { _id: fromUser.id, username: fromUser.username, firstName: fromUser.firstName, lastName: fromUser.lastName } : null };
      });
    }
    res.json(requests);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Approve/reject follow request
app.post('/api/follow-requests/:requestId', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const data = verifyToken(token);
  if (!data) return res.status(401).json({ error: 'Not authenticated' });
  
  const { action } = req.body; // 'approve' or 'reject'
  
  try {
    let request;
    if (mongoose) {
      request = await FollowRequest.findById(req.params.requestId);
      if (!request) return res.status(404).json({ error: 'Request not found' });
      if (request.toUserId !== data.userId) return res.status(403).json({ error: 'Not authorized' });
      
      request.status = action === 'approve' ? 'approved' : 'rejected';
      await request.save();
      
      if (action === 'approved') {
        await Follow.create({ followerId: request.fromUserId, followingId: data.userId, approved: true });
      }
    } else {
      const store = loadStore();
      if (!store.followRequests) store.followRequests = [];
      const reqIndex = store.followRequests.findIndex(r => r.id === req.params.requestId);
      if (reqIndex === -1) return res.status(404).json({ error: 'Request not found' });
      
      if (store.followRequests[reqIndex].toUserId !== data.userId) return res.status(403).json({ error: 'Not authorized' });
      
      store.followRequests[reqIndex].status = action === 'approve' ? 'approved' : 'rejected';
      
      if (action === 'approved') {
        if (!store.follows) store.follows = [];
        store.follows.push({ followerId: store.followRequests[reqIndex].fromUserId, followingId: data.userId, approved: true, createdAt: new Date().toISOString() });
      }
      saveStore(store);
    }
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Upload avatar (as Base64)
app.post('/api/auth/avatar', upload.single('avatar'), async (req, res) => {
    const token = req.headers.authorization?.split(' ');
    const data = verifyToken(token);
    if (!data) return res.status(401).json({ error: 'Not authenticated' });
    
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const fs = require('fs');
    const imageBuffer = fs.readFileSync(req.file.path);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = req.file.mimetype;
    const dataUrl = `data:${mimeType};base64,${base64Image}`;
    fs.unlinkSync(req.file.path);
    
    try {
        if (mongoose) {
            await User.findByIdAndUpdate(data.userId, { avatar: dataUrl });
        } else {
            const store = loadStore();
            const userIndex = store.users.findIndex(u => u.id === data.userId);
            if (userIndex !== -1) {
                store.users[userIndex].avatar = dataUrl;
                saveStore(store);
            }
        }
        res.json({ avatar: dataUrl });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

// ===== START =====
async function start() {
  const mongoReady = await initMongoDB();
  
  if (mongoReady) {
    console.log('✅ Using MongoDB');
  } else {
    console.log('✅ Using file-based storage');
  }
  
  app.listen(PORT, () => {
    console.log(`Quik server running on http://0.0.0.0:${PORT}`);
  });
}

start();
