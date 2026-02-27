const express = require('express');
const router = express.Router();
const db = require('../models/db');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'quik_secret_key_2024';

const auth = async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    await db.read();
    const user = db.data.users.find(u => u.id === decoded.userId);
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = user;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Get all bookmarks
router.get('/', auth, async (req, res) => {
  try {
    await db.read();
    const bookmarks = db.data.bookmarks.filter(b => b.userId === req.user.id);
    
    // Get post details
    const posts = bookmarks.map(b => {
      const post = db.data.posts.find(p => p.id === b.postId);
      if (!post) return null;
      
      const author = db.data.users.find(u => u.id === post.authorId);
      return {
        ...post,
        authorName: author ? `${author.firstName} ${author.lastName}`.trim() : 'Unknown',
        authorUsername: author?.username || 'unknown',
        authorAvatar: author?.avatar,
        savedAt: b.createdAt
      };
    }).filter(p => p !== null);
    
    res.json(posts);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Add bookmark
router.post('/:postId', auth, async (req, res) => {
  try {
    await db.read();
    const { postId } = req.params;
    
    const post = db.data.posts.find(p => p.id === postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    
    // Check if already bookmarked
    const existing = db.data.bookmarks.find(b => 
      b.postId === postId && b.userId === req.user.id
    );
    
    if (existing) {
      return res.status(400).json({ error: 'Already bookmarked' });
    }
    
    const bookmark = {
      id: uuidv4(),
      postId,
      userId: req.user.id,
      createdAt: new Date().toISOString()
    };
    
    db.data.bookmarks.push(bookmark);
    await db.write();
    
    res.json({ success: true, bookmark });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Remove bookmark
router.delete('/:postId', auth, async (req, res) => {
  try {
    await db.read();
    const { postId } = req.params;
    
    const index = db.data.bookmarks.findIndex(b => 
      b.postId === postId && b.userId === req.user.id
    );
    
    if (index === -1) {
      return res.status(404).json({ error: 'Bookmark not found' });
    }
    
    db.data.bookmarks.splice(index, 1);
    await db.write();
    
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Check if post is bookmarked
router.get('/:postId/status', auth, async (req, res) => {
  try {
    await db.read();
    const { postId } = req.params;
    
    const bookmark = db.data.bookmarks.find(b => 
      b.postId === postId && b.userId === req.user.id
    );
    
    res.json({ bookmarked: !!bookmark });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
