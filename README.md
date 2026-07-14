# Google SERP Checker and SEO Rank Tracker

[![CI](https://github.com/hasnainkhatri87/advanced-serp-checker/actions/workflows/ci.yml/badge.svg)](https://github.com/hasnainkhatri87/advanced-serp-checker/actions/workflows/ci.yml)
[![MIT License](https://img.shields.io/github/license/hasnainkhatri87/advanced-serp-checker)](LICENSE)
[![Node.js 18+](https://img.shields.io/badge/Node.js-18%2B-339933)](https://nodejs.org/)
[![Serper.dev](https://img.shields.io/badge/Powered%20by-Serper.dev-155eef)](https://serper.dev/)

**Advanced SERP Checker** is an open-source Google SERP checker, SEO rank checker, and keyword rank tracker powered by Serper.dev. Check accurate top-100 organic rankings by country, language, device, and location, then compare movement, analyze competitors and SERP features, and export reports to CSV or JSON.

It is built for SEO specialists, agencies, developers, content teams, and site owners who need a fast self-hosted alternative to subscription rank tracking tools.

## Features

- Accurate Google organic positions across pages 1 through 10
- Top 10, 20, 50, or 100 keyword ranking checks
- Country, language, location, desktop, mobile, and tablet targeting
- Target URL and domain rank tracking
- Ranking movement against the previous matching search
- Competitor and domain visibility analysis
- Google SERP feature detection
- Search history stored locally in the browser
- Filters for title, URL, snippet, domain, and result type
- CSV and JSON SEO report exports
- Shareable search URLs that never expose the API key
- Server-side Serper API proxy with validation, retries, timeouts, rate limiting, and security headers
- Docker and Render deployment support
- Zero runtime dependencies

## SEO use cases

### Keyword rank checking

Track where a page or domain appears in the first 100 Google organic results for a target keyword. Use country, language, device, and city-level location settings to reproduce the market you care about.

### Competitor SERP analysis

See which domains own the most results, their best positions, and which competitors repeatedly appear for the same query.

### Ranking movement monitoring

Run the same search again to compare each URL with its previous matching report. New, improved, unchanged, and declined rankings are identified automatically.

### SERP feature research

Detect answer boxes, AI overviews, knowledge graphs, People Also Ask, images, videos, local packs, shopping results, related searches, and top stories returned by Serper.

## How top-100 rankings work

Serper returns one Google result page per request. A 100-result lookup makes up to 10 requests and can use up to 10 Serper credits. The server fetches pages with bounded concurrency for faster reports.

Provider positions are converted into absolute Google ranks using the result page and slot. Positions that are already absolute are preserved. Duplicate canonical URLs are removed without compressing later rankings, so the report does not invent a better position.

Google or Serper may return fewer unique organic URLs than requested. The dashboard reports honest coverage, such as 86 / 100, instead of generating fake rows.

## Quick start

Requirements: Node.js 18 or newer and a [Serper.dev API key](https://serper.dev/api-key).

1. Clone the repository:

    git clone https://github.com/hasnainkhatri87/advanced-serp-checker.git
    cd advanced-serp-checker

2. Copy .env.example to .env and set your API key:

    SERPER_API_KEY=your_real_key

3. Start the SEO rank checker:

    npm start

4. Open http://127.0.0.1:5173

For local testing, you can paste a key into the API connection section. Enable Remember on this device only on a trusted computer.

## Commands

    npm start        # Start the production server
    npm run dev      # Start with Node watch mode
    npm run check    # Check JavaScript syntax
    npm test         # Run the automated ranking tests

## Configuration

| Variable | Default | Purpose |
| --- | ---: | --- |
| SERPER_API_KEY | none | Server-side Serper API key |
| PORT | 5173 | HTTP port |
| RATE_LIMIT_PER_MINUTE | 30 | Search requests allowed per client IP |
| SERPER_TIMEOUT_MS | 15000 | Timeout for each Serper request |
| SERPER_CONCURRENCY | 3 | Maximum Serper pages fetched at once |

Never commit .env or a real API key. The included .gitignore excludes .env.

## API example

POST /api/search with JSON:

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

When SERPER_API_KEY is not configured, local clients may send X-Serper-Key. Responses include merged results, fetched Google pages, estimated credits, request ID, and organic coverage.

GET /api/health returns service status without exposing the API key.

## Docker deployment

    docker build -t advanced-serp-checker .
    docker run --rm -p 5173:5173 -e SERPER_API_KEY=your_real_key advanced-serp-checker

The container includes a health check at /api/health. A render.yaml file is included for one-click configuration on Render. Other Node.js and container platforms can run the same server.

Do not expose a high-value Serper key without authentication and platform-level rate limiting. Use HTTPS in production.

## Technology

- Node.js HTTP server
- Vanilla JavaScript
- Responsive HTML and CSS
- Serper.dev Google Search API
- Node.js native test runner
- GitHub Actions
- Docker

## Privacy and security

Search history and an optionally remembered browser key are stored in localStorage. History, exports, and share links never contain the API key. Live searches are sent to this app's server proxy and then to Serper.dev.

Read [SECURITY.md](SECURITY.md) before deploying publicly. Report vulnerabilities through GitHub Security Advisories, not public issues.

## Contributing

Contributions for SEO analysis, keyword tracking, SERP features, rank accuracy, providers, and interface improvements are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md), run the tests, and open a focused pull request.

If this Google SERP checker helps your SEO workflow, star the repository so other developers can find it.

## License

Released under the [MIT License](LICENSE).
