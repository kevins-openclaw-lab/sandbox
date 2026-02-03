/**
 * Moltbook Poller
 * 
 * Checks Moltbook for new activity and generates events
 */

const fetch = require('node-fetch');

const MOLTBOOK_API = 'https://www.moltbook.com/api/v1';

class MoltbookPoller {
  constructor() {
    this.subscriptions = new Map();
    this.lastSeen = new Map();
  }
  
  /**
   * Add a subscription
   */
  subscribe(agentId, config) {
    this.subscriptions.set(agentId, config);
    
    // Initialize lastSeen if not exists
    if (!this.lastSeen.has(agentId)) {
      this.lastSeen.set(agentId, {
        posts: new Set(),
        comments: new Set(),
        lastCheck: Date.now()
      });
    }
  }
  
  /**
   * Remove a subscription
   */
  unsubscribe(agentId) {
    this.subscriptions.delete(agentId);
    this.lastSeen.delete(agentId);
  }
  
  /**
   * Poll all subscriptions and return events
   */
  async pollAll() {
    const allEvents = [];
    
    for (const [agentId, config] of this.subscriptions) {
      try {
        const events = await this.pollAgent(agentId, config);
        allEvents.push(...events);
      } catch (error) {
        console.error(`Error polling ${agentId}:`, error.message);
      }
    }
    
    return allEvents;
  }
  
  /**
   * Poll a specific agent for new activity
   */
  async pollAgent(agentId, config) {
    const events = [];
    const seen = this.lastSeen.get(agentId);
    
    // Get agent's recent posts (to check for new comments)
    const me = await this.fetchAPI('/agents/me', config.api_key);
    if (!me?.agent) return events;
    
    // Check feed for mentions and replies
    const feed = await this.fetchAPI('/feed?sort=new&limit=50', config.api_key);
    if (!feed?.data) return events;
    
    for (const post of feed.data) {
      // Check if this is a new post we haven't seen
      if (!seen.posts.has(post.id)) {
        seen.posts.add(post.id);
        
        // Check if we're mentioned in title or content
        if (this.isMentioned(post, me.agent.name) && config.events.has('agent.mentioned')) {
          events.push({
            agentId,
            event: 'agent.mentioned',
            data: { post }
          });
        }
      }
      
      // Check comments on this post
      if (post.comment_count > 0) {
        const comments = await this.fetchAPI(`/posts/${post.id}/comments?sort=new&limit=20`, config.api_key);
        
        if (comments?.comments) {
          for (const comment of comments.comments) {
            // Skip if we've seen this comment
            if (seen.comments.has(comment.id)) continue;
            
            seen.comments.add(comment.id);
            
            // Check for mentions
            if (this.isMentioned(comment, me.agent.name) && config.events.has('agent.mentioned')) {
              events.push({
                agentId,
                event: 'agent.mentioned',
                data: { comment, post }
              });
            }
            
            // Check if it's a reply to our comment
            if (comment.parent_id && config.events.has('comment.replied')) {
              // We'd need to track which comments are ours
              // For now, simplified version
              events.push({
                agentId,
                event: 'comment.created',
                data: { comment, post }
              });
            }
          }
        }
      }
    }
    
    // Cleanup old seen items (keep last 1000)
    if (seen.posts.size > 1000) {
      const toKeep = Array.from(seen.posts).slice(-1000);
      seen.posts = new Set(toKeep);
    }
    if (seen.comments.size > 1000) {
      const toKeep = Array.from(seen.comments).slice(-1000);
      seen.comments = new Set(toKeep);
    }
    
    seen.lastCheck = Date.now();
    
    return events;
  }
  
  /**
   * Check if content mentions an agent
   */
  isMentioned(item, agentName) {
    const content = (item.title || '') + ' ' + (item.content || '');
    return content.includes(`@${agentName}`) || content.includes(agentName);
  }
  
  /**
   * Fetch from Moltbook API
   */
  async fetchAPI(path, apiKey) {
    const url = `${MOLTBOOK_API}${path}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return response.json();
  }
  
  /**
   * Get subscription count
   */
  getSubscriptionCount() {
    return this.subscriptions.size;
  }
}

module.exports = { MoltbookPoller };
