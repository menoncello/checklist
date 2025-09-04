# Epic 4: Intelligence & Safety

## Goal
Implement intelligent command handling with safety checks, clear differentiation between command types, and seamless shell integration.

## Success Criteria
- ✅ Commands clearly differentiated (Claude vs Bash)
- ✅ Dangerous commands require confirmation
- ✅ Clipboard integration working
- ✅ Shell auto-detection functional
- ✅ Command history and replay working

## Stories
1. [Story 4.1: Command Differentiation System](story-4.1-differentiation.md)
2. [Story 4.2: Command Safety Validation](story-4.2-safety.md)
3. [Story 4.3: Clipboard Integration with Fallbacks](story-4.3-clipboard.md)
4. [Story 4.4: Command Preview with Validation](story-4.4-preview.md)
5. [Story 4.5: Auto-loading Shell Integration](story-4.5-shell.md)
6. [Story 4.6: Command History Recording](story-4.6-history.md)
7. [Story 4.7: History Replay and Undo](story-4.7-replay.md)

## Dependencies
- Epics 1-2 complete
- Core engine and UI functional

## Risk Factors
- 🟡 Clipboard access varies by platform
- 🟡 Shell integration may conflict with user setup
- 🟡 Safety checks could be too restrictive

## Timeline Estimate
**1-2 weeks**

## Definition of Done
- [ ] All command types handled
- [ ] Safety measures in place
- [ ] Clipboard works cross-platform
- [ ] Shell integration optional
- [ ] History fully functional
- [ ] Undo/redo working