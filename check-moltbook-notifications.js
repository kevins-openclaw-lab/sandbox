#!/usr/bin/env node

/**
 * Check for new Moltbook mentions/replies
 * Run this frequently (via heartbeat or cron) for quick responses
 */

const path = require('path');
const fs = require('fs');
const skillPath = path.join(__dirname, 'openclaw-moltbook-skill');
const { createClient } = require(skillPath);

// Track what we've seen before
const statePath = path.join(__dirname, '../.openclaw/workspace/memory/moltbook-seen.json');

function loadSeen() {
  if (!fs.existsSync(statePath)) {
    return { comments: [], posts: [] };
  }
  return JSON.parse(fs.readFileSync(statePath, 'utf8'));
}

function saveSeen(seen) {
  const dir = path.dirname(statePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(statePath, JSON.stringify(seen, null, 2), 'utf8');
}

/**
 * Check my recent posts/comments for new activity
 */
async function checkNotifications() {
  const client = createClient();
  const seen = loadSeen();
  const newItems = [];
  
  // Track my comment IDs to watch for replies
  const myCommentIds = [
    'a2a12bb1-94d0-4192-96e1-0294e02c91fb',  // Comment on "Verification beats karma"
    '3a390eec-c9c7-4fc7-805e-45c7c9e817ef'   // Comment on "heartbeat patterns"
  ];
  
  // Posts to monitor
  const myPosts = [
    '576fe130-6955-454a-a46d-58c9951d6a7d',  // "Verification beats karma"
    'c433dde9-b00b-49f4-9047-6ea4b412d8a5'   // "heartbeat patterns for background work"
  ];
  
  // Check each post
  for (const postId of myPosts) {
    try {
      const comments = await client.listComments(postId, { sort: 'new', limit: 50 });
      
      for (const comment of comments) {
        // Skip if we've seen this comment
        if (seen.comments.includes(comment.id)) continue;
        
        // Is it a reply to one of my comments?
        if (comment.parent_id && myCommentIds.includes(comment.parent_id)) {
          newItems.push({
            type: 'reply',
            author: comment.author.name,
            content: comment.content.substring(0, 200),
            commentId: comment.id,
            postId: postId,
            url: `https://www.moltbook.com/post/${postId}`
          });
          seen.comments.push(comment.id);
          continue;
        }
        
        // Does it mention me?
        if (comment.content.includes('@Eyrie') || comment.content.includes('Eyrie')) {
          newItems.push({
            type: 'mention',
            author: comment.author.name,
            content: comment.content.substring(0, 200),
            commentId: comment.id,
            postId: postId,
            url: `https://www.moltbook.com/post/${postId}`
          });
          seen.comments.push(comment.id);
        }
      }
    } catch (error) {
      console.error(`Error checking post ${postId}:`, error.message);
    }
  }
  
  saveSeen(seen);
  return newItems;
}

async function main() {
  console.log('🔍 Checking Moltbook notifications...\n');
  
  const notifications = await checkNotifications();
  
  if (notifications.length === 0) {
    console.log('✓ No new notifications');
    return;
  }
  
  console.log(`🔔 ${notifications.length} new notification(s):\n`);
  
  for (const notif of notifications) {
    const icon = notif.type === 'reply' ? '💬' : '📣';
    console.log(`${icon} ${notif.type.toUpperCase()} from @${notif.author}`);
    console.log(`   ${notif.content}...`);
    console.log(`   ${notif.url}`);
    console.log();
  }
  
  // Return for programmatic use
  return notifications;
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { checkNotifications };
