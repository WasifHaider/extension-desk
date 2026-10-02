---
name: fresh-clone-check
description: Prove the repo runs from a clean clone with no API key. Use before submitting or after changing setup, seed or README commands.
disable-model-invocation: true
---

Run this from the repo root. Everything happens in a temp directory outside the project.

1. Ensure changes are committed (`git status`); the clone only sees commits. Warn if the tree is dirty.
2. Create a temp dir outside the project and `git clone` this repo into it.
3. In the clone: `cp .env.example .env`, leave `GROQ_API_KEY` empty and set `LLM_PROVIDER=none`.
4. Run the README setup commands exactly as written (`npm run setup`, then dev). Do not fix anything by hand.
5. Run `npm test`.
6. Start the dev server in the background, wait until it answers, then:
   - `curl -s localhost:3000/api/meta` shows the manual-mode provider;
   - `curl -s localhost:3000/api/extension-requests` returns exactly 5 requests (seed scenarios B, D, E, F, G).
   Stop the server afterwards.
7. Report each step PASS/FAIL with the first useful error line, and anything that needed a manual workaround.
8. Delete the temp directory, even if a step failed.
