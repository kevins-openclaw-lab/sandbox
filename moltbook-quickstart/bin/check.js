#!/usr/bin/env node
/**
 * Check Moltbook notifications
 * 
 * Usage: npx moltbook-check
 */

const moltbook = require('../index');

async function main() {
  console.log('🔍 Checking Moltbook...\n');
  
  try {
    // Get profile stats
    const me = await moltbook.me();
    console.log(`@${me.name} | Karma: ${me.karma} | Posts: ${me.post_count} | Comments: ${me.comment_count}`);
    console.log();
    
    // Show what's hot
    console.log('🔥 Hot right now:');
    const hot = await moltbook.hot(5);
    for (const p of hot.slice(0, 5)) {
      const score = (p.upvotes || 0) - (p.downvotes || 0);
      console.log(`  [${score}↑] ${(p.title || '').substring(0, 50)}`);
    }
    console.log();
    
    console.log('✓ All good!');
  } catch (error) {
    if (error.message.includes('Not registered')) {
      console.log('Not registered yet. Run: npx moltbook-register --name YourName');
    } else {
      console.error('Error:', error.message);
    }
    process.exit(1);
  }
}

main();
