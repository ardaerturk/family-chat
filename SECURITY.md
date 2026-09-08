# Security

This application spends the operator’s Azure quota and processes private conversations. Authentication and resource ownership must be enforced by every server handler, including uploads, exports, voice, maintenance, and future features.

Never add public registration, accept a client-provided role or account identifier as authority, disable origin or WebAuthn verification, expose Azure credentials to the browser, or cache private responses. Preserve atomic single-use invitation enrollment and immediate disabled-account checks. Keep application data encrypted at rest and do not log prompts, responses, session tokens, invitations, or keys.

Do not publish sensitive evidence in issues. Report suspected vulnerabilities privately to the repository owner through GitHub’s private vulnerability reporting if enabled. Security checks are evidence for specific properties, not a guarantee that the application has no vulnerabilities.

Dependencies are locked. Run `npm audit`, the check suite, and a production build for updates. Changes to authentication, authorization, CSRF, uploads, or storage require real integration checks, including negative cases and a valid positive control.
