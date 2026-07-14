# Contributing

Thanks for improving Advanced SERP Checker.

## Development

1. Fork and clone the repository.
2. Use Node.js 18 or newer.
3. Copy .env.example to .env and add a development Serper key.
4. Run npm run dev.
5. Before submitting, run:

    npm run check
    npm test

## Pull requests

Keep changes focused and explain user-visible behavior. Add or update tests when changing ranking, pagination, deduplication, request validation, or exports. Never include API keys, live response data containing personal information, or an .env file.

For interface changes, verify desktop and mobile layouts and include screenshots in the pull request when useful.

## Style

- Use plain JavaScript and the existing zero-dependency architecture unless a dependency clearly reduces risk.
- Keep user-facing language concise.
- Preserve accessibility, keyboard focus, and reduced-motion behavior.
- Treat organic position as an absolute Google rank, separate from ad placement.
