# Security Policy

## Supported Versions

This project is published primarily as a portfolio reference. The `main`
branch is the only supported branch and receives security fixes on a
best-effort basis.

| Version | Supported          |
| ------- | ------------------ |
| `main`  | :white_check_mark: |
| Others  | :x:                |

## Reporting a Vulnerability

**Please do NOT open a public GitHub issue for security reports.**

If you believe you have found a security vulnerability in this project,
please report it privately through one of the following channels:

1. **GitHub Security Advisories** (preferred) — open a private advisory at
   `Security` → `Advisories` → `Report a vulnerability` on this repository.
   GitHub will create a private discussion thread visible only to the
   maintainers and to you.
2. **Email** — send the details to the maintainer's public email address
   listed on their GitHub profile, with the subject prefix
   `[SECURITY] Pulse — Social Media Platform`.

When reporting, please include:

- A clear description of the issue and the impact you observed.
- Step-by-step reproduction instructions (or a minimal proof of concept).
- The affected route, file, or component if you can pinpoint it.
- Your assessment of severity (low / medium / high / critical) and any
  suggested remediation.

## Disclosure Process

- We aim to acknowledge new reports within **72 hours**.
- A fix or mitigation will be prepared on a private branch; a coordinated
  disclosure date will be agreed with the reporter.
- Once a fix has been merged and (where applicable) deployed, a public
  advisory will be published crediting the reporter (unless they prefer
  to remain anonymous).

## Out of Scope

The following are explicitly **out of scope** and will be closed without
action:

- Reports based on running the application against a custom or modified
  fork.
- Self-XSS that requires the victim to paste attacker-controlled code into
  their own DevTools console.
- Missing security headers on a local development build (`NODE_ENV !==
  "production"`).
- Denial-of-service achieved by deliberately exceeding the documented
  rate limits.
- Vulnerabilities in third-party dependencies that are already tracked by
  Dependabot — please file those upstream.

## Operational Security Notes

If you are running your own deployment of this project:

- **Never commit a `.env` file.** The repository ships only
  `*.env.example` placeholders. See `STEPS.md` → STEP 40 for the full
  pre-publish audit playbook.
- Generate a fresh `JWT_SECRET` (≥ 32 random bytes) per environment.
- Restrict MongoDB Atlas Network Access to your provider's outbound IPs
  rather than `0.0.0.0/0` whenever possible.
- Rotate Cloudinary API keys if you ever suspect they may have leaked
  through a screenshot, log, or accidental commit.
- Enable **Secret scanning** and **Push protection** in
  `Settings → Code security and analysis` on the GitHub repository.

Thank you for helping keep this project and its users safe.
