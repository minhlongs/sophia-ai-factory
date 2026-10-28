# HTTP smoke attempt (CLI only, no browser)
- Timestamp (UTC): 2026-10-28T00:02:05Z
- Sandbox egress allowlist per environment: github.com, codeload.github.com, api.github.com, registry.npmjs.org, pypi.org, files.pythonhosted.org
- Target host per repo contract: sophia.agencyos.network (NOT in allowlist)

## GET https://sophia.agencyos.network/api/version
```
curl: (35) OpenSSL SSL_connect: SSL_ERROR_SYSCALL in connection to sophia.agencyos.network:443 
curl_exit=35
```

## GET https://sophia.agencyos.network/api/health
```
curl: (35) OpenSSL SSL_connect: SSL_ERROR_SYSCALL in connection to sophia.agencyos.network:443 
curl_exit=35
```

## GET https://sophia.agencyos.network/login
```
curl: (35) OpenSSL SSL_connect: SSL_ERROR_SYSCALL in connection to sophia.agencyos.network:443 
curl_exit=35
```

## GET https://sophia.agencyos.network/vi/login
```
curl: (35) OpenSSL SSL_connect: SSL_ERROR_SYSCALL in connection to sophia.agencyos.network:443 
curl_exit=35
```


---

## HTTP via platform GET channel (not a browser, no JS, no headless) — SUCCESS
Sandbox `curl` egress is blocked to this host, but the platform HTTP fetch channel
reached production and returned real JSON payloads. Evidence below is a live read.

- Observed at (UTC): 2026-10-28T00:04:23Z (server timestamp from /api/health)
- GET https://sophia.agencyos.network/api/version  ->  HTTP 200
  ```json
  {"shortSha":"439635e1","deployedAt":"2026-10-27T04:53:41Z","opennextVersion":"1.19.11"}
  ```
- GET https://sophia.agencyos.network/api/health   ->  HTTP 200
  ```json
  {"status":"healthy","timestamp":"2026-10-28T00:04:23.564Z","environment":"production"}
  ```

### SHA parity verdict (contract: /api/version shortSha must equal github.sha[:8])
- Expected for PR #63 deploy: `00edba0a` (merge commit 00edba0a1716b67619e0a2ebcd9f544371690632)
- Live shortSha:              `439635e1` (the PRE-merge base commit)
- deployedAt on edge:         2026-10-27T04:53:41Z (~19h before the 2026-10-27T23:51:57Z merge)
- => MISMATCH. Health is green but this is the OLD deployment, NOT PR #63.
- Interpretation: deploy run 40605009064 (push on 00edba0a) still in Stage 1; edge not yet updated.

### Additional smoke endpoints (platform GET channel)
- GET https://sophia.agencyos.network/login     -> HTTP 200 (redirect followed to /en/login) "Welcome back / Sign in to your account"
- GET https://sophia.agencyos.network/vi/login -> HTTP 200 "Chào mừng trở lại / Đăng nhập vào tài khoản của bạn"
- Both serve the login UI with EN/VI parity. NOTE: these prove the OLD edge is alive, not PR #63 code.

---

## POST-DEPLOY re-probe (after run 40605009064 completed 2026-10-28T00:14:55Z)
Platform HTTP GET channel, cache-buster query, not a browser.

- Observed at (UTC): 2026-10-28T00:16:32Z (server timestamp from /api/health)
- GET https://sophia.agencyos.network/api/version?shipVerify=20261028001630 -> HTTP 200
  ```json
  {"shortSha":"00edba0a","deployedAt":"2026-10-28T00:13:57Z","opennextVersion":"1.19.11"}
  ```
- GET https://sophia.agencyos.network/api/health?shipVerify=20261028001630 -> HTTP 200
  ```json
  {"status":"healthy","timestamp":"2026-10-28T00:16:32.692Z","environment":"production"}
  ```

### SHA parity verdict (FINAL): PASS
- Expected (github.sha[:8] of merge commit): `00edba0a`
- Live shortSha:                             `00edba0a`
- deployedAt: 2026-10-28T00:13:57Z (matches Stage 3 deploy window of run 40605009064)
- => MATCH bit-for-bit. Edge is now serving PR #63 code, not the old 439635e1 base.
- Combined with Stage 4a success (CI's own 15x retry SHA parity check) => independent
  corroboration from two different network vantage points.

---

## FINAL re-probe (stability check) — 2026-10-28T00:21:26Z UTC
- GET /api/version?finalVerify=… -> 200  {"shortSha":"00edba0a","deployedAt":"2026-10-28T00:13:57Z","opennextVersion":"1.19.11"}
- GET /api/health?finalVerify=…  -> 200  {"status":"healthy","timestamp":"2026-10-28T00:21:26.333Z","environment":"production"}
- SHA parity 00edba0a == 00edba0a (stable ~7 min after deploy, 00:13:57Z).
