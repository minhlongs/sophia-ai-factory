# API/Session Recovery

Name: recovery

## Goal

Recover safely after API failure or interrupted loop.

## Steps

- [ ] Stop the broken Claude Code session
- [ ] Run opc health and confirm deep stream passes
- [ ] Run opc recover to reset running/api_failed state
- [ ] Use opc recover --stable if Opus is still unstable
- [ ] Continue from opc tui or opc loop --once
