# Advanced SERP Checker

A production-ready Google rank checker powered by Serper.dev. It fetches and analyzes up to 100 organic results, preserves real page-based positions, compares matching searches, tracks a target domain, and exports clean reports.

## Highlights

- Accurate organic positions across Google pages 1 through 10
- Top 10, 20, 50, or 100 result checks
- Country, language, device, location, date, and autocorrect controls
- Target URL and domain rank tracking
- Movement comparison against the previous matching search
- Search history stored locally in the browser
- Organic coverage, domain visibility, ads, and SERP feature analysis
- Search, domain, type, and sort filters
- CSV and JSON exports
- Shareable search URLs that never include the API key
- Server-side API key proxy, validation, timeout, retry, security headers, and rate limiting
- Zero runtime dependencies

## How top-100 ranking works

Serper returns one Google result page per request. A 100-result lookup therefore makes up to 10 Serper requests and can use up to 10 credits.

The server converts a provider position into an absolute rank using the Google page and slot. If the provider already returns an absolute rank, it is preserved. Duplicate canonical URLs are removed without compressing later ranks, so a real gap can remain in the sequence.

Google or Serper can return fewer unique organic URLs than requested. The interface reports this honestly as coverage, such as 86 / 100, instead of inventing rows.

## Quick start

Requirements: Node.js 18 or newer and a Serper.dev API key.

1. Clone the repository.
2. Copy .env.example to .env.
3. Set your key in .env:

    SERPER_API_KEY=your_real_key

4. Start the app:

    npm start

5. Open http://127.0.0.1:5173

For local testing, you can paste a key in the API connection section. Enable Remember on this device only on a trusted computer.

## Commands

    npm start        # Start the production server
    npm run dev      # Start with Node watch mode
    npm run check    # Check JavaScript syntax
    npm test         # Run the automated test suite

## Configuration

| Variable | Default | Purpose |
| --- | ---: | --- |
| SERPER_API_KEY | none | Server-side Serper API key |
| PORT | 5173 | HTTP port |
| RATE_LIMIT_PER_MINUTE | 30 | Search requests allowed per client IP |
| SERPER_TIMEOUT_MS | 15000 | Timeout for each Serper request |
| SERPER_CONCURRENCY | 3 | Maximum Serper pages fetched at once |

Never commit .env or a real API key. The included .gitignore excludes .env.

## Docker

Build and run:

    docker build -t advanced-serp-checker .
    docker run --rm -p 5173:5173 -e SERPER_API_KEY=your_real_key advanced-serp-checker

The container includes a health check at /api/health.

## Deployment

The app works on any Node.js host that can run a persistent HTTP server. Set SERPER_API_KEY in the host's secret or environment settings.

A render.yaml file is included for a Render deployment. Docker-based services such as Railway, Fly.io, and cloud container platforms can use the included Dockerfile.

Do not deploy a public instance with an unrestricted high-value API key. Keep the built-in rate limit enabled and add platform-level authentication or rate limiting for larger deployments.

## API

POST /api/search accepts JSON:

    {
      "q": "best running shoes",
      "gl": "us",
      "hl": "en",
      "device": "desktop",
      "location": "Anywhere",
      "num": 100,
      "tbs": "",
      "autocorrect": true
    }

When SERPER_API_KEY is not configured, local clients may send X-Serper-Key. Search responses include the merged data, fetched pages, estimated credits used, request ID, and organic coverage.

GET /api/health returns service status without exposing the key.

## Publish to GitHub

After creating an empty GitHub repository:

    git init
    git add .
    git commit -m "Initial release"
    git branch -M main
    git remote add origin https://github.com/YOUR_USERNAME/advanced-serp-checker.git
    git push -u origin main

The included GitHub Actions workflow runs syntax checks and tests on Node.js 20 and 22.

## Privacy

Search history and an optionally remembered browser key are stored in localStorage. History, exports, and share links do not contain the API key. Live queries are sent to this app's server and then to Serper.dev.

## Contributing

Read CONTRIBUTING.md before opening a pull request. Security issues should follow SECURITY.md and should not be posted publicly.

## License

MIT. See LICENSE.

