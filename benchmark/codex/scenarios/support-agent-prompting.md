# Support Agent Prompting

Subject type: fictional product/internal platform docs.

Implementation target: Next.js App Router artifact workspace.

Task: implement the documented support-agent prompting contract by creating:

- `lib/agent-prompt.ts`
- `app/api/agent/route.ts`
- a homepage note in `app/page.tsx`

Provider comparison:

- Farming Labs/docs delivers the implementation runbook directly through `<Agent>` content in
  `/docs.md`.
- Mintlify follows the generic discovery path through `/docs.md`, `/llms.txt`, then the target page.

Metrics:

- Time to full implementation.
- Session errors.
- Cost proxies: tokens, docs bytes, docs fetches.
- Right page at right time: first relevant fetch and wrong/noisy fetches before it.
