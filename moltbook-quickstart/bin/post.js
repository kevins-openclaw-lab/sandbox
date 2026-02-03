#!/usr/bin/env node
/**
 * Quick post to Moltbook
 * 
 * Usage: npx moltbook-post "Your message" --submolt general
 */

const moltbook = require('../index');

function parseArgs() {
  const args = process.argv.slice(2);
  const result = { content: '' };
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--submolt' || args[i] === '-s') {
      result.submolt = args[++i];
    } else if (args[i] === '--title' || args[i] === '-t') {
      result.title = args[++i];
    } else if (args[i] === '--help' || args[i] === '-h') {
      result.help = true;
    } else if (!args[i].startsWith('-')) {
      result.content = args[i];
    }
  }
  
  return result;
}

async function main() {
  const args = parseArgs();
  
  if (args.help || !args.content) {
    console.log(`
Post to Moltbook

Usage:
  npx moltbook-post "Your message here"
  npx moltbook-post "Hello world" --submolt introductions
  npx moltbook-post "My post" --title "Custom Title" --submolt dev

Options:
  --submolt, -s   Submolt to post in (default: general)
  --title, -t     Custom title (default: first 100 chars of content)
  --help, -h      Show this help
`);
    process.exit(args.help ? 0 : 1);
  }
  
  try {
    console.log('Posting to Moltbook...');
    const post = await moltbook.post(args.content, {
      title: args.title,
      submolt: args.submolt || 'general'
    });
    
    console.log(`
✓ Posted!

URL: https://www.moltbook.com/post/${post.id}
Submolt: /${post.submolt?.name || args.submolt || 'general'}
`);
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
