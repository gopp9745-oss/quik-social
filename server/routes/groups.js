const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../models/db');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');

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

// Configure multer for image upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({ storage });

// Create group
router.post('/', auth, async (req, res) => {
  try {
    const { name, description, isPrivate } = req.body;
    
    await db.read();
    
    const user = db.data.users.find(u => u.id === req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const group = {
      id: uuidv4(),
      name,
      description: description || '',
      avatar: '',
      cover: '',
      ownerId: req.userId,
      isPrivate: isPrivate || false,
      members: [req.userId],
      posts: [],
      createdAt: new Date().toISOString()
    };
    
    db.data.groups.push(group);
    db.data.groupMembers.push({
      groupId: group.id,
      userId: req.userId,
      role: 'admin',
      joinedAt: new Date().toISOString()
    });
    
    await db.write();
    
    res.json(group);
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all groups
router.get('/', auth, async (req, res) => {
  try {
    await db.read();
    const groups = db.data.groups.map(g => ({
      id: g.id,
      name: g.name,
      description: g.description,
      avatar: g.avatar,
      cover: g.cover,
      ownerId: g.ownerId,
      isPrivate: g.isPrivate,
      membersCount: g.members.length,
      isMember: g.members.includes(req.userId)
    }));
    res.json(groups);
  } catch (error) {
    console.error('Get groups error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user's groups
router.get('/my', auth, async (req, res) => {
  try {
    await db.read();
    const userGroupIds = db.data.groupMembers
      .filter(gm => gm.userId === req.userId)
      .map(gm => gm.groupId);
    
    const userGroups = db.data.groups
      .filter(g => userGroupIds.includes(g.id))
      .map(g => ({
        id: g.id,
        name: g.name,
        description: g.description,
        avatar: g.avatar,
        membersCount: g.members.length
      }));
    
    res.json(userGroups);
  } catch (error) {
    console.error('Get my groups error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get group by ID
router.get('/:id', auth, async (req, res) => {
  try {
    await db.read();
    const group = db.data.groups.find(g => g.id === req.params.id);
    
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    const memberInfo = db.data.groupMembers.find(
      gm => gm.groupId === group.id && gm.userId === req.userId
    );
    
    res.json({
      ...group,
      isMember: group.members.includes(req.userId),
      userRole: memberInfo?.role || null,
      membersCount: group.members.length
    });
  } catch (error) {
    console.error('Get group error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update group
router.put('/:id', auth, async (req, res) => {
  try {
    const { name, description, isPrivate } = req.body;
    
    await db.read();
    
    const groupIndex = db.data.groups.findIndex(g => g.id === req.params.id);
    if (groupIndex === -1) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    const memberInfo = db.data.groupMembers.find(
      gm => gm.groupId === group.id && gm.userId === req.userId
    );
    
    if (memberInfo?.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    if (name) db.data.groups[groupIndex].name = name;
    if (description !== undefined) db.data.groups[groupIndex].description = description;
    if (isPrivate !== undefined) db.data.groups[groupIndex].isPrivate = isPrivate;
    
    await db.write();
    
    res.json(db.data.groups[groupIndex]);
  } catch (error) {
    console.error('Update group error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Upload group avatar
router.post('/:id/avatar', auth, upload.single('avatar'), async (req, res) => {
  try {
    await db.read();
    
    const groupIndex = db.data.groups.findIndex(g => g.id === req.params.id);
    if (groupIndex === -1) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    db.data.groups[groupIndex].avatar = `/uploads/${req.file.filename}`;
    await db.write();
    
    res.json({ avatar: db.data.groups[groupIndex].avatar });
  } catch (error) {
    console.error('Upload group avatar error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Join group
router.post('/:id/join', auth, async (req, res) => {
  try {
    await db.read();
    
    const group = db.data.groups.find(g => g.id === req.params.id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    if (group.members.includes(req.userId)) {
      return res.status(400).json({ error: 'Already a member' });
    }
    
    group.members.push(req.userId);
    db.data.groupMembers.push({
      groupId: group.id,
      userId: req.userId,
      role: 'member',
      joinedAt: new Date().toISOString()
    });
    
    await db.write();
    
    res.json({ message: 'Joined group successfully' });
  } catch (error) {
    console.error('Join group error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Leave group
router.post('/:id/leave', auth, async (req, res) => {
  try {
    await db.read();
    
    const groupIndex = db.data.groups.findIndex(g => g.id === req.params.id);
    if (groupIndex === -1) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    const group = db.data.groups[groupIndex];
    const memberIndex = group.members.indexOf(req.userId);
    
    if (memberIndex === -1) {
      return res.status(400).json({ error: 'Not a member' });
    }
    
    group.members.splice(memberIndex, 1);
    const gmIndex = db.data.groupMembers.findIndex(
      gm => gm.groupId === group.id && gm.userId === req.userId
    );
    if (gmIndex > -1) {
      db.data.groupMembers.splice(gmIndex, 1);
    }
    
    await db.write();
    
    res.json({ message: 'Left group successfully' });
  } catch (error) {
    console.error('Leave group error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get group members
router.get('/:id/members', auth, async (req, res) => {
  try {
    await db.read();
    
    const group = db.data.groups.find(g => g.id === req.params.id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    const members = group.members.map(memberId => {
      const user = db.data.users.find(u => u.id === memberId);
      const memberInfo = db.data.groupMembers.find(
        gm => gm.groupId === group.id && gm.userId === memberId
      );
      
      return user ? {
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        role: memberInfo?.role || 'member'
      } : null;
    }).filter(Boolean);
    
    res.json(members);
  } catch (error) {
    console.error('Get group members error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Post to group
router.post('/:id/posts', auth, async (req, res) => {
  try {
    const { content, image } = req.body;
    
    await db.read();
    
    const group = db.data.groups.find(g => g.id === req.params.id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    if (!group.members.includes(req.userId)) {
      return res.status(403).json({ error: 'Not a member' });
    }
    
    const user = db.data.users.find(u => u.id === req.userId);
    
    const post = {
      id: uuidv4(),
      groupId: group.id,
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
    
    group.posts.unshift(post);
    await db.write();
    
    res.json(post);
  } catch (error) {
    console.error('Post to group error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get group posts
router.get('/:id/posts', auth, async (req, res) => {
  try {
    await db.read();
    
    const group = db.data.groups.find(g => g.id === req.params.id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    const posts = group.posts.map(post => ({
      ...post,
      likesCount: post.likes.length,
      commentsCount: post.comments.length,
      isLiked: post.likes.includes(req.userId)
    }));
    
    res.json(posts);
  } catch (error) {
    console.error('Get group posts error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
