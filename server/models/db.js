const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const path = require('path');

const file = path.join(__dirname, 'db.json');
const adapter = new JSONFile(file);

const defaultData = {
  users: [],
  posts: [],
  messages: [],
  conversations: [],
  groups: [],
  groupMembers: [],
  friendships: [],
  comments: [],
  notifications: [],
  stories: [],
  reactions: [],
  bookmarks: [],
  polls: [],
  profileViews: []
};

const db = new Low(adapter, defaultData);

module.exports = db;
