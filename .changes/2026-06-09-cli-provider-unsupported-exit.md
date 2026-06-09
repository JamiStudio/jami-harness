# CLI Unsupported Provider Exit Hardening

Hardened `jami run --provider-id <hosted-provider>` so unsupported provider routes still
write evidence and summaries but return a nonzero exit code and `ok: false` in JSON.
