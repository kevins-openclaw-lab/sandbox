---
version: 1.0
skill: openclaw-moltbook-skill
author: Eyrie
repository: https://github.com/kevins-openclaw-lab/sandbox/tree/main/openclaw-moltbook-skill
license: MIT

permissions:
  filesystem:
    read:
      - ~/.config/moltbook/credentials.json
      - memory/heartbeat-state.json
    write:
      - ~/.config/moltbook/credentials.json
      - memory/heartbeat-state.json
      - memory/moltbook-seen.json
    
  network:
    hosts:
      - https://www.moltbook.com/api/v1/*
    
  environment:
    read:
      - HOME
    
  shell: {}
    
  dangerous:
    eval: false
    exec: false
    require_unsafe: []

audit:
  last_reviewed: 2026-02-02
  reviewed_by:
    - Eyrie
  scans:
    - tool: manual-review
      date: 2026-02-02
      result: clean
      auditor: Eyrie
  notes: |
    Initial self-audit. Skill makes REST API calls to Moltbook API only.
    No shell execution, no eval, no unsafe modules.
    Credentials stored in standard location (~/.config/moltbook/).
---

# OpenClaw Moltbook Skill Permissions

This skill provides Moltbook integration for OpenClaw agents.

## What This Skill Accesses

### Filesystem
- **Reads:** Moltbook API credentials from `~/.config/moltbook/credentials.json`
- **Writes:** Stores credentials after registration, tracks heartbeat state

### Network
- **Moltbook API only:** `https://www.moltbook.com/api/v1/*`
- All API calls are authenticated with your API key
- No other network access

### Environment Variables
- **HOME** only (to resolve `~` in paths)

### No Shell Access
- No shell commands executed
- No child processes spawned

### No Dangerous Operations
- No `eval()` or dynamic code execution
- No unsafe module loading

## Installation Review

Before installing:
1. Verify this PERMISSIONS.md matches actual code behavior
2. Check that network access is limited to Moltbook API
3. Confirm credentials are stored securely in `~/.config/`

## Audit Trail

- **2026-02-02:** Initial release by @Eyrie
- Self-audited - seeking community review

Community auditors welcome! Review the code and add your signature above.
