# Security Audit Report — mekong-cli Core Engine

**Auditor Role**: Reviewer & Adversarial Critic  
**Date**: 2026-05-31  
**Audit Target**: mekong-cli core engine logic inside `src/` (specifically core, daemon, security, billing, telemetry)  
**Status**: COMPLETE (Verdict: REQUEST_CHANGES due to critical integrity/logic vulnerabilities)

---

## Executive Summary

A comprehensive security audit of the `mekong-cli` core engine has identified **three (3) CRITICAL**, **three (3) IMPORTANT**, and **one (1) MODERATE** security vulnerabilities. The target codebase contains significant authorization bypasses, architectural gaps in cryptographic verification, and credential exposure. 

All security-related unit tests (totaling 143 auth tests, 93 RBAC tests, and 75 sanitizer tests) currently pass, highlighting that existing test coverage does not assert security boundaries against active bypass attempts.

---

## 1. Verified Findings

### [CRITICAL] JWT Signature Validation Bypass and Tenant Forgery on Gateway Failure
*   **Where**: `src/core/auth_tenant.py` (L147-153), `src/core/auth_jwt.py` (L19-47), and `src/core/raas_auth/auth_gateway_mixin.py` (L102-105)
*   **Description**: 
    The `mekong-cli` authentication logic splits responsibility: it decodes JWT claims locally but relies on the RaaS Gateway for full cryptographic signature verification.
    However, when communicating with the Gateway, `auth_gateway_mixin.py` catches any `RequestException` (e.g. timeout, DNS failure, Gateway offline) and falls back to `self._tenant_manager.local_validate(token)`. 
    Inside `auth_tenant.py:local_validate`, if the token matches a JWT structure, it parses the claims via `decode_jwt` and accepts them as valid without any cryptographic verification of the signature.
    *   **Attack Vector**: An attacker can forge a JWT containing arbitrary `tenant_id`, `tier`, or admin permissions, and then trigger a connection failure to the gateway (or wait for an outage). The CLI will validate the token locally, trusting the forged payload completely.
*   **Action Items / Recommendation**:
    *   Do not fallback to permissive local validation on connection failure unless the token is matched against a local cryptographically secure offline license key.
    *   Implement client-side JWT signature verification using a pre-configured public key or cached JWKS.
    *   Enforce a fail-closed behavior by default for gateway connection errors.

---

### [CRITICAL] Autogenerating Grace Period for Invalid or Missing Licenses
*   **Where**: `src/core/command_authorizer.py` (L522-544, L370-387)
*   **Description**:
    When `authorize_command` determines that a local license check fails, it checks if the client is currently within a grace period. If not, it registers a 1-hour grace period for invalid licenses using `self._enter_grace_period(GRACE_PERIOD_INVALID_LICENSE)` and returns `allowed=False`.
    Because `_enter_grace_period` immediately writes the state to the KV client as a valid grace window, any subsequent command execution finds `in_grace=True` and is allowed to run.
    *   **Attack Vector**: A user with an invalid, expired, or missing license runs a command once, which fails and registers a grace state. The user then immediately runs the same command again (or any other command) within 1 hour, and the CLI allows execution. This represents a complete bypass of the licensing check.
*   **Action Items / Recommendation**:
    *   A grace period must only be entered if there was a previously validated, unexpired license that has suddenly gone offline (verified through secure metadata).
    *   Do not autogenerate a grace period on direct invalid/missing license validation results.

---

### [CRITICAL] Discarding and Bypassing API Key Secrets
*   **Where**: `src/core/api_key_manager.py` (L316-333, L88-92, L565) and `src/core/gateway_api.py` (X-API-Key validation at L37-41)
*   **Description**:
    API key validation and storage are broken in two ways:
    1.  **Validation Bypass**: In `ApiKeyManager.validate_key`, the key secret is only checked if the caller explicitly supplies it (`if key_secret:`). If the secret is omitted (None or empty), the check is skipped and the key is deemed valid. In `gateway_api.py`, the CLI validates incoming requests via `validate_api_key(api_key)` passing the header `X-API-Key` to the first parameter (`key_id`), with no secret passed. Thus, the gateway approves any request knowing only the public key ID.
    2.  **Data Loss**: During API key persistence in `_save_all_keys`, keys are serialized via `to_public_dict()`, which explicitly deletes the `key_secret`. Consequently, the key secret is never stored on disk. When loaded, it resolves to `""`, making cryptographic HMAC validation impossible even if it were enabled.
*   **Action Items / Recommendation**:
    *   Store encrypted or hashed representations of key secrets on disk (do not strip them during save operations).
    *   Require the API key to be passed in a combined format (e.g. `key_id.key_secret`) and split them before validation.
    *   Enforce a mandatory secret verification check in `validate_key` rather than skipping it if `key_secret` is None.

---

