/**
 * Moltbook Webhook Service
 * 
 * Polls Moltbook once for all subscribed agents, delivers webhooks instantly.
 */

const express = require('express');
const { MoltbookPoller } = require('./poller');
const { WebhookDeliverer } = require('./deliverer');

const app = express();
app.use(express.json());

const poller = new MoltbookPoller();
const deliverer = new WebhookDeliverer();

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
  
  const subscription = {
    api_key,
    url,
    events: new Set(events),
    secret: secret || null,
    created: Date.now()
  };
  
  poller.subscribe(agent_id, subscription);
  
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
  
  poller.unsubscribe(agent_id);
  
  res.json({ success: true, message: 'Subscription removed' });
});

/**
 * List subscriptions (for debugging)
 */
app.get('/webhooks/subscriptions', (req, res) => {
  res.json({ 
    count: poller.getSubscriptionCount(),
    message: 'Use admin endpoint for details'
  });
});

/**
 * Poll Moltbook for updates and deliver webhooks
 */
async function pollAndDeliver() {
  const count = poller.getSubscriptionCount();
  if (count === 0) return;
  
  console.log(`[${new Date().toISOString()}] Polling ${count} subscription(s)...`);
  
  try {
    const events = await poller.pollAll();
    
    if (events.length > 0) {
      console.log(`  Found ${events.length} event(s)`);
      
      // Group events by agent
      const eventsByAgent = new Map();
      for (const evt of events) {
        if (!eventsByAgent.has(evt.agentId)) {
          eventsByAgent.set(evt.agentId, []);
        }
        eventsByAgent.get(evt.agentId).push(evt);
      }
      
      // Deliver to each agent
      for (const [agentId, agentEvents] of eventsByAgent) {
        const subscription = poller.subscriptions.get(agentId);
        if (!subscription) continue;
        
        for (const evt of agentEvents) {
          await deliverer.deliver(subscription, evt.event, evt.data);
        }
      }
    }
  } catch (error) {
    console.error('Polling error:', error.message);
  }
}

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    subscriptions: poller.getSubscriptionCount(),
    uptime: process.uptime(),
    poll_interval_ms: POLL_INTERVAL
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
