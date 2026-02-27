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

// Get friends list
router.get('/', auth, async (req, res) => {
  try {
    await db.read();
    
    const friendships = db.data.friendships.filter(f => 
      (f.userId === req.userId || f.friendId === req.userId) && f.status === 'accepted'
    );
    
    const friends = friendships.map(f => {
      const friendId = f.userId === req.userId ? f.friendId : f.userId;
      const friend = db.data.users.find(u => u.id === friendId);
      
      if (!friend) return null;
      
      return {
        id: friend.id,
        username: friend.username,
        firstName: friend.firstName,
        lastName: friend.lastName,
        avatar: friend.avatar,
        bio: friend.bio,
        friendshipId: f.id
      };
    }).filter(Boolean);
    
    res.json(friends);
  } catch (error) {
    console.error('Get friends error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get friend requests (incoming)
router.get('/requests', auth, async (req, res) => {
  try {
    await db.read();
    
    const requests = db.data.friendships
      .filter(f => f.friendId === req.userId && f.status === 'pending')
      .map(f => {
        const user = db.data.users.find(u => u.id === f.userId);
        
        if (!user) return null;
        
        return {
          id: f.id,
          userId: user.id,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          avatar: user.avatar,
          createdAt: f.createdAt
        };
      }).filter(Boolean);
    
    res.json(requests);
  } catch (error) {
    console.error('Get requests error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get outgoing requests
router.get('/outgoing', auth, async (req, res) => {
  try {
    await db.read();
    
    const requests = db.data.friendships
      .filter(f => f.userId === req.userId && f.status === 'pending')
      .map(f => {
        const friend = db.data.users.find(u => u.id === f.friendId);
        
        if (!friend) return null;
        
        return {
          id: f.id,
          userId: friend.id,
          username: friend.username,
          firstName: friend.firstName,
          lastName: friend.lastName,
          avatar: friend.avatar,
          createdAt: f.createdAt
        };
      }).filter(Boolean);
    
    res.json(requests);
  } catch (error) {
    console.error('Get outgoing error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Send friend request
router.post('/request/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (userId === req.userId) {
      return res.status(400).json({ error: 'Cannot add yourself' });
    }
    
    await db.read();
    
    // Check if user exists
    const user = db.data.users.find(u => u.id === userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if already friends or request exists
    const existing = db.data.friendships.find(f =>
      (f.userId === req.userId && f.friendId === userId) ||
      (f.userId === userId && f.friendId === req.userId)
    );
    
    if (existing) {
      return res.status(400).json({ error: 'Request already exists' });
    }
    
    const friendship = {
      id: uuidv4(),
      userId: req.userId,
      friendId: userId,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    
    db.data.friendships.push(friendship);
    
    // Create notification for the other user
    const requester = db.data.users.find(u => u.id === req.userId);
    db.data.notifications.push({
      id: uuidv4(),
      userId: userId,
      type: 'friend_request',
      fromUserId: req.userId,
      fromUsername: requester?.username || 'Unknown',
      fromName: `${requester?.firstName || ''} ${requester?.lastName || ''}`.trim() || requester?.username || 'Unknown',
      fromAvatar: requester?.avatar || '',
      message: 'отправил запрос в друзья',
      read: false,
      createdAt: new Date().toISOString()
    });
    
    await db.write();
    
    res.json({ message: 'Friend request sent' });
  } catch (error) {
    console.error('Send request error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Accept friend request
router.post('/accept/:friendshipId', auth, async (req, res) => {
  try {
    const { friendshipId } = req.params;
    
    await db.read();
    
    const friendship = db.data.friendships.find(f => 
      f.id === friendshipId && f.friendId === req.userId && f.status === 'pending'
    );
    
    if (!friendship) {
      return res.status(404).json({ error: 'Request not found' });
    }
    
    friendship.status = 'accepted';
    
    // Create notification
    const requester = db.data.users.find(u => u.id === friendship.userId);
    db.data.notifications.push({
      id: uuidv4(),
      userId: friendship.userId,
      type: 'friend_accepted',
      fromUserId: req.userId,
      fromUsername: currentUser?.username || 'Unknown',
      fromName: `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim() || currentUser?.username || 'Unknown',
      fromAvatar: currentUser?.avatar || '',
      message: 'принял запрос в друзья',
      read: false,
      createdAt: new Date().toISOString()
    });
    
    await db.write();
    
    res.json({ message: 'Friend request accepted' });
  } catch (error) {
    console.error('Accept request error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Reject friend request
router.post('/reject/:friendshipId', auth, async (req, res) => {
  try {
    const { friendshipId } = req.params;
    
    await db.read();
    
    const friendshipIndex = db.data.friendships.findIndex(f => 
      f.id === friendshipId && f.friendId === req.userId && f.status === 'pending'
    );
    
    if (friendshipIndex === -1) {
      return res.status(404).json({ error: 'Request not found' });
    }
    
    db.data.friendships.splice(friendshipIndex, 1);
    await db.write();
    
    res.json({ message: 'Friend request rejected' });
  } catch (error) {
    console.error('Reject request error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Remove friend
router.delete('/:friendId', auth, async (req, res) => {
  try {
    const { friendId } = req.params;
    
    await db.read();
    
    const friendshipIndex = db.data.friendships.findIndex(f =>
      (f.userId === req.userId && f.friendId === friendId) ||
      (f.userId === friendId && f.friendId === req.userId)
    );
    
    if (friendshipIndex === -1) {
      return res.status(404).json({ error: 'Friendship not found' });
    }
    
    db.data.friendships.splice(friendshipIndex, 1);
    await db.write();
    
    res.json({ message: 'Friend removed' });
  } catch (error) {
    console.error('Remove friend error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Check friendship status
router.get('/status/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    await db.read();
    
    const friendship = db.data.friendships.find(f =>
      (f.userId === req.userId && f.friendId === userId) ||
      (f.userId === userId && f.friendId === req.userId)
    );
    
    if (!friendship) {
      return res.json({ status: 'none' });
    }
    
    res.json({ 
      status: friendship.status,
      friendshipId: friendship.id,
      isPending: friendship.userId === req.userId && friendship.status === 'pending'
    });
  } catch (error) {
    console.error('Get status error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get suggested friends
router.get('/suggestions', auth, async (req, res) => {
  try {
    await db.read();
    
    // Get current friends
    const friendIds = db.data.friendships
      .filter(f => (f.userId === req.userId || f.friendId === req.userId) && f.status === 'accepted')
      .map(f => f.userId === req.userId ? f.friendId : f.userId);
    
    // Add current user to exclude list
    friendIds.push(req.userId);
    
    // Get pending requests
    const pendingIds = db.data.friendships
      .filter(f => (f.userId === req.userId || f.friendId === req.userId) && f.status === 'pending')
      .map(f => f.userId === req.userId ? f.friendId : f.userId);
    
    // Get suggestions (not friends, not pending)
    const suggestions = db.data.users
      .filter(u => !friendIds.includes(u.id) && !pendingIds.includes(u.id))
      .slice(0, 10)
      .map(u => ({
        id: u.id,
        username: u.username,
        firstName: u.firstName,
        lastName: u.lastName,
        avatar: u.avatar,
        bio: u.bio
      }));
    
    res.json(suggestions);
  } catch (error) {
    console.error('Get suggestions error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
