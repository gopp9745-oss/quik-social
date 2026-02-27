const express = require('express');
const router = express.Router();
const db = require('../models/db');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'quik_secret_key_2024';

// Middleware to check auth
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

// Get stories for feed (stories from friends)
router.get('/', auth, async (req, res) => {
  try {
    await db.read();
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // Get user's friends
    const friendships = db.data.friendships.filter(f => 
      (f.userId === req.user.id || f.friendId === req.user.id) && 
      f.status === 'accepted'
    );
    const friendIds = friendships.map(f => 
      f.userId === req.user.id ? f.friendId : f.userId
    );
    friendIds.push(req.user.id); // Include own stories
    
    // Get active stories (not expired)
    const stories = db.data.stories.filter(s => 
      friendIds.includes(s.userId) && 
      new Date(s.createdAt) > twentyFourHoursAgo
    );
    
    // Group by user
    const groupedStories = {};
    for (const story of stories) {
      if (!groupedStories[story.userId]) {
        const user = db.data.users.find(u => u.id === story.userId);
        groupedStories[story.userId] = {
          user: {
            id: user?.id,
            username: user?.username,
            firstName: user?.firstName,
            lastName: user?.lastName,
            avatar: user?.avatar
          },
          stories: []
        };
      }
      groupedStories[story.userId].stories.push(story);
    }
    
    res.json(Object.values(groupedStories));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Create story
router.post('/', auth, async (req, res) => {
  try {
    await db.read();
    const { content, image } = req.body;
    
    const story = {
      id: uuidv4(),
      userId: req.user.id,
      content,
      image,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };
    
    db.data.stories.push(story);
    await db.write();
    
    res.json(story);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Delete story
router.delete('/:id', auth, async (req, res) => {
  try {
    await db.read();
    const index = db.data.stories.findIndex(s => 
      s.id === req.params.id && s.userId === req.user.id
    );
    
    if (index === -1) return res.status(404).json({ error: 'Story not found' });
    
    db.data.stories.splice(index, 1);
    await db.write();
    
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
