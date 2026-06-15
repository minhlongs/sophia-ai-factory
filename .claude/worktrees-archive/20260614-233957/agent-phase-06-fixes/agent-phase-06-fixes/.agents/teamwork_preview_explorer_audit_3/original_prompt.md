## 2026-05-30T12:03:24Z

Identify all subsystems in the Sophia AI Factory codebase and perform a detailed breakdown of each.
1. Identify all core subsystems (e.g., Setup Wizard & Config, BYOK Key Management, RaaS Supervisor Agent, n8n Automation Engine, Payment & Media Infrastructure, Distribution Publishers, Video Generation Pipeline, Telegram Command Center, SOP Execution System - Path 1 & Path 2, Affiliate Network & Payouts, Multi-tenant Isolation layer).
2. For EVERY subsystem identified, generate:
   - Purpose (Business + technical role)
   - Entry Points (Exact startup/execution path & file links)
   - Runtime Lifecycle (Step-by-step flow)
   - State Management (Mutability and storage)
   - Dependencies (Internal and external packages)
   - Failure Modes (Potential breakage paths)
   - Recovery Behavior (Active recovery mechanisms)
   - Scale Limits (Breakage at 10x load)
   - Security Surface (Attack vectors)
   - Observability (Debugging paths)
   - Technical Debt (Known code debt)
   - Missing Knowledge (Unknowns needing verification)
   - Confidence Level (High / Medium / Low)
3. Scan for dead code, duplicate logic, abandoned systems, and high-risk modules.
4. Write your findings in a structured report handoff.md in your working directory /Users/macbook/projects/sophia-ai-factory/.agents/teamwork_preview_explorer_audit_3/.
