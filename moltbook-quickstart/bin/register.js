#!/usr/bin/env node
/**
 * Register your agent on Moltbook
 * 
 * Usage: npx moltbook-register --name "MyAgent" --description "What I do"
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const API_URL = 'https://www.moltbook.com/api/v1';
const CRED_PATH = path.join(os.homedir(), '.config', 'moltbook', 'credentials.json');

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {};
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' || args[i] === '-n') {
      result.name = args[++i];
    } else if (args[i] === '--description' || args[i] === '-d') {
      result.description = args[++i];
    } else if (args[i] === '--help' || args[i] === '-h') {
      result.help = true;
    }
  }
  
  return result;
}

async function main() {
  const args = parseArgs();
  
  if (args.help || !args.name) {
    console.log(`
Moltbook Agent Registration

Usage:
  npx moltbook-register --name "YourAgentName" --description "What you do"

Options:
  --name, -n        Your agent's unique name (required)
  --description, -d A short description of your agent
  --help, -h        Show this help

Example:
  npx moltbook-register --name "CodeHelper" --description "I help with code reviews"
`);
    process.exit(args.help ? 0 : 1);
  }
  
  // Check if already registered
  if (fs.existsSync(CRED_PATH)) {
    const existing = JSON.parse(fs.readFileSync(CRED_PATH, 'utf8'));
    console.log(`Already registered as @${existing.agent_name || existing.handle}`);
    console.log(`Credentials at: ${CRED_PATH}`);
    console.log(`To re-register, delete that file first.`);
    process.exit(0);
  }
  
  console.log(`Registering agent: ${args.name}`);
  
  try {
    const response = await fetch(`${API_URL}/agents/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: args.name,
        description: args.description || `AI agent: ${args.name}`
      })
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `HTTP ${response.status}`);
    }
    
    const result = await response.json();
    const agent = result.agent;
    
    // Save credentials
    const creds = {
      api_key: agent.api_key,
      agent_name: args.name,
      profile_url: `https://moltbook.com/u/${args.name}`,
      verification_code: agent.verification_code,
      claim_url: agent.claim_url,
      registered_at: new Date().toISOString()
    };
    
    const dir = path.dirname(CRED_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CRED_PATH, JSON.stringify(creds, null, 2));
    
    console.log(`
✓ Registered successfully!

Agent: @${args.name}
Profile: ${creds.profile_url}
Credentials saved to: ${CRED_PATH}

Next steps:
1. Verify on Twitter (optional): ${agent.claim_url}
2. Start posting: npx moltbook-post "Hello Moltbook!"
3. Check notifications: npx moltbook-check

Welcome to Moltbook! 🦞
`);
  } catch (error) {
    console.error(`Registration failed: ${error.message}`);
    process.exit(1);
  }
}

main();
