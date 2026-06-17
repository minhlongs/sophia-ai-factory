# Commit Signing Guide

## Overview

All commits to the `main` branch must be **GPG-signed** to ensure supply-chain integrity and non-repudiation.

This guide covers:
- Generating a GPG key
- Configuring Git
- Signing commits
- Troubleshooting
- Emergency bypass procedures

---

## 1. Generate GPG Key (One-Time Setup)

```bash
# Generate new GPG key (RSA 4096, no expiry)
gpg --full-generate-key
```

**Interactive prompts:**
- **Key type:** `RSA and RSA` (default)
- **Key size:** `4096`
- **Expiry:** `0` (no expiry) or specify a date
- **Real name:** Your full name (e.g., `Long Tho`)
- **Email:** Your email (must match git config `user.email`)
- **Comment:** (optional)
- **Passphrase:** Choose a strong passphrase (you'll enter it for each commit)

---

## 2. List and Get Your Key ID

```bash
# List secret keys
gpg --list-secret-keys --keyid-format LONG
```

Example output:
```
/Users/you/.gnupg/secring.gpg
------------------------------------
sec   rsa4096/ABC12345DEF67890 2025-01-01 [SC]
      Key fingerprint = 1234 5678 90AB CDEF 1234  5678 90AB CDEF 1234 56
uid                 [ultimate] Your Name <you@example.com>
```

Copy the **key ID** (the part after `rsa4096/`, e.g., `ABC12345DEF67890`).

---

## 3. Configure Git

```bash
# Set your signing key globally
git config --global user.signingkey ABC12345DEF67890

# Enable automatic signing for all commits
git config --global commit.gpgsign true

# Optional: specify gpg executable (macOS often uses gpg2)
git config --global gpg.program gpg2
```

Verify configuration:
```bash
git config --global --get user.signingkey   # should print your key ID
git config --global --get commit.gpgsign   # should print "true"
```

---

## 4. Test Your Setup

```bash
# Create a test commit
echo "test" > test-signed-commit.txt
git add test-signed-commit.txt
git commit -S -m "test signed commit"

# Verify the signature
git log --show-signature -1
```

Expected output includes:
```
gpg: Good signature from "Your Name <you@example.com>"
```

If you see `Good signature` — you're ready.

---

## 5. Add Your Public Key to GitHub (Optional but Recommended)

This allows GitHub to display "Verified" badges on your commits.

```bash
# Export your public key (ASCII armored)
gpg --armor --export ABC12345DEF67890
```

Copy the entire output (including `-----BEGIN PGP PUBLIC KEY BLOCK-----` and `-----END PGP PUBLIC KEY BLOCK-----`).

**Add to GitHub:**
1. Go to GitHub → Settings → SSH and GPG keys
2. Click "New GPG key"
3. Paste the ASCII-armored key
4. Click "Add GPG key"

---

## 6. Existing Commits — Back-signing (Optional)

If you have existing commits on `main` that are not signed, you can rewrite history to add signatures **only if** you are the sole contributor or have team agreement.

```bash
# Interactive rebase of last N commits
git rebase -i HEAD~5  # or more

# For each commit, change "pick" to "edit", then:
git commit --amend -S --no-edit
git rebase --continue
```

**WARNING:** Rewriting public history requires force push and coordination with all collaborators. Only do this on a feature branch or with explicit team approval.

---

## 7. Troubleshooting

### "gpg: signing failed: No secret key"
- The key ID you configured does not exist in your secret keyring.
- Run `gpg --list-secret-keys` to confirm your private key exists.
- If missing, you may need to import from backup or generate a new key.

### "gpg: keyserver receive failed"
On macOS, GPG may not be properly installed. Install via Homebrew:
```bash
brew install gnupg
```

### "gpg: can't open '/dev/tty': No such device"
Running inside a CI environment? GPG needs a TTY. For CI, use `gpg --batch --yes` with a key stored in `GNUPGHOME`.

### Commit hangs waiting for passphrase
If you don't want to type passphrase for every commit, use `gpg-agent` with caching:

```bash
# Start gpg-agent if not running (macOS)
gpgconf --launch gpg-agent

# Set cache timeout (default 10 minutes)
echo "default-cache-ttl 3600" >> ~/.gnupg/gpg-agent.conf
echo "max-cache-ttl 7200" >> ~/.gnupg/gpg-agent.conf
killall gpg-agent
```

### Multiple GPG keys
If you have multiple keys, ensure the correct one is selected:
```bash
git config --global user.signingkey <your-key-id>
```

---

## 8. Emergency Bypass

If you must push without signature (hotfix scenario) and the pre-push hook blocks:

**Option A: Bypass the hook**
```bash
git push origin main --no-verify
```
Use sparingly — document the reason in the commit message or PR description.

**Option B: Deploy bypass**
If deploy-time signature check fails:
```bash
SKIP_SIGNATURE_CHECK=1 npm run deploy:full
```
Log the bypass reason in the deploy output. Re-sign the commit and re-deploy as soon as possible.

---

## 9. CI/CD Integration

The deploy script (`scripts/deploy-with-sha.sh`) also verifies commit signatures before allowing production deployment. This enforces supply-chain integrity at the operator level.

Pre-push and deploy both run:
```bash
node scripts/supply-chain/verify-signed-commits.mjs
```

The script checks that all commits on `main` since `origin/main` have a valid GPG signature (status G, U, X, Y, or R are accepted).

---

## 10. Key Rotation

To rotate your GPG key:

1. Generate a new key (repeat step 1)
2. Add the new public key to GitHub
3. Update local Git config:
   ```bash
   git config --global user.signingkey <new-key-id>
   ```
4. (Optional) Revoke the old key:
   ```bash
   gpg --gen-revoke <old-key-id>
   ```

---

## 11. References

- Git documentation: `git help commit` (search for `--gpg-sign`)
- GPG manual: `man gpg`
- GitHub docs: [Signing commits](https://docs.github.com/en/authentication/managing-commit-signature-verification)

---

## Quick Reference

| Task | Command |
|------|---------|
| Generate key | `gpg --full-generate-key` |
| List keys | `gpg --list-secret-keys --keyid-format LONG` |
| Export public key | `gpg --armor --export <key-id>` |
| Configure Git | `git config --global user.signingkey <key-id>`<br>`git config --global commit.gpgsign true` |
| Sign a commit | `git commit -S -m "msg"` (if auto-sign disabled) |
| Verify signature | `git log --show-signature` |
| Enable auto-sign | `git config --global commit.gpgsign true` |
