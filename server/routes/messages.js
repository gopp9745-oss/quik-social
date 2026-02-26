const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../models/db');
const { v4: uuidv4 } = require('uuid');

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

// Get or create conversation with user
router.get('/conversation/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    await db.read();
    
    // Find existing conversation
    let conversation = db.data.conversations.find(c => 
      (c.participants.includes(req.userId) && c.participants.includes(userId))
    );
    
    if (!conversation) {
      // Create new conversation
      conversation = {
        id: uuidv4(),
        participants: [req.userId, userId],
        messages: [],
        createdAt: new Date().toISOString()
      };
      db.data.conversations.push(conversation);
      await db.write();
    }
    
    // Get other user info
    const otherUser = db.data.users.find(u => u.id === userId);
    
    res.json({
      id: conversation.id,
      otherUser: otherUser ? {
        id: otherUser.id,
        username: otherUser.username,
        firstName: otherUser.firstName,
        lastName: otherUser.lastName,
        avatar: otherUser.avatar
      } : null,
      messages: conversation.messages
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all conversations
router.get('/conversations', auth, async (req, res) => {
  try {
    await db.read();
    
    const userConversations = db.data.conversations
      .filter(c => c.participants.includes(req.userId))
      .map(conversation => {
        const otherUserId = conversation.participants.find(p => p !== req.userId);
        const otherUser = db.data.users.find(u => u.id === otherUserId);
        const lastMessage = conversation.messages[conversation.messages.length - 1];
        
        return {
          id: conversation.id,
          otherUser: otherUser ? {
            id: otherUser.id,
            username: otherUser.username,
            firstName: otherUser.firstName,
            lastName: otherUser.lastName,
            avatar: otherUser.avatar
          } : null,
          lastMessage,
          unreadCount: conversation.messages.filter(m => m.recipientId === req.userId && !m.read).length
        };
      });
    
    res.json(userConversations);
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get messages in conversation
router.get('/:conversationId', auth, async (req, res) => {
  try {
    await db.read();
    
    const conversation = db.data.conversations.find(c => 
      c.id === req.params.conversationId && c.participants.includes(req.userId)
    );
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    // Mark messages as read
    conversation.messages.forEach(m => {
      if (m.recipientId === req.userId) {
        m.read = true;
      }
    });
    await db.write();
    
    res.json(conversation.messages);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Send message
router.post('/:conversationId', auth, async (req, res) => {
  try {
    const { text } = req.body;
    
    await db.read();
    
    const conversation = db.data.conversations.find(c => 
      c.id === req.params.conversationId && c.participants.includes(req.userId)
    );
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    const sender = db.data.users.find(u => u.id === req.userId);
    const recipientId = conversation.participants.find(p => p !== req.userId);
    
    const message = {
      id: uuidv4(),
      senderId: req.userId,
      recipientId,
      senderName: sender ? `${sender.firstName} ${sender.lastName}`.trim() || sender.username : 'Unknown',
      senderAvatar: sender?.avatar || '',
      text,
      read: false,
      createdAt: new Date().toISOString()
    };
    
    conversation.messages.push(message);
    await db.write();
    
    // Emit socket event
    const io = req.app.get('io');
    io.emit('newMessage', message);
    
    res.json(message);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
