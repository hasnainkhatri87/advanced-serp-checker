# Security Policy

## Supported version

Security fixes are applied to the latest release on the main branch.

## Reporting a vulnerability

Do not open a public issue for a vulnerability. Report it privately through GitHub Security Advisories for the repository.

Include the affected route or file, reproduction steps, impact, and a suggested fix when available. Remove API keys, tokens, personal data, and live customer search data from the report.

## Deployment guidance

- Configure SERPER_API_KEY as a host secret, never in source control.
- Keep RATE_LIMIT_PER_MINUTE enabled.
- Add authentication before exposing a high-value server key to untrusted users.
- Use HTTPS in production.
- Rotate a key immediately if it appears in a commit, log, screenshot, or issue.
- Do not enable Remember on this device on shared computers.
