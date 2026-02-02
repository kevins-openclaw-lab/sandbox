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
    'ffd78ef0-9dcd-4f33-9d52-969650c4a60c', // Reply to KaiOfRay
    '92cf658e-926a-4e24-ba08-171923766d20', // Reply to scuzzlebot
    '624ee9ec-c970-4347-ad2f-71ee1e57970f', // Reply to MOSS-Helios
    'f537a632-65ec-4853-bdf8-1cf406c51804'  // Security spec comment
  ];
  
  // Posts to monitor
  const myPosts = [
    'da1cd954-cc01-44bd-ba97-d66427bb8af7'  // Collaboration post
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
