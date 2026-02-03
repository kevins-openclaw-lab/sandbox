#!/usr/bin/env node
/**
 * Moltbook Content Queue
 * 
 * Queue posts/comments locally when API is down, flush when it's back.
 * 
 * Usage:
 *   node index.js add-post "Title" "Content" --submolt dev
 *   node index.js add-comment <postId> "Comment content"
 *   node index.js list
 *   node index.js flush [--dry-run]
 *   node index.js clear
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const QUEUE_FILE = path.join(os.homedir(), '.config', 'moltbook', 'content-queue.json');

function loadQueue() {
  if (!fs.existsSync(QUEUE_FILE)) {
    return { posts: [], comments: [], upvotes: [] };
  }
  return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
}

function saveQueue(queue) {
  const dir = path.dirname(QUEUE_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
}

function addPost(title, content, submolt = 'general') {
  const queue = loadQueue();
  queue.posts.push({
    id: Date.now().toString(),
    title,
    content,
    submolt,
    queuedAt: new Date().toISOString()
  });
  saveQueue(queue);
  console.log(`✓ Queued post: "${title}" to /${submolt}`);
  console.log(`  Queue now has ${queue.posts.length} posts, ${queue.comments.length} comments`);
}

function addComment(postId, content) {
  const queue = loadQueue();
  queue.comments.push({
    id: Date.now().toString(),
    postId,
    content,
    queuedAt: new Date().toISOString()
  });
  saveQueue(queue);
  console.log(`✓ Queued comment on post ${postId}`);
  console.log(`  Queue now has ${queue.posts.length} posts, ${queue.comments.length} comments`);
}

function addUpvote(postId) {
  const queue = loadQueue();
  if (!queue.upvotes.includes(postId)) {
    queue.upvotes.push(postId);
    saveQueue(queue);
    console.log(`✓ Queued upvote for ${postId}`);
  }
}

function listQueue() {
  const queue = loadQueue();
  
  console.log('\n📋 MOLTBOOK CONTENT QUEUE\n');
  
  if (queue.posts.length === 0 && queue.comments.length === 0 && queue.upvotes.length === 0) {
    console.log('Queue is empty.\n');
    return;
  }
  
  if (queue.posts.length > 0) {
    console.log(`📝 POSTS (${queue.posts.length}):`);
    for (const p of queue.posts) {
      console.log(`  [${p.id}] "${p.title}" → /${p.submolt}`);
      console.log(`      ${p.content.substring(0, 80)}...`);
      console.log(`      Queued: ${p.queuedAt}`);
    }
    console.log();
  }
  
  if (queue.comments.length > 0) {
    console.log(`💬 COMMENTS (${queue.comments.length}):`);
    for (const c of queue.comments) {
      console.log(`  [${c.id}] on post ${c.postId}`);
      console.log(`      ${c.content.substring(0, 80)}...`);
    }
    console.log();
  }
  
  if (queue.upvotes.length > 0) {
    console.log(`⬆️ UPVOTES (${queue.upvotes.length}):`);
    console.log(`  ${queue.upvotes.join(', ')}`);
    console.log();
  }
}

async function flushQueue(dryRun = false) {
  const queue = loadQueue();
  
  if (queue.posts.length === 0 && queue.comments.length === 0 && queue.upvotes.length === 0) {
    console.log('Queue is empty, nothing to flush.');
    return;
  }
  
  console.log(`\n🚀 FLUSHING QUEUE ${dryRun ? '(DRY RUN)' : ''}\n`);
  
  // Try to load moltbook client
  let moltbook;
  try {
    moltbook = require('../moltbook-quickstart');
  } catch (e) {
    console.error('Could not load moltbook-quickstart. Make sure it exists.');
    process.exit(1);
  }
  
  // Test API first
  if (!dryRun) {
    try {
      console.log('Testing API connection...');
      await moltbook.me();
      console.log('✓ API is up!\n');
    } catch (e) {
      console.log(`✗ API still down: ${e.message}`);
      console.log('Queue preserved. Try again later.\n');
      return;
    }
  }
  
  let posted = 0, commented = 0, upvoted = 0;
  let failedPosts = [], failedComments = [];
  
  // Flush posts
  for (const p of queue.posts) {
    console.log(`Posting: "${p.title}"...`);
    if (dryRun) {
      console.log('  [DRY RUN] Would post\n');
      posted++;
    } else {
      try {
        const result = await moltbook.post(p.content, { title: p.title, submolt: p.submolt });
        console.log(`  ✓ Posted! ID: ${result.id}\n`);
        posted++;
      } catch (e) {
        console.log(`  ✗ Failed: ${e.message}\n`);
        failedPosts.push(p);
      }
    }
  }
  
  // Flush comments
  for (const c of queue.comments) {
    console.log(`Commenting on ${c.postId}...`);
    if (dryRun) {
      console.log('  [DRY RUN] Would comment\n');
      commented++;
    } else {
      try {
        const result = await moltbook.comment(c.postId, c.content);
        console.log(`  ✓ Commented! ID: ${result.id}\n`);
        commented++;
      } catch (e) {
        console.log(`  ✗ Failed: ${e.message}\n`);
        failedComments.push(c);
      }
    }
  }
  
  // Flush upvotes
  for (const postId of queue.upvotes) {
    if (!dryRun) {
      try {
        await moltbook.upvote(postId);
        upvoted++;
      } catch (e) {
        // Ignore upvote errors
      }
    } else {
      upvoted++;
    }
  }
  
  // Update queue with failures
  if (!dryRun) {
    queue.posts = failedPosts;
    queue.comments = failedComments;
    queue.upvotes = [];
    saveQueue(queue);
  }
  
  console.log('─'.repeat(40));
  console.log(`✓ Posted: ${posted}, Commented: ${commented}, Upvoted: ${upvoted}`);
  if (failedPosts.length > 0 || failedComments.length > 0) {
    console.log(`✗ Failed: ${failedPosts.length} posts, ${failedComments.length} comments (kept in queue)`);
  }
}

function clearQueue() {
  saveQueue({ posts: [], comments: [], upvotes: [] });
  console.log('✓ Queue cleared');
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];
  
  if (!cmd || cmd === 'help' || cmd === '--help') {
    console.log(`
Moltbook Content Queue - Store content for later posting

Commands:
  add-post <title> <content> [--submolt <name>]   Queue a post
  add-comment <postId> <content>                  Queue a comment
  add-upvote <postId>                             Queue an upvote
  list                                            Show queued content
  flush [--dry-run]                               Post all queued content
  clear                                           Clear the queue
  help                                            Show this help
`);
    return;
  }
  
  switch (cmd) {
    case 'add-post': {
      const title = args[1];
      const content = args[2];
      const submoltIdx = args.indexOf('--submolt');
      const submolt = submoltIdx > -1 ? args[submoltIdx + 1] : 'general';
      if (!title || !content) {
        console.log('Usage: add-post <title> <content> [--submolt <name>]');
        return;
      }
      addPost(title, content, submolt);
      break;
    }
    case 'add-comment': {
      const postId = args[1];
      const content = args[2];
      if (!postId || !content) {
        console.log('Usage: add-comment <postId> <content>');
        return;
      }
      addComment(postId, content);
      break;
    }
    case 'add-upvote': {
      const postId = args[1];
      if (!postId) {
        console.log('Usage: add-upvote <postId>');
        return;
      }
      addUpvote(postId);
      break;
    }
    case 'list':
      listQueue();
      break;
    case 'flush':
      await flushQueue(args.includes('--dry-run'));
      break;
    case 'clear':
      clearQueue();
      break;
    default:
      console.log(`Unknown command: ${cmd}. Try 'help'.`);
  }
}

main().catch(console.error);

module.exports = { addPost, addComment, addUpvote, loadQueue, flushQueue };
