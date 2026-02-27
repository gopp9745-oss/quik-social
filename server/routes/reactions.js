const express = require('express');
const router = express.Router();
const db = require('../models/db');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'quik_secret_key_2024';

// Available reactions
const REACTION_TYPES = ['like', 'love', 'haha', 'wow', 'sad', 'angry'];

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

// React to a post
router.post('/post/:postId', auth, async (req, res) => {
  try {
    await db.read();
    const { postId } = req.params;
    const { type } = req.body;
    
    if (!REACTION_TYPES.includes(type)) {
      return res.status(400).json({ error: 'Invalid reaction type' });
    }
    
    const post = db.data.posts.find(p => p.id === postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    
    // Remove existing reaction
    const existingIndex = db.data.reactions.findIndex(r => 
      r.postId === postId && r.userId === req.user.id
    );
    
    if (existingIndex !== -1) {
      if (db.data.reactions[existingIndex].type === type) {
        // Remove reaction if same type
        db.data.reactions.splice(existingIndex, 1);
      } else {
        // Update reaction type
        db.data.reactions[existingIndex].type = type;
      }
    } else {
      // Add new reaction
      db.data.reactions.push({
        id: uuidv4(),
        postId,
        userId: req.user.id,
        type,
        createdAt: new Date().toISOString()
      });
    }
    
    await db.write();
    
    // Get updated reactions count
    const reactions = db.data.reactions.filter(r => r.postId === postId);
    const reactionsCount = reactions.length;
    const userReaction = reactions.find(r => r.userId === req.user.id)?.type || null;
    
    res.json({ reactionsCount, userReaction, reactions });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get reactions for a post
router.get('/post/:postId', auth, async (req, res) => {
  try {
    await db.read();
    const { postId } = req.params;
    
    const reactions = db.data.reactions.filter(r => r.postId === postId);
    const reactionsByType = {};
    
    for (const type of REACTION_TYPES) {
      reactionsByType[type] = reactions.filter(r => r.type === type).map(r => {
        const user = db.data.users.find(u => u.id === r.userId);
        return {
          id: r.id,
          userId: r.userId,
          userName: user ? `${user.firstName} ${user.lastName}` : 'Unknown'
        };
      });
    }
    
    const userReaction = reactions.find(r => r.userId === req.user.id)?.type || null;
    
    res.json({ 
      total: reactions.length,
      userReaction,
      byType: reactionsByType 
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
