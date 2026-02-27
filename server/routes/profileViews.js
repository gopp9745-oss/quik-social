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

// Track profile view
router.post('/track/:userId', auth, async (req, res) => {
  try {
    await db.read();
    const { userId } = req.params;
    
    // Don't track own profile views
    if (userId === req.user.id) {
      return res.json({ success: true });
    }
    
    const view = {
      id: uuidv4(),
      profileOwnerId: userId,
      viewerId: req.user.id,
      createdAt: new Date().toISOString()
    };
    
    db.data.profileViews.push(view);
    await db.write();
    
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get profile views for current user
router.get('/', auth, async (req, res) => {
  try {
    await db.read();
    const views = db.data.profileViews
      .filter(v => v.profileOwnerId === req.user.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Get viewer details
    const viewsWithDetails = views.map(v => {
      const viewer = db.data.users.find(u => u.id === v.viewerId);
      return {
        id: v.id,
        viewerId: v.viewerId,
        viewerName: viewer ? `${viewer.firstName} ${viewer.lastName}`.trim() : 'Unknown',
        viewerUsername: viewer?.username || 'unknown',
        viewerAvatar: viewer?.avatar,
        viewedAt: v.createdAt
      };
    });
    
    // Group by date
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();
    
    const todayViews = viewsWithDetails.filter(v => new Date(v.viewedAt).toDateString() === today);
    const yesterdayViews = viewsWithDetails.filter(v => new Date(v.viewedAt).toDateString() === yesterday);
    const olderViews = viewsWithDetails.filter(v => 
      new Date(v.viewedAt).toDateString() !== today && 
      new Date(v.viewedAt).toDateString() !== yesterday
    );
    
    res.json({
      total: views.length,
      today: todayViews.length,
      yesterday: yesterdayViews.length,
      todayViews,
      yesterdayViews,
      olderViews
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get total view count
router.get('/count', auth, async (req, res) => {
  try {
    await db.read();
    const count = db.data.profileViews.filter(v => v.profileOwnerId === req.user.id).length;
    res.json({ count });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
