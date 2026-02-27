const express = require('express')
const fs = require('fs')
const path = require('path')
const cors = require('cors')
const crypto = require('crypto')

const PORT = process.env.PORT || 3000
const STORE_FILE = path.join(__dirname, 'store.json')

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

const app = express()
app.use(cors())
app.use(express.json({limit:'5mb'}))

// Serve static files (the client)
app.use(express.static(path.join(__dirname)))

// Generate UUID
function generateId() {
  return crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Simple JWT-like token (for demo)
function createToken(user) {
  return Buffer.from(JSON.stringify({ userId: user.id, time: Date.now() })).toString('base64');
}

function verifyToken(token) {
  try {
    return JSON.parse(Buffer.from(token, 'base64').toString());
  } catch(e) { return null; }
}

// Auth: Register
app.post('/api/auth/register', (req, res) => {
  const { username, password, firstName, lastName } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  
  const store = loadStore();
  const existing = store.users.find(u => u.username === username);
  if (existing) {
    return res.status(400).json({ error: 'User already exists' });
  }
  
  const user = {
    id: generateId(),
    username,
    password, // In production, hash this!
    firstName: firstName || '',
    lastName: lastName || '',
    avatar: '',
    bio: '',
    createdAt: new Date().toISOString()
  };
  
  store.users.push(user);
  saveStore(store);
  
  const token = createToken(user);
  res.json({ token, user: { id: user.id, username: user.username, email: username + '@quik.local', firstName: user.firstName, lastName: user.lastName, avatar: user.avatar } });
});

// Auth: Login
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  
  const store = loadStore();
  const user = store.users.find(u => u.username === username && u.password === password);
  if (!user) {
    return res.status(400).json({ error: 'Invalid credentials' });
  }
  
  const token = createToken(user);
  res.json({ token, user: { id: user.id, username: user.username, email: user.email || username + '@quik.local', firstName: user.firstName, lastName: user.lastName, avatar: user.avatar, bio: user.bio } });
});

// Auth: Me
app.get('/api/auth/me', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  
  const data = verifyToken(token);
  if (!data) return res.status(401).json({ error: 'Invalid token' });
  
  const store = loadStore();
  const user = store.users.find(u => u.id === data.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  res.json({ id: user.id, username: user.username, email: user.email, firstName: user.firstName, lastName: user.lastName, avatar: user.avatar, bio: user.bio });
});

// Get all posts
app.get('/api/posts', (req, res) => {
  const store = loadStore();
  const posts = store.posts.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(posts.map(p => ({
    ...p,
    authorName: store.users.find(u => u.id === p.authorId)?.username || 'Unknown'
  })));
});

// Create post
app.post('/api/posts', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const data = verifyToken(token);
  if (!data) return res.status(401).json({ error: 'Not authenticated' });
  
  const { content, image } = req.body;
  const store = loadStore();
  
  const post = {
    id: generateId(),
    authorId: data.userId,
    content,
    image: image || '',
    likesCount: 0,
    commentsCount: 0,
    isLiked: false,
    createdAt: new Date().toISOString()
  };
  
  store.posts.push(post);
  saveStore(store);
  res.json(post);
});

// Like post
app.post('/api/posts/:id/like', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const data = verifyToken(token);
  if (!data) return res.status(401).json({ error: 'Not authenticated' });
  
  const store = loadStore();
  const post = store.posts.find(p => p.id === req.params.id);
  if (post) {
    post.likesCount = (post.likesCount || 0) + 1;
    saveStore(store);
    res.json({ likesCount: post.likesCount });
  } else {
    res.status(404).json({ error: 'Post not found' });
  }
});

// Get all users
app.get('/api/users', (req, res) => {
  const store = loadStore();
  res.json(store.users.map(u => ({ id: u.id, username: u.username, firstName: u.firstName, lastName: u.lastName, avatar: u.avatar })));
});

// Get groups
app.get('/api/groups', (req, res) => {
  const store = loadStore();
  res.json(store.groups);
});

// Create group
app.post('/api/groups', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const data = verifyToken(token);
  if (!data) return res.status(401).json({ error: 'Not authenticated' });
  
  const { name, description } = req.body;
  const store = loadStore();
  
  const group = {
    id: generateId(),
    name,
    description: description || '',
    ownerId: data.userId,
    membersCount: 1,
    createdAt: new Date().toISOString()
  };
  
  store.groups.push(group);
  saveStore(store);
  res.json(group);
});

// Get conversations
app.get('/api/messages/conversations', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const data = verifyToken(token);
  if (!data) return res.status(401).json({ error: 'Not authenticated' });
  
  const store = loadStore();
  const messages = store.messages.filter(m => m.senderId === data.userId || m.recipientId === data.userId);
  
  // Group by other user
  const convMap = {};
  messages.forEach(m => {
    const otherId = m.senderId === data.userId ? m.recipientId : m.senderId;
    if (!convMap[otherId]) {
      const otherUser = store.users.find(u => u.id === otherId);
      convMap[otherId] = { id: otherId, otherUser, lastMessage: m };
    }
  });
  
  res.json(Object.values(convMap));
});

// Create/Get conversation with user
app.get('/api/messages/conversation/:userId', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const data = verifyToken(token);
  if (!data) return res.status(401).json({ error: 'Not authenticated' });
  
  const store = loadStore();
  res.json({ id: req.params.userId, otherUser: store.users.find(u => u.id === req.params.userId) });
});

// Send message
app.post('/api/messages/:conversationId', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const data = verifyToken(token);
  if (!data) return res.status(401).json({ error: 'Not authenticated' });
  
  const { text } = req.body;
  const store = loadStore();
  
  const message = {
    id: generateId(),
    senderId: data.userId,
    recipientId: req.params.conversationId,
    text,
    createdAt: new Date().toISOString()
  };
  
  store.messages.push(message);
  saveStore(store);
  res.json(message);
});

// API: get full store
app.get('/api/store', (req,res)=>{
  const st = loadStore()
  res.json(st)
})

// API: replace store (write full)
app.post('/api/store', (req,res)=>{
  const body = req.body
  if(!body || typeof body !== 'object') return res.status(400).json({ok:false,reason:'invalid body'})
  const ok = saveStore(body)
  if(ok) return res.json({ok:true})
  return res.status(500).json({ok:false})
})

app.listen(PORT, ()=>{
  console.log('Quik server running on http://0.0.0.0:' + PORT)
})
