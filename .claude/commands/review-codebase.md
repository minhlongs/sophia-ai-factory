---
description: Review entire codebase for quality, security, and best practices
---

Perform a comprehensive codebase review:

1. **Lint & TypeScript**: Run linters and type checker, fix all errors
2. **Security**: Check for exposed secrets, unsafe patterns, XSS/CSRF vulnerabilities
3. **Code Quality**: Identify dead code, unused imports, duplicated logic
4. **Test Coverage**: Check test coverage gaps, suggest missing tests
5. **Performance**: Identify N+1 queries, memory leaks, bundle size issues
6. **Architecture**: Review module structure, dependency cycles

Output a prioritized list of findings with severity (CRITICAL/HIGH/MEDIUM/LOW).
Fix all CRITICAL and HIGH issues immediately.
