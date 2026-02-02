#!/usr/bin/env node

/**
 * PERMISSIONS.md Validator
 * 
 * Usage: node validator.js path/to/PERMISSIONS.md
 */

const fs = require('fs');
const path = require('path');
const yaml = require('yaml');

const REQUIRED_FIELDS = ['version', 'skill', 'permissions'];
const REQUIRED_PERMISSION_TYPES = ['filesystem', 'network', 'environment', 'shell', 'dangerous'];

function validatePermissions(filePath) {
  const errors = [];
  const warnings = [];
  
  // Check file exists
  if (!fs.existsSync(filePath)) {
    errors.push(`File not found: ${filePath}`);
    return { valid: false, errors, warnings };
  }
  
  // Parse YAML
  let content;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    
    // Extract YAML between --- markers
    const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*$/m);
    if (!match) {
      errors.push('PERMISSIONS.md must contain YAML frontmatter between --- markers');
      return { valid: false, errors, warnings };
    }
    
    content = yaml.parse(match[1]);
  } catch (error) {
    errors.push(`YAML parse error: ${error.message}`);
    return { valid: false, errors, warnings };
  }
  
  // Check required fields
  for (const field of REQUIRED_FIELDS) {
    if (!content[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  }
  
  // Check version
  if (content.version && content.version !== 1.0) {
    warnings.push(`Unknown version: ${content.version} (expected 1.0)`);
  }
  
  // Check permissions structure
  if (content.permissions) {
    for (const type of REQUIRED_PERMISSION_TYPES) {
      if (!(type in content.permissions)) {
        errors.push(`Missing permission type: ${type}`);
      }
    }
    
    // Validate filesystem
    if (content.permissions.filesystem) {
      const fs = content.permissions.filesystem;
      
      if (fs.read && !Array.isArray(fs.read)) {
        errors.push('filesystem.read must be an array');
      }
      
      if (fs.write && !Array.isArray(fs.write)) {
        errors.push('filesystem.write must be an array');
      }
      
      // Check for overly broad wildcards
      const allPaths = [...(fs.read || []), ...(fs.write || [])];
      for (const p of allPaths) {
        if (p === '~/**' || p === '/**') {
          warnings.push(`Very broad filesystem access: ${p}`);
        }
        if (p.includes('..')) {
          warnings.push(`Path traversal pattern detected: ${p}`);
        }
      }
    }
    
    // Validate network
    if (content.permissions.network) {
      const net = content.permissions.network;
      
      if (net.hosts && !Array.isArray(net.hosts)) {
        errors.push('network.hosts must be an array');
      }
      
      // Check for protocol
      if (net.hosts) {
        for (const host of net.hosts) {
          if (!host.match(/^[a-z]+:\/\//)) {
            warnings.push(`Network host missing protocol: ${host}`);
          }
        }
      }
    }
    
    // Validate environment
    if (content.permissions.environment) {
      const env = content.permissions.environment;
      
      if (env.read && !Array.isArray(env.read)) {
        errors.push('environment.read must be an array');
      }
      
      if (env.read && env.read.includes('*')) {
        warnings.push('Reading all environment variables (*)');
      }
    }
    
    // Validate shell
    if (content.permissions.shell) {
      const shell = content.permissions.shell;
      
      if (shell.commands && !Array.isArray(shell.commands)) {
        errors.push('shell.commands must be an array');
      }
    }
    
    // Validate dangerous
    if (content.permissions.dangerous) {
      const dangerous = content.permissions.dangerous;
      
      if (typeof dangerous.eval !== 'boolean') {
        errors.push('dangerous.eval must be a boolean');
      }
      
      if (typeof dangerous.exec !== 'boolean') {
        errors.push('dangerous.exec must be a boolean');
      }
      
      if (dangerous.require_unsafe && !Array.isArray(dangerous.require_unsafe)) {
        errors.push('dangerous.require_unsafe must be an array');
      }
      
      // Warn on dangerous flags
      if (dangerous.eval) {
        warnings.push('⚠️  Skill uses eval() - high risk');
      }
      
      if (dangerous.exec) {
        warnings.push('⚠️  Skill spawns child processes - high risk');
      }
      
      if (dangerous.require_unsafe && dangerous.require_unsafe.length > 0) {
        warnings.push(`⚠️  Requires unsafe modules: ${dangerous.require_unsafe.join(', ')}`);
      }
    }
  }
  
  // Check audit section
  if (content.audit) {
    if (content.audit.reviewed_by && content.audit.reviewed_by.length === 0) {
      warnings.push('No auditors listed');
    }
    
    if (!content.audit.last_reviewed) {
      warnings.push('No last_reviewed date');
    }
  } else {
    warnings.push('No audit section - consider getting community review');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    content
  };
}

function formatResults(results) {
  console.log('\n=== PERMISSIONS.md Validation ===\n');
  
  if (results.valid) {
    console.log('✅ Valid PERMISSIONS.md');
  } else {
    console.log('❌ Invalid PERMISSIONS.md');
  }
  
  console.log();
  
  if (results.errors.length > 0) {
    console.log('Errors:');
    for (const error of results.errors) {
      console.log(`  ❌ ${error}`);
    }
    console.log();
  }
  
  if (results.warnings.length > 0) {
    console.log('Warnings:');
    for (const warning of results.warnings) {
      console.log(`  ⚠️  ${warning}`);
    }
    console.log();
  }
  
  if (results.content && results.valid) {
    console.log('Summary:');
    console.log(`  Skill: ${results.content.skill}`);
    console.log(`  Author: ${results.content.author || 'unknown'}`);
    console.log(`  Version: ${results.content.version}`);
    
    const p = results.content.permissions;
    console.log('\n  Permissions:');
    
    if (p.filesystem && (p.filesystem.read || p.filesystem.write)) {
      const readCount = p.filesystem.read ? p.filesystem.read.length : 0;
      const writeCount = p.filesystem.write ? p.filesystem.write.length : 0;
      console.log(`    📁 Filesystem: ${readCount} read, ${writeCount} write`);
    }
    
    if (p.network && p.network.hosts) {
      console.log(`    🌐 Network: ${p.network.hosts.length} host(s)`);
    }
    
    if (p.environment && p.environment.read) {
      console.log(`    🔑 Environment: ${p.environment.read.length} var(s)`);
    }
    
    if (p.shell && p.shell.commands) {
      console.log(`    💻 Shell: ${p.shell.commands.length} command(s)`);
    }
    
    if (p.dangerous && (p.dangerous.eval || p.dangerous.exec)) {
      console.log(`    ⚠️  Dangerous: eval=${p.dangerous.eval}, exec=${p.dangerous.exec}`);
    }
  }
  
  console.log();
  
  return results.valid ? 0 : 1;
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: node validator.js path/to/PERMISSIONS.md');
    process.exit(1);
  }
  
  const filePath = args[0];
  const results = validatePermissions(filePath);
  const exitCode = formatResults(results);
  
  process.exit(exitCode);
}

module.exports = { validatePermissions };
