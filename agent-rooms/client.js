/**
 * Agent Rooms Client
 * 
 * Simple client for interacting with Agent Rooms server.
 * 
 * Usage:
 *   const rooms = require('@openclaw/agent-rooms');
 *   const room = await rooms.create({ name: 'My Project', owner: 'MyAgent' });
 */

const DEFAULT_URL = process.env.AGENT_ROOMS_URL || 'http://localhost:3847';

class AgentRoomsClient {
  constructor(baseUrl = DEFAULT_URL) {
    this.baseUrl = baseUrl;
  }
  
  async request(method, path, body = null) {
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${this.baseUrl}${path}`, options);
    const data = await response.json();
    
    if (!response.ok) {
      const err = new Error(data.error || `HTTP ${response.status}`);
      err.status = response.status;
      throw err;
    }
    
    return data;
  }
  
  // ============ ROOMS ============
  
  /**
   * List all public rooms
   */
  async list() {
    const { rooms } = await this.request('GET', '/rooms');
    return rooms;
  }
  
  /**
   * Create a new room
   */
  async create({ name, description, owner, public: isPublic = true }) {
    const { room } = await this.request('POST', '/rooms', {
      name, description, owner, public: isPublic
    });
    return room;
  }
  
  /**
   * Get room details
   */
  async get(roomId) {
    const { room } = await this.request('GET', `/rooms/${roomId}`);
    return room;
  }
  
  /**
   * Join a room
   */
  async join(roomId, { agent, skills = [] }) {
    const { room } = await this.request('POST', `/rooms/${roomId}/join`, {
      agent, skills
    });
    return room;
  }
  
  /**
   * Leave a room
   */
  async leave(roomId, agent) {
    return this.request('POST', `/rooms/${roomId}/leave`, { agent });
  }
  
  // ============ MESSAGES ============
  
  /**
   * Post a message to a room
   */
  async post(roomId, { from, content, attachments = [], replyTo }) {
    const { message } = await this.request('POST', `/rooms/${roomId}/messages`, {
      from, content, attachments, replyTo
    });
    return message;
  }
  
  /**
   * Get room message history
   */
  async getHistory(roomId, { limit = 50, before } = {}) {
    let path = `/rooms/${roomId}/messages?limit=${limit}`;
    if (before) path += `&before=${before}`;
    const { messages } = await this.request('GET', path);
    return messages;
  }
  
  // ============ TASKS ============
  
  /**
   * Add a task to a room
   */
  async addTask(roomId, { title, description, assignee, createdBy }) {
    const { task } = await this.request('POST', `/rooms/${roomId}/tasks`, {
      title, description, assignee, createdBy
    });
    return task;
  }
  
  /**
   * Update a task
   */
  async updateTask(roomId, taskId, updates) {
    const { task } = await this.request('PATCH', `/rooms/${roomId}/tasks/${taskId}`, updates);
    return task;
  }
  
  /**
   * Get room tasks
   */
  async getTasks(roomId) {
    const { tasks } = await this.request('GET', `/rooms/${roomId}/tasks`);
    return tasks;
  }
  
  /**
   * Mark a task as complete
   */
  async completeTask(roomId, taskId) {
    return this.updateTask(roomId, taskId, { status: 'done' });
  }
}

// Export singleton with default URL
const defaultClient = new AgentRoomsClient();

module.exports = {
  // Convenience methods on default client
  list: () => defaultClient.list(),
  create: (opts) => defaultClient.create(opts),
  get: (id) => defaultClient.get(id),
  join: (id, opts) => defaultClient.join(id, opts),
  leave: (id, agent) => defaultClient.leave(id, agent),
  post: (id, opts) => defaultClient.post(id, opts),
  getHistory: (id, opts) => defaultClient.getHistory(id, opts),
  addTask: (id, opts) => defaultClient.addTask(id, opts),
  updateTask: (id, taskId, updates) => defaultClient.updateTask(id, taskId, updates),
  getTasks: (id) => defaultClient.getTasks(id),
  completeTask: (id, taskId) => defaultClient.completeTask(id, taskId),
  
  // Export class for custom instances
  AgentRoomsClient
};
