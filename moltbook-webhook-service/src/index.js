/**
 * Moltbook Webhook Service
 * 
 * Polls Moltbook once for all subscribed agents, delivers webhooks instantly.
 */

const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// In-memory storage for now (use Redis in production)
const subscriptions = new Map();
const lastSeen = new Map();

const MOLTBOOK_API = 'https://www.moltbook.com/api/v1';
const POLL_INTERVAL = 30000; // 30 seconds

/**
 * Subscribe to webhooks
 */
app.post('/webhooks/subscribe', (req, res) => {
  const { agent_id, api_key, url, events, secret } = req.body;
  
  if (!agent_id || !api_key || !url || !events) {
    return res.status(400).json({
      error: 'Missing required fields: agent_id, api_key, url, events'
    });
  }
  
  subscriptions.set(agent_id, {
    api_key,
    url,
    events: new Set(events),
    secret: secret || null,
    created: Date.now()
  });
  
  console.log(`✓ Subscribed ${agent_id} to ${events.join(', ')}`);
  
  res.json({
    success: true,
    message: 'Webhook subscription created',
    agent_id,
    events
  });
});

/**
 * Unsubscribe
 */
app.delete('/webhooks/subscribe/:agent_id', (req, res) => {
  const { agent_id } = req.params;
  
  if (subscriptions.has(agent_id)) {
    subscriptions.delete(agent_id);
    lastSeen.delete(agent_id);
    
    res.json({ success: true, message: 'Subscription removed' });
  } else {
    res.status(404).json({ error: 'Subscription not found' });
  }
});

/**
 * List subscriptions (for debugging)
 */
app.get('/webhooks/subscriptions', (req, res) => {
  const subs = Array.from(subscriptions.entries()).map(([agent_id, sub]) => ({
    agent_id,
    url: sub.url,
    events: Array.from(sub.events),
    created: sub.created
  }));
  
  res.json({ subscriptions: subs });
});

/**
 * Poll Moltbook for updates and deliver webhooks
 */
async function pollAndDeliver() {
  console.log(`Polling Moltbook for ${subscriptions.size} subscriptions...`);
  
  for (const [agent_id, sub] of subscriptions) {
    try {
      await checkAgent(agent_id, sub);
    } catch (error) {
      console.error(`Error checking ${agent_id}:`, error.message);
    }
  }
}

/**
 * Check a specific agent's notifications
 */
async function checkAgent(agent_id, sub) {
  // Get agent's posts to check for new comments
  const response = await fetch(`${MOLTBOOK_API}/agents/me`, {
    headers: { 'Authorization': `Bearer ${sub.api_key}` }
  });
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  // In a real implementation, we'd:
  // 1. Fetch agent's posts
  // 2. Check for new comments since lastSeen
  // 3. Check for mentions
  // 4. Deliver relevant webhooks
  
  // For now, just a placeholder
  console.log(`Checked ${agent_id} - ${data.agent?.name}`);
}

/**
 * Deliver a webhook to an agent
 */
async function deliverWebhook(sub, event, data) {
  const payload = {
    event,
    timestamp: new Date().toISOString(),
    data
  };
  
  // Sign payload if secret provided
  let signature = null;
  if (sub.secret) {
    signature = crypto
      .createHmac('sha256', sub.secret)
      .update(JSON.stringify(payload))
      .digest('hex');
  }
  
  try {
    const response = await fetch(sub.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(signature && { 'X-Moltbook-Signature': signature })
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      console.error(`Webhook delivery failed: ${response.status}`);
      // TODO: Implement retry with exponential backoff
    }
  } catch (error) {
    console.error('Webhook delivery error:', error.message);
    // TODO: Implement retry
  }
}

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    subscriptions: subscriptions.size,
    uptime: process.uptime()
  });
});

/**
 * Start server and polling
 */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Moltbook Webhook Service running on port ${PORT}`);
  console.log(`📡 Polling every ${POLL_INTERVAL / 1000}s`);
  
  // Start polling
  setInterval(pollAndDeliver, POLL_INTERVAL);
  
  // Poll immediately on startup
  pollAndDeliver();
});
