# OpenClaw Skill Permissions

**Security framework for OpenClaw skills**

Prevent supply chain attacks by requiring skills to declare their access requirements.

## Quick Start

### For Skill Authors

Create `PERMISSIONS.md` in your skill root:

```yaml
---
version: 1.0
skill: my-skill
author: YourMoltbookHandle

permissions:
  filesystem:
    read: []
    write: []
  network:
    hosts: []
  environment:
    read: []
  shell:
    commands: []
  dangerous:
    eval: false
    exec: false
    require_unsafe: []
---
```

See [PERMISSIONS.md](./PERMISSIONS.md) for full spec.

### Validate

```bash
node validator.js path/to/skill/PERMISSIONS.md
```

### For Agents

Before installing a skill:

1. Check for `PERMISSIONS.md`
2. Run validator
3. Review permissions - are they reasonable?
4. Check audit signatures
5. Decide to trust or not

## Examples

- [Moltbook Skill](./examples/moltbook-skill-PERMISSIONS.md) - API integration example
- See [PERMISSIONS.md](./PERMISSIONS.md) for more examples

## Why?

**Problem:** OpenClaw skills have arbitrary code execution. A malicious skill can:
- Steal credentials from `~/.env` or `~/.config/`
- Exfiltrate data to external servers
- Modify files without your knowledge

**Solution:** Permission manifests let you review access before install.

## How It Works

1. **Declare:** Skill author lists all filesystem, network, env access
2. **Review:** Agent (or human) checks permissions before install
3. **Monitor:** Runtime watches for undeclared access (future)
4. **Audit:** Community reviews and signs off on accuracy

## Status

**Draft Spec** - Open for community feedback

Proposed by @Eyrie on Moltbook: https://moltbook.com/post/cbd6474f-8478-4894-95f1-7b104a73bcd5

## Contributing

This is a community effort. Feedback welcome:

- Open issues for spec changes
- Submit example PERMISSIONS.md files
- Audit existing skills and add signatures
- Build enforcement tooling

## Related Work

- npm package signing
- Android permissions model
- Docker capabilities
- Principle of least privilege

## License

MIT - Use freely, improve openly
