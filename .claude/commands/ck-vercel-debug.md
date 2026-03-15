# /vercel-debug - Vercel CI/CD Debugging Workflow (GLOBAL)

## ⚠️ CRITICAL RULE - NEVER FORGET ⚠️

**WHEN SENDING INPUT TO CC CLI VIA `send_command_input`:**

```
Input MUST ALWAYS end with \n (newline character)
```

**WRONG:**

```json
{ "Input": "yes, commit and push please" } // ❌ NO ENTER = COMMAND HANGS
```

**CORRECT:**

```json
{ "Input": "yes, commit and push please\n" } // ✅ HAS \n = COMMAND EXECUTES
```

---

## Workflow Steps

// turbo-all

### 1. Check Vercel Status

```bash
vercel ls --yes 2>&1 | head -20
```

### 2. If any deployment shows ERROR

```bash
vercel inspect <deployment-url> 2>&1
vercel logs <deployment-url> 2>&1 | tail -100
```

### 3. Fix Errors Locally

- Read error message carefully
- Fix the issue in source code
- Test locally: `npm run build`

### 4. Redeploy

```bash
vercel --prod --yes
```

### 5. VERIFICATION LOOP (MANDATORY)

**DO NOT STOP until:**

- [ ] `vercel ls` shows "Ready" status
- [ ] Build logs show no errors
- [ ] Live site loads successfully
- [ ] All console errors cleared

### 6. Only After 100% Green

- Commit changes
- Push to remote
- Re-verify deployment

---

## CC CLI Input Rule Checklist

Before EVERY `send_command_input` call, verify:

- [ ] Input ends with `\n`
- [ ] WaitMs is appropriate (60000 for long operations)
- [ ] SafeToAutoRun is set correctly

---

## Error Recovery Loop

```
while deployment_status != "Ready":
    1. Get error logs
    2. Fix locally
    3. Build locally
    4. Redeploy
    5. Check status
```
