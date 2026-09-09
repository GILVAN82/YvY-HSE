# Current limitations and residual risks

Baseline: committed runtime `a0edf23`, branch `capstone/yvy-hse`; Sprint H documentation audit. Authentication, RBAC, authenticated approval and project isolation are implemented. This is not a production certification.

| Classification | Residual risk / boundary | Response / ownership |
|---|---|---|
| CURRENT LIMITATION | Free-text personal data may survive field allowlists. | Minimize real data; organization defines consent and data handling. No universal DLP claim. |
| CURRENT LIMITATION | Four English approved summaries; 24 PT/EN retrieval queries. | Bound all accuracy claims to corpus/dataset; unsupported evidence abstains. |
| CURRENT LIMITATION | Current live generated-answer quality not fully benchmarked. | Keep simulated results separate; conduct a separately scoped live benchmark. |
| CURRENT LIMITATION | Browser-dependent STT and external voice/model services. | Use typed input/visible answer on failure; review provider processing before real-data use. |
| CURRENT LIMITATION | LOTO exact project-code binding, no equipment-level resource contract or delegated/team approval. | Unresolved scope blocks requests; digital approval never establishes safe equipment. |
| CURRENT LIMITATION | Generic writes can race with parent/project reassignment. | Current request scope checks and refreshed subsequent authorization are not full transactional isolation. |
| CURRENT LIMITATION | Inspector is session-local; delivered browser content cannot be remotely revoked. | Clear on identity change, enforce current scope on server access; do not claim retroactive deletion. |
| CURRENT LIMITATION | Retention/backups and free-text deletion are not a complete governed lifecycle. | Forget disables memory; define deployment retention and deletion obligations. |
| CURRENT LIMITATION | Ambiguous contractor relations remain unavailable; global reference classifications are explicit policy. | Normalize relations and review classifications before expanding access. |
| CURRENT LIMITATION | Legacy execution does not provide primary graph verification/HITL parity. | Present the default LangGraph path. |
| FUTURE HARDENING | Equipment linkage, transactional moves, load/outage tests, larger multilingual calibration. | Separate scoped engineering work with regression gates. |
| FUTURE HARDENING | Central secrets, immutable audit retention, backup/recovery and external security assessment. | Deployment owner must design and validate these controls. |
| OUT OF CAPSTONE SCOPE | Company-level SaaS tenancy and production/legal certification. | No claim that project scope implements company tenancy. |
| OUT OF CAPSTONE SCOPE | Physical LOTO execution, inspection and legal truth verification. | Competent humans and approved site procedures retain authority. |

The committed agent reads operational data and can persist controlled memory/HITL state. Record-draft write assistance and shared chat/history refinements remain LOCAL / UNCOMMITTED. The current system supports decisions; it does not replace the HSE professional or prove accident reduction.
