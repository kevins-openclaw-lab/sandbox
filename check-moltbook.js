#!/usr/bin/env node

/**
 * Moltbook API-based checker (no browser needed)
 * - Notifications: replies to my comments, @mentions
 * - Feed: hot/new posts for engagement opportunities
 */

const path = require('path');
const fs = require('fs');
const skillPath = path.join(__dirname, 'openclaw-moltbook-skill');
const { createClient, getRelevantPosts, shouldCheckMoltbook, updateMoltbookCheckTime } = require(skillPath);

const STATE_DIR = path.join(__dirname, '../.openclaw/workspace/memory');
const SEEN_PATH = path.join(STATE_DIR, 'moltbook-seen.json');
const HEARTBEAT_PATH = path.join(STATE_DIR, 'heartbeat-state.json');

function loadSeen() {
  if (!fs.existsSync(SEEN_PATH)) {
    return { comments: [], posts: [], lastFeedCheck: 0 };
  }
  return JSON.parse(fs.readFileSync(SEEN_PATH, 'utf8'));
}

function saveSeen(seen) {
  if (!fs.existsSync(STATE_DIR)) {
    fs.mkdirSync(STATE_DIR, { recursive: true });
  }
  fs.writeFileSync(SEEN_PATH, JSON.stringify(seen, null, 2), 'utf8');
}

/**
 * Check for notifications (replies, mentions)
 */
async function checkNotifications(client, seen) {
  const notifications = [];
  
  // Posts/comments we're monitoring (add IDs as we engage)
  const myPosts = seen.myPosts || [];
  const myCommentIds = seen.myCommentIds || [];
  
  for (const postId of myPosts) {
    try {
      const comments = await client.listComments(postId, { sort: 'new', limit: 50 });
      
      for (const comment of comments) {
        if (seen.comments.includes(comment.id)) continue;
        
        // Reply to my comment?
        if (comment.parent_id && myCommentIds.includes(comment.parent_id)) {
          notifications.push({
            type: 'reply',
            author: comment.author?.name || 'unknown',
            content: comment.content?.substring(0, 200) || '',
            commentId: comment.id,
            postId: postId,
            url: `https://www.moltbook.com/post/${postId}`
          });
          seen.comments.push(comment.id);
          continue;
        }
        
        // Mentions me?
        const content = (comment.content || '').toLowerCase();
        if (content.includes('@eyrie') || content.includes('eyrie')) {
          notifications.push({
            type: 'mention',
            author: comment.author?.name || 'unknown',
            content: comment.content?.substring(0, 200) || '',
            commentId: comment.id,
            postId: postId,
            url: `https://www.moltbook.com/post/${postId}`
          });
          seen.comments.push(comment.id);
        }
      }
    } catch (error) {
      // Post might be deleted
      if (!error.message?.includes('404')) {
        console.error(`Error checking post ${postId}:`, error.message);
      }
    }
  }
  
  return notifications;
}

/**
 * Check feed for interesting posts
 */
async function checkFeed(client, seen) {
  const feed = [];
  
  try {
    // Get hot posts with good engagement opportunity
    const posts = await getRelevantPosts(client, {
      sort: 'hot',
      limit: 15,
      minScore: 2,
      maxComments: 30,
      keywords: ['agent', 'ai', 'collaboration', 'security', 'intel', 'tool', 'skill', 'api']
    });
    
    for (const post of posts) {
      if (seen.posts.includes(post.id)) continue;
      
      feed.push({
        id: post.id,
        title: post.title?.substring(0, 100) || 'Untitled',
        author: post.author?.name || 'unknown',
        score: post.score,
        comments: post.commentCount || 0,
        url: `https://www.moltbook.com/post/${post.id}`,
        preview: post.content?.substring(0, 150) || ''
      });
      
      // Mark as seen after reporting
      seen.posts.push(post.id);
    }
  } catch (error) {
    console.error('Error fetching feed:', error.message);
  }
  
  // Keep seen lists from growing too large
  if (seen.posts.length > 500) seen.posts = seen.posts.slice(-300);
  if (seen.comments.length > 1000) seen.comments = seen.comments.slice(-500);
  
  return feed;
}

async function main() {
  const args = process.argv.slice(2);
  const forceCheck = args.includes('--force');
  const feedOnly = args.includes('--feed');
  const notifyOnly = args.includes('--notify');
  
  console.log('🦞 Moltbook API Checker\n');
  
  let client;
  try {
    client = createClient();
  } catch (error) {
    console.error('❌ Not authenticated:', error.message);
    process.exit(1);
  }
  
  const seen = loadSeen();
  const results = { notifications: [], feed: [] };
  
  // Always check notifications (fast, important)
  if (!feedOnly) {
    console.log('🔍 Checking notifications...');
    results.notifications = await checkNotifications(client, seen);
    
    if (results.notifications.length > 0) {
      console.log(`\n🔔 ${results.notifications.length} new notification(s):`);
      for (const n of results.notifications) {
        const icon = n.type === 'reply' ? '💬' : '📣';
        console.log(`  ${icon} ${n.type} from @${n.author}: ${n.content.substring(0, 80)}...`);
      }
    } else {
      console.log('✓ No new notifications');
    }
  }
  
  // Check feed every 2+ hours or if forced
  if (!notifyOnly) {
    const shouldCheck = forceCheck || shouldCheckMoltbook(2, HEARTBEAT_PATH);
    
    if (shouldCheck) {
      console.log('\n📰 Checking feed for engagement opportunities...');
      results.feed = await checkFeed(client, seen);
      updateMoltbookCheckTime(HEARTBEAT_PATH);
      
      if (results.feed.length > 0) {
        console.log(`\n🌟 ${results.feed.length} interesting post(s):`);
        for (const p of results.feed.slice(0, 5)) {
          console.log(`  • [${p.score}↑] ${p.title} by @${p.author} (${p.comments} comments)`);
        }
        if (results.feed.length > 5) {
          console.log(`  ... and ${results.feed.length - 5} more`);
        }
      } else {
        console.log('✓ No new interesting posts');
      }
    } else {
      console.log('\n⏳ Feed check skipped (checked recently)');
    }
  }
  
  saveSeen(seen);
  
  // Return for programmatic use
  return results;
}

if (require.main === module) {
  main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
}

module.exports = { checkNotifications, checkFeed };
