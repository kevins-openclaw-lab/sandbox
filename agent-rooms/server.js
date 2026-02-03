/**
 * Agent Rooms Server
 * 
 * Simple API for multi-agent collaboration spaces.
 * 
 * Run: node server.js
 * Default port: 3847
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

// Simple file-based storage (replace with DB in production)
const DATA_DIR = process.env.DATA_DIR || './data';
const ROOMS_FILE = path.join(DATA_DIR, 'rooms.json');
const MESSAGES_DIR = path.join(DATA_DIR, 'messages');

// Ensure data directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(MESSAGES_DIR)) fs.mkdirSync(MESSAGES_DIR, { recursive: true });

// Load/save helpers
function loadRooms() {
  if (!fs.existsSync(ROOMS_FILE)) return {};
  return JSON.parse(fs.readFileSync(ROOMS_FILE, 'utf8'));
}

function saveRooms(rooms) {
  fs.writeFileSync(ROOMS_FILE, JSON.stringify(rooms, null, 2));
}

function loadMessages(roomId) {
  const file = path.join(MESSAGES_DIR, `${roomId}.json`);
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveMessages(roomId, messages) {
  const file = path.join(MESSAGES_DIR, `${roomId}.json`);
  fs.writeFileSync(file, JSON.stringify(messages, null, 2));
}

// ============ API ROUTES ============

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'agent-rooms', version: '1.0.0' });
});

// List all public rooms
app.get('/rooms', (req, res) => {
  const rooms = loadRooms();
  const publicRooms = Object.values(rooms)
    .filter(r => r.public)
    .map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      owner: r.owner,
      memberCount: r.members.length,
      taskCount: r.tasks.length,
      createdAt: r.createdAt
    }));
  res.json({ rooms: publicRooms });
});

// Create a room
app.post('/rooms', (req, res) => {
  const { name, description, owner, public: isPublic = true } = req.body;
  
  if (!name || !owner) {
    return res.status(400).json({ error: 'name and owner required' });
  }
  
  const rooms = loadRooms();
  const room = {
    id: uuidv4(),
    name,
    description: description || '',
    owner,
    public: isPublic,
    members: [{ agent: owner, joinedAt: new Date().toISOString(), role: 'owner' }],
    tasks: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  rooms[room.id] = room;
  saveRooms(rooms);
  
  res.status(201).json({ room });
});

// Get room details
app.get('/rooms/:id', (req, res) => {
  const rooms = loadRooms();
  const room = rooms[req.params.id];
  
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  res.json({ room });
});

// Join a room
app.post('/rooms/:id/join', (req, res) => {
  const { agent, skills = [] } = req.body;
  
  if (!agent) {
    return res.status(400).json({ error: 'agent required' });
  }
  
  const rooms = loadRooms();
  const room = rooms[req.params.id];
  
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  // Check if already a member
  if (room.members.some(m => m.agent === agent)) {
    return res.json({ room, message: 'Already a member' });
  }
  
  room.members.push({
    agent,
    skills,
    joinedAt: new Date().toISOString(),
    role: 'member'
  });
  room.updatedAt = new Date().toISOString();
  
  saveRooms(rooms);
  
  // Add system message
  const messages = loadMessages(room.id);
  messages.push({
    id: uuidv4(),
    type: 'system',
    content: `${agent} joined the room`,
    timestamp: new Date().toISOString()
  });
  saveMessages(room.id, messages);
  
  res.json({ room });
});

// Leave a room
app.post('/rooms/:id/leave', (req, res) => {
  const { agent } = req.body;
  
  const rooms = loadRooms();
  const room = rooms[req.params.id];
  
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  room.members = room.members.filter(m => m.agent !== agent);
  room.updatedAt = new Date().toISOString();
  saveRooms(rooms);
  
  res.json({ success: true });
});

// Post a message to a room
app.post('/rooms/:id/messages', (req, res) => {
  const { from, content, attachments = [], replyTo } = req.body;
  
  if (!from || !content) {
    return res.status(400).json({ error: 'from and content required' });
  }
  
  const rooms = loadRooms();
  const room = rooms[req.params.id];
  
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  // Check if agent is a member
  if (!room.members.some(m => m.agent === from)) {
    return res.status(403).json({ error: 'Not a member of this room' });
  }
  
  const messages = loadMessages(room.id);
  const message = {
    id: uuidv4(),
    type: 'message',
    from,
    content,
    attachments,
    replyTo: replyTo || null,
    timestamp: new Date().toISOString()
  };
  
  messages.push(message);
  saveMessages(room.id, messages);
  
  // Update room timestamp
  room.updatedAt = new Date().toISOString();
  saveRooms(rooms);
  
  res.status(201).json({ message });
});

// Get room messages (history)
app.get('/rooms/:id/messages', (req, res) => {
  const { limit = 50, before } = req.query;
  
  const rooms = loadRooms();
  if (!rooms[req.params.id]) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  let messages = loadMessages(req.params.id);
  
  if (before) {
    const idx = messages.findIndex(m => m.id === before);
    if (idx > 0) messages = messages.slice(0, idx);
  }
  
  // Return most recent
  messages = messages.slice(-parseInt(limit));
  
  res.json({ messages });
});

// Add a task to a room
app.post('/rooms/:id/tasks', (req, res) => {
  const { title, description, assignee, createdBy } = req.body;
  
  if (!title || !createdBy) {
    return res.status(400).json({ error: 'title and createdBy required' });
  }
  
  const rooms = loadRooms();
  const room = rooms[req.params.id];
  
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  const task = {
    id: uuidv4(),
    title,
    description: description || '',
    assignee: assignee || null,
    status: 'todo',
    createdBy,
    createdAt: new Date().toISOString()
  };
  
  room.tasks.push(task);
  room.updatedAt = new Date().toISOString();
  saveRooms(rooms);
  
  res.status(201).json({ task });
});

// Update a task
app.patch('/rooms/:id/tasks/:taskId', (req, res) => {
  const { status, assignee, title, description } = req.body;
  
  const rooms = loadRooms();
  const room = rooms[req.params.id];
  
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  const task = room.tasks.find(t => t.id === req.params.taskId);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  
  if (status) task.status = status;
  if (assignee !== undefined) task.assignee = assignee;
  if (title) task.title = title;
  if (description !== undefined) task.description = description;
  task.updatedAt = new Date().toISOString();
  
  room.updatedAt = new Date().toISOString();
  saveRooms(rooms);
  
  res.json({ task });
});

// Get room tasks
app.get('/rooms/:id/tasks', (req, res) => {
  const rooms = loadRooms();
  const room = rooms[req.params.id];
  
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  res.json({ tasks: room.tasks });
});

// ============ START SERVER ============

const PORT = process.env.PORT || 3847;

app.listen(PORT, () => {
  console.log(`🏠 Agent Rooms server running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Rooms:  http://localhost:${PORT}/rooms`);
});

module.exports = app;
