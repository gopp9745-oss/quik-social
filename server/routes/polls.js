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

// Create a poll
router.post('/', auth, async (req, res) => {
  try {
    await db.read();
    const { question, options, expiresIn } = req.body;
    
    if (!question || !options || options.length < 2) {
      return res.status(400).json({ error: 'Question and at least 2 options required' });
    }
    
    const poll = {
      id: uuidv4(),
      authorId: req.user.id,
      question,
      options: options.map((text, index) => ({
        id: index.toString(),
        text,
        votes: 0,
        voters: []
      })),
      totalVotes: 0,
      isActive: true,
      expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
      createdAt: new Date().toISOString()
    };
    
    db.data.polls.push(poll);
    await db.write();
    
    res.json(poll);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get a poll by ID
router.get('/:id', auth, async (req, res) => {
  try {
    await db.read();
    const poll = db.data.polls.find(p => p.id === req.params.id);
    
    if (!poll) return res.status(404).json({ error: 'Poll not found' });
    
    // Check if user has voted
    const userVoted = poll.options.some(o => o.voters.includes(req.user.id));
    const userChoice = poll.options.find(o => o.voters.includes(req.user.id))?.id;
    
    // Get author info
    const author = db.data.users.find(u => u.id === poll.authorId);
    
    res.json({
      ...poll,
      authorName: author ? `${author.firstName} ${author.lastName}`.trim() : 'Unknown',
      authorAvatar: author?.avatar,
      userVoted,
      userChoice,
      isExpired: poll.expiresAt && new Date(poll.expiresAt) < new Date()
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Vote on a poll
router.post('/:id/vote', auth, async (req, res) => {
  try {
    await db.read();
    const { optionId } = req.body;
    const poll = db.data.polls.find(p => p.id === req.params.id);
    
    if (!poll) return res.status(404).json({ error: 'Poll not found' });
    
    // Check if poll is expired
    if (poll.expiresAt && new Date(poll.expiresAt) < new Date()) {
      return res.status(400).json({ error: 'Poll has expired' });
    }
    
    // Check if user already voted
    if (poll.options.some(o => o.voters.includes(req.user.id))) {
      return res.status(400).json({ error: 'Already voted' });
    }
    
    const option = poll.options.find(o => o.id === optionId);
    if (!option) return res.status(400).json({ error: 'Invalid option' });
    
    // Add vote
    option.votes++;
    option.voters.push(req.user.id);
    poll.totalVotes++;
    
    await db.write();
    
    res.json(poll);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Delete a poll (only author can delete)
router.delete('/:id', auth, async (req, res) => {
  try {
    await db.read();
    const index = db.data.polls.findIndex(p => 
      p.id === req.params.id && p.authorId === req.user.id
    );
    
    if (index === -1) return res.status(404).json({ error: 'Poll not found or not authorized' });
    
    db.data.polls.splice(index, 1);
    await db.write();
    
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
