# Knots — Documentation Index

Welcome to the Knots codebase documentation. This directory contains detailed technical documentation for all major subsystems in the extension.

## Contents

| Directory | Description |
|---|---|
| [architecture/](architecture/) | System architecture, module map, and design principles |
| [authentication/](authentication/) | OAuth 2.0 flow, token lifecycle, and session management |
| [data-flow/](data-flow/) | End-to-end data flow for all user actions |
| [caching/](caching/) | URL cache design, sync strategy, and persistence |
| [api/](api/) | Google Sheets & Drive API wrapper documentation |
| [testing/](testing/) | Test strategy, mocking approach, and how to write tests |
| [setup/](setup/) | Developer onboarding, build system, and environment setup |
| [google-setup/](google-setup/) | Google Cloud Console setup, OAuth credentials, and Client ID configuration |

## Quick Start

If you're new to the codebase, read in this order:

1. **[Setup — Developer Onboarding](setup/README.md)** — Get the project running locally
2. **[Architecture — Overview](architecture/README.md)** — Understand the module layout and responsibilities
3. **[Data Flow — Save Pipeline](data-flow/README.md)** — Trace the core user action end-to-end
4. **[Authentication](authentication/README.md)** — Understand the OAuth flow and token management
5. **[Caching](caching/README.md)** — How duplicate detection works
