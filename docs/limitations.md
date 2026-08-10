# Known Limitations

This document describes the current product boundaries that should be stated
clearly during review or demonstration.

## Authentication and authorization

The local application does not currently implement authentication, RBAC,
multi-tenant isolation or verified human identity. Human approval records are
valid workflow evidence, but they do not identify an authenticated approver and
do not authorize physical work.

## Operational writes

The AI Agent is consultative. Its operational tools are read-only and cannot
create, update or delete HSE records. Existing application write endpoints are
outside the AI workflow.

## Human approval boundary

The HITL workflow can record an approve or reject decision and resume the
software graph. It cannot change equipment state, issue a real LOTO permit or
replace the competent person's field verification.

## Knowledge coverage

RAG is limited to the approved internal source set. If the collection contains
no relevant evidence, the agent returns controlled no-relevant-evidence
semantics. It must not fill gaps with general model knowledge.

## Provider availability

Live responses depend on a configured and reachable model provider. When no
provider is available, the API returns a controlled failure rather than a
fabricated response. Provider fallback is not treated as authorization to use
an unapproved model.

## Localization

English is the source and default product language. Localized resource files
are retained as functional translation data for the language selector. Agent
responses follow the current application language when controlled copy is
required and may answer user-authored text in supported languages.

## Deployment

The verified baseline is a local demonstration environment. Production use
would require authentication, authorization, tenant isolation, centralized
secret management, production observability, backup and recovery procedures,
and an operational security review.
