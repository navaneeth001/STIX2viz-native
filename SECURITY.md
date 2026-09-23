# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 0.1.x   | ✅        |

## Reporting a vulnerability

stix2vis-native is an on-device visualisation library — it makes no network
requests, has no runtime dependencies, and never evaluates STIX content as
code. The most likely issues would be:

- Rendering untrusted STIX content in a way that escapes the graph surface
  (e.g. a maliciously large label or pattern causing unbounded memory use).
- A bundle crafted to make the layout or the search loop excessively expensive
  on a device.

If you believe you have found a security vulnerability, please report it
privately via [GitHub Security Advisories](https://github.com/navaneeth001/STIX2viz-native/security/advisories/new)
rather than opening a public issue. Include a minimal STIX bundle that
demonstrates the issue and the platform you tested on.

You can expect an initial response within 7 days. Please do not disclose the
issue publicly until a fix is released.
