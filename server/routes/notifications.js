const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../models/db');

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

// Get all notifications
router.get('/', auth, async (req, res) => {
  try {
    await db.read();
    
    const notifications = db.data.notifications
      .filter(n => n.userId === req.userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json(notifications);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get unread notifications count
router.get('/unread', auth, async (req, res) => {
  try {
    await db.read();
    
    const count = db.data.notifications.filter(n => n.userId === req.userId && !n.read).length;
    
    res.json({ count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Mark notification as read
router.post('/:id/read', auth, async (req, res) => {
  try {
    await db.read();
    
    const notification = db.data.notifications.find(n => 
      n.id === req.params.id && n.userId === req.userId
    );
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    notification.read = true;
    await db.write();
    
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Mark all notifications as read
router.post('/read-all', auth, async (req, res) => {
  try {
    await db.read();
    
    db.data.notifications
      .filter(n => n.userId === req.userId)
      .forEach(n => n.read = true);
    
    await db.write();
    
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete notification
router.delete('/:id', auth, async (req, res) => {
  try {
    await db.read();
    
    const notificationIndex = db.data.notifications.findIndex(n => 
      n.id === req.params.id && n.userId === req.userId
    );
    
    if (notificationIndex === -1) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    db.data.notifications.splice(notificationIndex, 1);
    await db.write();
    
    res.json({ message: 'Notification deleted' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete all notifications
router.delete('/', auth, async (req, res) => {
  try {
    await db.read();
    
    db.data.notifications = db.data.notifications.filter(n => n.userId !== req.userId);
    await db.write();
    
    res.json({ message: 'All notifications deleted' });
  } catch (error) {
    console.error('Delete all notifications error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
