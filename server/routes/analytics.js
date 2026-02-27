const express = require('express');
const router = express.Router();
const db = require('../models/db');
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

// Get user statistics
router.get('/user/:userId', auth, async (req, res) => {
  try {
    await db.read();
    const { userId } = req.params;
    const user = db.data.users.find(u => u.id === userId);
    
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    // Count posts
    const posts = db.data.posts.filter(p => p.authorId === userId);
    
    // Count friends
    const friendships = db.data.friendships.filter(f => 
      (f.userId === userId || f.friendId === userId) && 
      f.status === 'accepted'
    );
    
    // Count groups
    const groupMemberships = db.data.groupMembers.filter(gm => gm.userId === userId);
    
    // Count likes received
    let likesReceived = 0;
    for (const post of posts) {
      const likes = db.data.reactions.filter(r => r.postId === post.id).length;
      likesReceived += likes;
    }
    
    // Count profile views
    const profileViews = db.data.profileViews.filter(v => v.profileOwnerId === userId).length;
    
    res.json({
      postsCount: posts.length,
      friendsCount: friendships.length,
      groupsCount: groupMemberships.length,
      likesReceived,
      profileViews,
      joinedAt: user.createdAt
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get trending posts (most liked/commented)
router.get('/trending', auth, async (req, res) => {
  try {
    await db.read();
    const { type = 'likes', limit = 10 } = req.query;
    
    let posts = [...db.data.posts];
    
    // Add engagement score
    posts = posts.map(post => {
      const reactions = db.data.reactions.filter(r => r.postId === post.id).length;
      const comments = db.data.comments.filter(c => c.postId === post.id).length;
      const score = type === 'comments' ? comments : reactions;
      return { ...post, reactions, comments, score };
    });
    
    // Sort by score
    posts.sort((a, b) => b.score - a.score);
    
    // Get top posts with author info
    const trending = posts.slice(0, parseInt(limit)).map(post => {
      const author = db.data.users.find(u => u.id === post.authorId);
      return {
        ...post,
        authorName: author ? `${author.firstName} ${author.lastName}`.trim() : 'Unknown',
        authorUsername: author?.username,
        authorAvatar: author?.avatar
      };
    });
    
    res.json(trending);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get suggested users (people you may know)
router.get('/suggestions', auth, async (req, res) => {
  try {
    await db.read();
    const { limit = 10 } = req.query;
    
    // Get current friends
    const friendships = db.data.friendships.filter(f => 
      (f.userId === req.user.id || f.friendId === req.user.id) && 
      f.status === 'accepted'
    );
    const friendIds = friendships.map(f => 
      f.userId === req.user.id ? f.friendId : f.userId
    );
    friendIds.push(req.user.id); // Exclude self
    
    // Get friends of friends
    const suggestions = [];
    for (const friendId of friendIds) {
      const friendFriendships = db.data.friendships.filter(f => 
        (f.userId === friendId || f.friendId === friendId) && 
        f.status === 'accepted'
      );
      
      for (const ff of friendFriendships) {
        const suggestedId = ff.userId === friendId ? ff.friendId : ff.userId;
        if (!friendIds.includes(suggestedId) && !suggestions.find(s => s.id === suggestedId)) {
          const suggestedUser = db.data.users.find(u => u.id === suggestedId);
          if (suggestedUser) {
            suggestions.push(suggestedUser);
          }
        }
      }
    }
    
    // Remove duplicates and limit
    const uniqueSuggestions = suggestions.slice(0, parseInt(limit)).map(u => ({
      id: u.id,
      username: u.username,
      firstName: u.firstName,
      lastName: u.lastName,
      avatar: u.avatar
    }));
    
    res.json(uniqueSuggestions);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Global search
router.get('/search', auth, async (req, res) => {
  try {
    await db.read();
    const { q, type = 'all' } = req.query;
    
    if (!q || q.length < 2) {
      return res.json({ users: [], posts: [], groups: [] });
    }
    
    const query = q.toLowerCase();
    const results = {
      users: [],
      posts: [],
      groups: []
    };
    
    // Search users
    if (type === 'all' || type === 'users') {
      results.users = db.data.users
        .filter(u => 
          u.username.toLowerCase().includes(query) ||
          (u.firstName && u.firstName.toLowerCase().includes(query)) ||
          (u.lastName && u.lastName.toLowerCase().includes(query))
        )
        .slice(0, 20)
        .map(u => ({
          id: u.id,
          username: u.username,
          firstName: u.firstName,
          lastName: u.lastName,
          avatar: u.avatar
        }));
    }
    
    // Search posts
    if (type === 'all' || type === 'posts') {
      results.posts = db.data.posts
        .filter(p => p.content.toLowerCase().includes(query))
        .slice(0, 20)
        .map(p => {
          const author = db.data.users.find(u => u.id === p.authorId);
          return {
            id: p.id,
            content: p.content.substring(0, 100),
            authorName: author ? `${author.firstName} ${author.lastName}`.trim() : 'Unknown',
            authorUsername: author?.username
          };
        });
    }
    
    // Search groups
    if (type === 'all' || type === 'groups') {
      results.groups = db.data.groups
        .filter(g => g.name.toLowerCase().includes(query))
        .slice(0, 20)
        .map(g => ({
          id: g.id,
          name: g.name,
          description: g.description
        }));
    }
    
    res.json(results);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
