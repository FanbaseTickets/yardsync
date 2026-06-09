# Branch Protection Setup

To prevent accidental direct pushes to `main`:

1. Go to https://github.com/FanbaseTickets/yardsync
2. **Settings → Branches → Add branch ruleset**
3. **Branch name pattern:** `main`
4. Enable: **Require a pull request before merging**
5. Enable: **Require status checks to pass**
6. Enable: **Do not allow bypassing the above settings**

This ensures every change to production goes through a PR and preview deployment first.
