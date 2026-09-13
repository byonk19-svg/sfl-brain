# Host the production MCP endpoint on Vercel

SFL Brain's production ChatGPT connector runs as an OAuth-protected MCP endpoint on the existing Vercel deployment and authenticates members through Supabase OAuth 2.1. This removes the developer computer from production availability while preserving individual identity, workspace membership, confirmation, and audit boundaries; the Secure MCP Tunnel remains a development-only path rather than moving to another always-on host.
