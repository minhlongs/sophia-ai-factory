# Tier 1 Power Source Analysis

**Date**: 2026-01-30
**Status**: CAPTURED & ANALYZED
**Phase**: 2 (Tier 1 Integration)

## 1. SuperClaude Framework
**Origin**: `SuperClaude-Org/SuperClaude_Framework`
**Type**: Cognitive Architecture / Framework
**Binh Pháp**: Ch.1 始計 (Initial Estimates)

### Capabilities
- **PM Agent**: Implements a "Confidence Checker" (pre-execution), "Self Check Protocol" (post-implementation), and "Reflexion Pattern" (error learning).
- **Parallel Execution**: Uses a "Wave → Checkpoint → Wave" pattern for 3.5x faster execution.
- **Slash Commands**: Adds 27+ commands like `/pm`, `/research`, `/index-repo`.
- **Git Worktree Support**: Explicit support for parallel development using git worktrees.

### Strategic Value for AgencyOS
- **Confidence Protocol**: We should adopt the 90% confidence rule before execution to save tokens.
- **Parallel Pattern**: The "Wave" pattern fits perfectly with our Orchestrator Protocol.
- **Knowledge Base**: The `KNOWLEDGE.md` and `PLANNING.md` structure mirrors our own but with different emphasis.

### Integration Action
- Extract `pm_agent` patterns (Confidence, Self-Check, Reflexion) and implement as AgencyOS Skills.
- Adopt the "Wave" parallel execution model for the `orchestrator` agent.

---

## 2. Zen MCP Server
**Origin**: `zenml-io/mcp-zenml`
**Type**: Infrastructure / Orchestration
**Binh Pháp**: Ch.7 軍爭 (Military Combat)

### Capabilities
- **Orchestration**: Connects LLMs to ZenML pipelines (Stacks, Components, Pipelines, Runs).
- **Analytics**: Tracks tool usage and error rates (good for monitoring our own agents).
- **FastMCP**: Uses the `fastmcp` framework for efficient server implementation.
- **Lazy Loading**: Initializes heavy clients only when needed.

### Strategic Value for AgencyOS
- **Pipeline Control**: Gives our agents the ability to control MLOps pipelines, effectively allowing them to "build the factory" that builds them.
- **FastMCP Pattern**: A good reference for building our own high-performance MCP servers.

### Integration Action
- Study `server/zenml_server.py` for FastMCP best practices.
- Consider deploying this server to give agents control over model training pipelines in Phase 4.

---

## 3. Repomix
**Origin**: `yamadashy/repomix`
**Type**: Intelligence Gathering / Packaging
**Binh Pháp**: Ch.13 用間 (Use of Spies)

### Capabilities
- **Context Packing**: Packs entire codebases into XML/Markdown for LLM consumption.
- **Security**: Built-in security checks to exclude secrets.
- **Token Counting**: Integrated Tiktoken support.
- **MCP Integration**: Has its own MCP server to pack codebases on-the-fly.

### Strategic Value for AgencyOS
- **Context Injection**: Allows agents to "read" entire external repos instantly without cloning them locally if we use the remote fetch capability.
- **Standardization**: Provides a standard format for "shipping" context between agents.

### Integration Action
- Use Repomix as the standard tool for the `researcher` agent when analyzing external codebases.
- Integrate Repomix MCP server into the default agent toolset.

---

## 4. OpenCode
**Origin**: `opencode-ai/opencode`
**Type**: Operational / Interface
**Binh Pháp**: Ch.6 虛實 (Weak Points and Strong)

### Capabilities
- **TUI**: Go-based Terminal User Interface (Bubble Tea).
- **Session Management**: SQLite-based session storage.
- **LSP Integration**: Direct Language Server Protocol support for code intelligence.
- **Ultrawork**: A mode for high-focus, high-speed coding (implied by "OpenCode" vs "Claude Code").

### Strategic Value for AgencyOS
- **Interface**: Provides a blueprint for a potential TUI for Mekong CLI.
- **LSP**: Shows how to integrate "real" code intelligence (Go to Definition, Find References) into agent workflows, which is currently a gap (we rely on grep/read).

### Integration Action
- Analyze `internal/llm/agent` to see how they handle tool execution compared to `claudekit`.
- Study LSP integration for future "Language Server Skill".

---

## Summary
Tier 1 sources provide the **Cognitive** (SuperClaude), **Infrastructure** (ZenML), **Input** (Repomix), and **Interface** (OpenCode) layers required for a self-improving agency.

**Next Step**: Activate Phase 3 (Tier 2 Integration) to capture specialized capabilities.
