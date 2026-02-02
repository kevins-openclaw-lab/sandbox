#!/usr/bin/env node

/**
 * Moltbook Helper for Alfred
 * 
 * Replaces manual curl commands with proper skill integration.
 */

const path = require('path');
const skillPath = path.join(__dirname, 'openclaw-moltbook-skill');
const { 
  createClient, 
  getRelevantPosts,
  shouldCheckMoltbook,
  updateMoltbookCheckTime 
} = require(skillPath);

/**
 * Check Moltbook feed and report interesting activity
 */
async function checkFeed() {
  const client = createClient();
  
  console.log('🔍 Checking Moltbook...\n');
  
  // Get relevant posts
  const posts = await getRelevantPosts(client, {
    sort: 'hot',
    limit: 30,
    minScore: 10,
    maxComments: 100,
    keywords: ['collaboration', 'multi-agent', 'security', 'infrastructure', 'openclaw'],
    excludeKeywords: ['token', 'pump', 'moonshot', '$MOLT']
  });
  
  console.log(`Found ${posts.length} relevant posts\n`);
  
  if (posts.length === 0) {
    return { action: 'none', posts: [] };
  }
  
  // Show top 5
  for (const post of posts.slice(0, 5)) {
    const score = (post.upvotes || 0) - (post.downvotes || 0);
    const comments = post.comment_count || 0;
    console.log(`[${score}↑ ${comments}💬] ${post.title}`);
    console.log(`  by ${post.author.name} in /${post.submolt.name}`);
    console.log(`  https://www.moltbook.com/post/${post.id}`);
    console.log();
  }
  
  return { action: 'report', posts: posts.slice(0, 5) };
}

/**
 * Check a specific post for new activity
 */
async function checkPost(postId) {
  const client = createClient();
  
  const post = await client.getPost(postId);
  const comments = await client.listComments(postId, { sort: 'new', limit: 20 });
  
  const score = (post.upvotes || 0) - (post.downvotes || 0);
  
  console.log(`\n📊 Post Status:`);
  console.log(`Title: ${post.title}`);
  console.log(`Score: ${score}`);
  console.log(`Comments: ${post.comment_count || 0}`);
  console.log(`URL: https://www.moltbook.com/post/${postId}\n`);
  
  if (comments.length > 0) {
    console.log(`Recent comments (${comments.length}):\n`);
    for (const c of comments.slice(0, 5)) {
      const cScore = (c.upvotes || 0) - (c.downvotes || 0);
      console.log(`[${cScore}↑] @${c.author.name}`);
      console.log(`  ${c.content.substring(0, 150)}...`);
      console.log();
    }
  }
  
  return { post, comments };
}

/**
 * Post to Moltbook
 */
async function post(data) {
  const client = createClient();
  
  const result = await client.createPost({
    submolt: data.submolt || 'general',
    title: data.title,
    content: data.content
  });
  
  console.log(`\n✓ Post created!`);
  console.log(`URL: https://www.moltbook.com/post/${result.id}`);
  
  return result;
}

/**
 * Comment on a post
 */
async function comment(postId, content, parentId = null) {
  const client = createClient();
  
  const result = await client.createComment({
    postId,
    content,
    ...(parentId && { parentId })
  });
  
  console.log(`\n✓ Comment posted!`);
  console.log(`ID: ${result.id}`);
  
  return result;
}

/**
 * Search Moltbook
 */
async function search(query) {
  const client = createClient();
  
  const results = await client.search.query(query);
  
  console.log(`\n🔍 Search results for "${query}":\n`);
  console.log(`Posts: ${results.posts?.length || 0}`);
  console.log(`Agents: ${results.agents?.length || 0}`);
  console.log(`Submolts: ${results.submolts?.length || 0}\n`);
  
  if (results.posts && results.posts.length > 0) {
    console.log('Top Posts:');
    for (const post of results.posts.slice(0, 5)) {
      const score = (post.upvotes || 0) - (post.downvotes || 0);
      console.log(`  [${score}↑] ${post.title}`);
    }
    console.log();
  }
  
  return results;
}

// CLI interface
const command = process.argv[2];
const args = process.argv.slice(3);

(async () => {
  try {
    switch (command) {
      case 'feed':
        await checkFeed();
        break;
      
      case 'post':
        if (!args[0]) {
          console.log('Usage: moltbook-helper.js post <postId>');
          process.exit(1);
        }
        await checkPost(args[0]);
        break;
      
      case 'search':
        if (!args[0]) {
          console.log('Usage: moltbook-helper.js search <query>');
          process.exit(1);
        }
        await search(args.join(' '));
        break;
      
      default:
        console.log('Usage:');
        console.log('  moltbook-helper.js feed');
        console.log('  moltbook-helper.js post <postId>');
        console.log('  moltbook-helper.js search <query>');
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();

module.exports = {
  checkFeed,
  checkPost,
  post,
  comment,
  search
};
