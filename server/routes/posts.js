const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../models/db');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();
const JWT_SECRET = 'quik-secret-key-2024';

// Middleware to check auth
const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Determine uploads folder location
let uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  uploadsDir = path.join(__dirname, 'uploads');
}
if (!fs.existsSync(uploadsDir)) {
  uploadsDir = path.join(process.cwd(), 'uploads');
}
// Create uploads directory if it doesn't exist
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for image upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({ storage });

// Create post
router.post('/', auth, async (req, res) => {
  try {
    const { content, image } = req.body;
    
    await db.read();
    
    const user = db.data.users.find(u => u.id === req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const post = {
      id: uuidv4(),
      userId: req.userId,
      authorName: `${user.firstName} ${user.lastName}`.trim() || user.username,
      authorUsername: user.username,
      authorAvatar: user.avatar,
      content: content || '',
      image: image || '',
      likes: [],
      comments: [],
      createdAt: new Date().toISOString()
    };
    
    db.data.posts.unshift(post);
    await db.write();
    
    res.json(post);
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Upload image for post (save as Base64 for persistence)
router.post('/upload', auth, upload.single('image'), async (req, res) => {
  try {
    const fs = require('fs');
    const imagePath = req.file.path;
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = req.file.mimetype;
    const dataUrl = `data:${mimeType};base64,${base64Image}`;
    
    // Delete the temp file
    fs.unlinkSync(imagePath);
    
    res.json({ image: dataUrl });
  } catch (error) {
    console.error('Upload image error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all posts
router.get('/', auth, async (req, res) => {
  try {
    await db.read();
    const posts = db.data.posts.map(post => ({
      ...post,
      likesCount: post.likes.length,
      commentsCount: post.comments.length,
      isLiked: post.likes.includes(req.userId)
    }));
    res.json(posts);
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user's posts
router.get('/user/:userId', auth, async (req, res) => {
  try {
    await db.read();
    const userPosts = db.data.posts
      .filter(p => p.userId === req.params.userId)
      .map(post => ({
        ...post,
        likesCount: post.likes.length,
        commentsCount: post.comments.length,
        isLiked: post.likes.includes(req.userId)
      }));
    res.json(userPosts);
  } catch (error) {
    console.error('Get user posts error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Like post
router.post('/:id/like', auth, async (req, res) => {
  try {
    await db.read();
    
    const postIndex = db.data.posts.findIndex(p => p.id === req.params.id);
    if (postIndex === -1) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    const post = db.data.posts[postIndex];
    const likeIndex = post.likes.indexOf(req.userId);
    
    if (likeIndex > -1) {
      post.likes.splice(likeIndex, 1);
    } else {
      post.likes.push(req.userId);
    }
    
    await db.write();
    
    res.json({ likesCount: post.likes.length, isLiked: post.likes.includes(req.userId) });
  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add comment
router.post('/:id/comment', auth, async (req, res) => {
  try {
    const { text } = req.body;
    
    await db.read();
    
    const postIndex = db.data.posts.findIndex(p => p.id === req.params.id);
    if (postIndex === -1) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    const user = db.data.users.find(u => u.id === req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const comment = {
      id: uuidv4(),
      userId: req.userId,
      authorName: `${user.firstName} ${user.lastName}`.trim() || user.username,
      authorUsername: user.username,
      authorAvatar: user.avatar,
      text,
      createdAt: new Date().toISOString()
    };
    
    db.data.posts[postIndex].comments.push(comment);
    await db.write();
    
    res.json(comment);
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete post
router.delete('/:id', auth, async (req, res) => {
  try {
    await db.read();
    
    const postIndex = db.data.posts.findIndex(p => p.id === req.params.id && p.userId === req.userId);
    if (postIndex === -1) {
      return res.status(404).json({ error: 'Post not found or not authorized' });
    }
    
    db.data.posts.splice(postIndex, 1);
    await db.write();
    
    res.json({ message: 'Post deleted' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
