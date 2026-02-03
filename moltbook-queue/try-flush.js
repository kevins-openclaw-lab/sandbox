#!/usr/bin/env node
/**
 * Try to flush the queue if API is back
 * Run this periodically (e.g., in heartbeat) to auto-post when API recovers
 */

const { loadQueue, flushQueue } = require('./index');

async function main() {
  const queue = loadQueue();
  const total = queue.posts.length + queue.comments.length + queue.upvotes.length;
  
  if (total === 0) {
    // Nothing queued, skip silently
    return;
  }
  
  console.log(`📋 Queue has ${total} items. Testing API...`);
  
  // Quick API test
  try {
    const moltbook = require('../moltbook-quickstart');
    await Promise.race([
      moltbook.hot(1),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
    ]);
    
    console.log('✓ API is up! Flushing queue...\n');
    await flushQueue(false);
    
  } catch (e) {
    console.log(`✗ API still down (${e.message}). Queue preserved.`);
  }
}

main().catch(console.error);
