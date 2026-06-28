# Lane Handoff

Name: lane-handoff

## Goal

Review a lane before import or PR.

## Steps

- [ ] Run opc lane check for the lane
- [ ] Fix ownership or verifier failures inside the lane
- [ ] Run opc lane import without --apply
- [ ] Create opc lane handoff evidence
- [ ] Import with --apply only after the dry-run is clean