### [IMPORTANT] Command Injection Sanitizer Bypass via Newline / Carriage Return
*   **Where**: `src/core/command_sanitizer.py` (L45-74) and `src/security/command_sanitizer.py` (DANGEROUS_PATTERNS)
*   **Description**:
    The command sanitizers in both `src/core/` and `src/security/` use blocklist regexes to detect command separation (e.g., `;`, `&&`, `||`, `|`). However, Unix shells can also separate commands using newline (`\n`) or carriage return (`\r`) characters.
    *   **Attack Vector**: An attacker can inject a payload containing a newline (e.g., `echo "hello"\ncat /etc/passwd`). Because newlines are not caught by the regex blacklist, the command is marked safe and is executed directly in shell/subprocess environments.
*   **Action Items / Recommendation**:
    *   Add `\r` and `\n` to the command separator regex blacklist in both core and security sanitizers.
    *   Prefer parameterization over raw shell string execution where possible.

---

### [IMPORTANT] Insecure Defaults in Command Sanitizer strict_mode
*   **Where**: `src/core/command_sanitizer.py` (L100) and `src/core/executor.py` (L368)
*   **Description**:
    The default value for `strict_mode` in the `CommandSanitizer` constructor is `False`. 
    When the class is instantiated inside `executor.py:L368` via `sanitizer = CommandSanitizer()`, it runs in non-strict mode. This allows suspicious commands (e.g., `eval`, `exec`) to execute, outputting only warnings instead of blocking them.
*   **Action Items / Recommendation**:
    *   Default `strict_mode` to `True` in `CommandSanitizer`.
    *   Explicitly pass `strict_mode=True` when instantiating the sanitizer inside `executor.py`.

---

### [IMPORTANT] Plaintext Credential Exposure in Session Cache
*   **Where**: `src/core/auth_session.py` (L63) and `src/core/auth_types.py` (L165-177)
*   **Description**:
    The `SessionManager` persists session metadata to `~/.mekong/session.json` using raw `json.dump`. 
    The serialized `SessionCache` structure contains the sensitive `license_key` and `refresh_token` in plaintext. Any local process or malicious user reading the home directory can steal these credentials.
*   **Action Items / Recommendation**:
    *   Store sensitive session credentials (license keys, tokens) inside secure OS credential stores (e.g. macOS Keychain, Windows Credential Manager, Linux Secret Service) using the existing secure storage backend.
    *   If using file storage, encrypt the file contents using a machine-bound symmetric key.

---

### [MODERATE] Insecure File Creation and Permissive Directory Permissions
*   **Where**: `src/core/auth_session.py` (L71) and `src/core/api_key_manager.py` (L567)
*   **Description**:
    In both session cache and API key managers, files are written using the standard `open(..., "w")` function. 
    This creates files with permissions governed by the default system `umask` (commonly `0o644` or `0o666`), exposing the data to other users before subsequent `chmod` calls can lock down permissions. In the case of `_save_all_keys`, no `os.chmod` call is made at all, leaving the file insecurely exposed.
*   **Action Items / Recommendation**:
    *   Create files using secure file descriptors with `os.open` specifying `mode=0o600`.
    *   Explicitly configure files to be owner-only readable on creation.

---

## 2. Test Verification Baseline

The unit and security tests were run on the `mekong-cli` repository to establish the baseline:
*   **Auth Module Tests**: `poetry run pytest tests/auth/`
    *   Result: **138 PASSED** (0.77 seconds)
*   **JWT Security & Route Tests**: `poetry run pytest tests/test_auth_jwt_security.py tests/test_auth_routes.py tests/test_api_auth_routes.py tests/test_oauth2_providers.py`
    *   Result: **143 PASSED** (1.31 seconds)
*   **RBAC Policy Tests**: `poetry run pytest tests/test_rbac.py`
    *   Result: **93 PASSED** (0.61 seconds)
*   **Command Sanitizer Security Tests**: `poetry run pytest tests/test_command_sanitizer_security.py`
    *   Result: **75 PASSED** (0.29 seconds)
*   **Core Key/Authorizer Tests**: `poetry run pytest tests/auth/test_jwt_secret_required.py tests/core/test_api_key_manager.py tests/core/test_command_authorizer.py`
    *   Result: **96 PASSED** (0.97 seconds)

*Observation*: The current test suites pass successfully because they do not simulate gateway connection failures during forged JWT input, nor do they check for multiline injections or verify that key secrets are preserved across restarts.

---

## 3. General Review Observations

### Quality & Code Completeness
*   **Attestation Generator Security Facade**: The script `src/security/attestation_generator.py` generates a signed JSON document. However, its "signature" is merely a SHA256 checksum of the canonical JSON string. It lacks cryptographic security (e.g. asymmetric signature), making it a self-certifying attestation facade.
*   **Misleading Test Names**: In `tests/test_rbac.py`, `test_viewer_can_view_billing` asserts that `Role.OWNER` can view billing, which is logically correct but named confusingly.

### Overall Security Status
The presence of critical bypasses in license verification, API key authentication, and command sanitization poses severe risks to deployments using this CLI. A complete overhaul of JWT validation, API key storage, and grace period logic is highly recommended before deploying the engine in any multi-tenant or untrusted environments.
