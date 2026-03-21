# Module E — Hive Scheduler Spec

> Status: Draft
> Owner: Greyfield
> Type: Architecture / Module Spec
> Goal: Introduce a hierarchical, evolvable multi-agent task scheduling system that fits the existing Greyfield spine without forcing a second adaptation of memory, context, and execution layers.

---

## 1. One-line Positioning

Hive Scheduler makes Greyfield evolve from a single continuous persona runtime into a **single-shell, multi-agent, hierarchical swarm operating system**.

Externally, the user still talks to one persona.
Internally, the system operates as an evolving swarm society with:

* hierarchy
* task decomposition
* host-based execution
* promotion / demotion
* assimilation of external best practices
* survival-of-the-fittest selection

---

## 2. Design Goals

### 2.1 Primary Goals

1. Preserve Greyfield's single-persona user experience.
2. Add multi-agent and multi-task execution without breaking the current spine.
3. Make task execution thread-aware and session-aware.
4. Allow specialized agents to collaborate under a strict hierarchy.
5. Support future evolution through external pattern assimilation and internal mutation.
6. Avoid large-scale second adaptation by fixing memory/context interfaces up front.

### 2.2 Non-Goals (Current Phase)

1. Full autonomous long-term memory extraction.
2. Full vector retrieval pipeline.
3. Fully distributed cluster scheduler.
4. Fully dynamic unrestricted agent society.
5. Product-complete visual dashboard.
6. General-purpose workflow engine for arbitrary enterprise automation.

---

## 3. Core Design Principle

### 3.1 Single Shell, Internal Swarm

Greyfield must present **one external identity**.
All internal coordination, conflict, retries, and task competition remain inside the swarm.

The user sees:

* one persona
* one conversation thread
* one coherent working style

The system contains:

* one Overmind
* multiple Subminds
* multiple Hive Bases
* multiple Hosts
* multiple Units and Drones

### 3.2 Interface First, Capability Later

Full memory is **not a hard implementation prerequisite**.
But memory scope definitions and Context Packet interfaces are **hard design prerequisites**.

Implementation can be phased.
Interfaces must be fixed now.

### 3.3 Evolution Through Selection

Hive Scheduler is not a static org chart.
It is an evolving society.
The system must support:

* external pattern intake
* internal mutation
* trial execution
* metric-based selection
* promotion / demotion
* extinction of inferior strategies

---

## 4. System Model

```text
Persona Shell
  -> Context Runtime
    -> Overmind
      -> Subminds
        -> Hive Bases
          -> Hosts
            -> Units
              -> Drones

Evolution Layer
  -> Gene Intake
  -> Trial Broods
  -> Selection Engine
  -> Genome Registry
  -> Extinction Ledger
```

---

## 5. Entity Hierarchy

## 5.1 Persona Shell

The only user-facing identity layer.

Responsibilities:

* receive user input
* deliver user-visible responses
* maintain persona consistency
* translate swarm progress into user-facing narration
* hide internal scheduling complexity

Constraints:

* must not own global task truth
* must not directly schedule work
* must not directly read raw memory stores

## 5.2 Overmind

The global swarm controller.

Responsibilities:

* understand user intent in thread context
* decide whether new work should spawn
* decompose work into swarm-compatible units
* assign work to Subminds / Hive Bases
* arbitrate cross-domain conflicts
* control promotion / demotion policies
* approve assimilation and extinction decisions

Constraints:

* single active authority per thread
* all task truth ultimately resolves here

## 5.3 Submind

A domain-level controller beneath the Overmind.

Examples:

* Code Submind
* Research Submind
* Desktop Submind
* Memory Submind
* Review Submind

Responsibilities:

* maintain local blackboard for a domain
* manage Hosts within a domain
* transform high-level goals into executable BroodTasks
* coordinate retries, reviews, and rollbacks in-domain
* report domain metrics upward

## 5.4 Hive Base

A persistent work context container.

A Hive Base may correspond to:

* a long-running thread
* an epic
* a project workstream
* a domain-specific working nest

Responsibilities:

* store objective and done-when
* keep active work state
* hold artifact references
* maintain local rules and status
* track pending and blocked tasks
* record evolution and promotion history relevant to the hive

## 5.5 Host

An execution environment carrier.

Examples:

* Browser Host
* Desktop Host
* Code Host
* Research Host
* File Host

Responsibilities:

* keep environment-specific execution context
* bind tools, handles, windows, files, and working dirs
* host continuous action chains
* provide local rollback / retry boundaries

## 5.6 Unit

A reusable specialist capable of handling a short sequence of related work.

Examples:

* Scout
* Builder
* Operator
* Verifier
* Scribe

Responsibilities:

* execute bounded procedures
* call tools under Host constraints
* emit structured status updates

## 5.7 Drone

The smallest schedulable execution instance.

Properties:

* short-lived
* replaceable
* parallelizable
* interruptible
* low-authority

Responsibilities:

* perform atomic tasks
* report progress
* emit artifacts or observations

---

## 6. Levels and Evolutionary Rank

The system uses explicit capability levels.

### L0 — Drone

Can execute atomic work only.

Examples:

* click a UI element
* search a page
* summarize one source
* generate one file
* run one command

### L1 — Unit

Can execute a bounded SOP.

Examples:

* search and summarize several sources
* write and test a patch
* navigate and finish a simple operation chain

### L2 — Host Specialist

Can manage one host-bound work area.

Examples:

* maintain local state
* spawn several L0/L1 workers
* retry and rollback
* enforce host rules

### L3 — Submind

Can govern a domain-level workstream.

Examples:

* assign tasks inside a domain
* maintain domain blackboard
* resolve local conflicts
* produce domain reports

### L4 — Overmind

Global truth and global scheduling authority.

---

## 7. Promotion / Demotion

Rank is not permanent.
Rank must be earned and can be lost.

### 7.1 Promotion Signals

An entity may be promoted when it consistently outperforms higher-ranked peers in a stable domain.

Core metrics:

* throughput
* success rate
* review pass rate
* rework rate
* tool efficiency
* recovery ability
* context retention quality
* handoff quality

### 7.2 Demotion Signals

An entity may be demoted when it becomes inefficient or destabilizing.

Demotion triggers:

* repeated review failure
* excessive cost with weak output
* unstable context handling
* repeated tool misuse
* poor recovery performance
* rising rework burden on other agents

### 7.3 Promotion Constraints

Promotion must:

* be logged
* be scoped to a domain when necessary
* be reversible
* not break thread continuity

---

## 8. Task Model

## 8.1 Why Task Is Not Enough

A generic task abstraction is insufficient for a swarm society.
Hive Scheduler needs a richer schedulable object that understands:

* hierarchy
* required rank
* host binding
* promotion relevance
* review gates
* dependencies

## 8.2 BroodTask

BroodTask is the core schedulable unit.

```ts
interface BroodTask {
  brood_id: string
  thread_id: string
  session_id?: string
  hive_base_id?: string
  parent_brood_id?: string
  goal: string
  executor_level_required: "L0" | "L1" | "L2" | "L3" | "L4"
  preferred_species?: string
  domain?: "code" | "research" | "desktop" | "memory" | "review" | "file" | "general"
  host_binding?: string
  depends_on?: string[]
  priority?: number
  budget_tokens?: number
  budget_time_ms?: number
  risk_level?: "low" | "medium" | "high"
  review_gate?: "none" | "light" | "strict"
  promotion_weight?: number
  state: "queued" | "ready" | "running" | "blocked" | "review" | "done" | "failed" | "aborted"
}
```

## 8.3 BroodTask Rules

1. Every BroodTask belongs to a thread.
2. A BroodTask may bind to a session but must survive session turnover through handoff.
3. A BroodTask may bind to a Host when environment continuity matters.
4. High-risk BroodTasks must pass review.
5. Promotion-significant BroodTasks carry higher promotion weight.

---

## 9. Memory and Context Requirements

## 9.1 Decision

Full long-term memory is **not a hard implementation blocker**.
But the following are **mandatory design prerequisites**:

* fixed Context Packet shape
* fixed memory scopes
* fixed handoff digest structure
* single memory access path through runtime / provider interface

## 9.2 Context Packet

All swarm entities must consume context through a unified packet.

```ts
interface ContextPacket {
  persona: PersonaContext
  vision?: VisionContext
  thread?: ThreadContext
  session?: SessionContext
  handoff?: HandoffDigest
  retrieved?: RetrievedMemory[]
  user_input: UserInputContext
}
```

## 9.3 Memory Scopes

The system must distinguish at least five scopes.

### Identity Memory

Persona rules, style, stable identity constraints.

### Thread Memory

Long-running objective continuity for a conversation or workstream.

Examples:

* project goal
* key decisions
* open questions
* active brood tasks
* important artifacts

### Session Memory

Active working memory for the current run.

Examples:

* recent steps
* current state
* temporary observations
* active host state

### Handoff Memory

Cross-session continuation data.

Examples:

* unfinished items
* next action
* blockers
* risk notes
* short digest of current situation

### Retrieved Memory

Optional recalled memory for future phases.

Examples:

* lessons
* SOP fragments
* historical patterns
* vector-retrieved snippets

## 9.4 Memory Access Rule

No Overmind, Submind, Host, Unit, or Drone may directly access the raw memory store.
They must consume memory through:

* Context Runtime
* Memory Provider
* Hive Context Adapter

This prevents second adaptation when storage backends evolve.

## 9.5 Mandatory Early Memory Work

The following must exist before broad Hive execution:

* ContextPacket type
* MemoryScope enum
* HandoffDigest type
* minimal session memory
* minimal thread summary
* minimal handoff write/read

## 9.6 Deferred Memory Work

The following are explicitly deferred:

* full vector retrieval
* automatic long-term extraction
* aggressive autonomous memory mutation
* unrestricted shared global memory

---

## 10. Handoff

Handoff is required once work can span sessions or multiple active BroodTasks.

### 10.1 HandoffDigest

```ts
interface HandoffDigest {
  thread_id: string
  session_id: string
  summary: string
  unfinished_items: string[]
  blocked_items?: string[]
  active_brood_ids?: string[]
  risks?: string[]
  resume_suggestion?: string
  host_state_refs?: string[]
}
```

### 10.2 Handoff Rules

1. Every interrupted or closed session should attempt to produce a HandoffDigest.
2. Hive Scheduler must be able to resume from handoff without rebuilding state from scratch.
3. Handoff quality should count toward promotion signals for responsible entities.

---

## 11. Scheduling Model

## 11.1 Scheduler Objective

Schedule swarm work to maximize:

* continuity
* throughput
* quality
* recoverability
* cost efficiency
* persona coherence

## 11.2 Scheduling Inputs

Inputs include:

* current Context Packet
* active Hive Base state
* BroodTask DAG
* host availability
* domain load
* review backlog
* budget constraints
* promotion / demotion status

## 11.3 Scheduling Principles

1. User-focused thread work has priority.
2. Dependency-ready tasks outrank blocked tasks.
3. Lower-risk, faster feedback tasks should often surface early.
4. Host continuity matters when tools and environments are stateful.
5. Review should be mandatory only when warranted.
6. Idle or failing branches should be pruned quickly.

## 11.4 Suggested Priority Function

```text
score =
  user_focus *
  thread_hotness *
  dependency_readiness *
  agent_fit *
  budget_efficiency *
  risk_inverse
```

## 11.5 Review Gates

Review is required for:

* code modification
* file mutation with side effects
* risky automation
* expensive actions
* uncertain conclusions with downstream consequences

Review modes:

* none
* light
* strict

---

## 12. Blackboard and Channel Model

Channels are not chat rooms.
They are state panels for swarm coordination.

## 12.1 Hive Channel

One per Hive Base.

Contains:

* objective
* done-when
* active BroodTasks
* status
* artifacts
* risks
* evolution notes

## 12.2 Host Channel

One per Host.

Contains:

* environment state
* tool handles
* operation logs
* retries / rollbacks
* failures

## 12.3 Promotion Ledger

Tracks:

* promotions
* demotions
* domain rank changes
* rationale
* survival scores

## 12.4 Event Types

Minimum required event families:

* `brood.spawned`
* `brood.ready`
* `brood.started`
* `brood.blocked`
* `brood.review_requested`
* `brood.completed`
* `brood.failed`
* `host.bound`
* `host.released`
* `entity.promoted`
* `entity.demoted`
* `gene.candidate_ingested`
* `gene.trial_started`
* `gene.adopted`
* `gene.extinct`

---

## 13. Evolution Layer

Hive Scheduler must not be a closed society.
It must evolve by taking in useful patterns from outside and selecting among internal variants.

## 13.1 Evolution Stages

```text
Intake -> Isolation -> Trial -> Selection -> Adoption or Extinction
```

## 13.2 External Assimilation

The system may ingest useful structures from:

* open-source projects
* internal experiments
* high-performing workflows
* better review or scheduling patterns

The system does **not** ingest external code blindly.
It ingests candidate genes as reusable patterns.

Examples of genes:

* scheduling strategies
* workflow patterns
* review gates
* memory structures
* coordination protocols
* host lifecycle rules

## 13.3 Internal Mutation

The system may generate endogenous improvements when:

* a lower-rank entity consistently outperforms expectations
* a host forms a more robust recovery pattern
* a submind produces better decomposition strategies
* a reviewer develops a higher-value review heuristic

---

## 14. Evolution Data Structures

## 14.1 GeneCandidate

```ts
interface GeneCandidate {
  gene_id: string
  source_type: "external" | "internal"
  source_ref?: string
  domain: "scheduler" | "memory" | "review" | "host" | "worker" | "coordination"
  hypothesis: string
  expected_gain?: string
  risk_level?: "low" | "medium" | "high"
  trial_status: "draft" | "isolated" | "trialing" | "accepted" | "rejected"
}
```

## 14.2 TrialBrood

```ts
interface TrialBrood {
  trial_id: string
  gene_id: string
  control_group: string[]
  experiment_group: string[]
  evaluation_window: string
  metrics: string[]
  state: "planned" | "running" | "completed" | "aborted"
}
```

## 14.3 SelectionReport

```ts
interface SelectionReport {
  trial_id: string
  throughput_delta?: number
  cost_delta?: number
  failure_delta?: number
  review_pass_delta?: number
  user_value_delta?: number
  decision: "adopt" | "reject" | "retry"
  rationale: string
}
```

## 14.4 GenomeRegistry

```ts
interface GenomeRegistry {
  gene_id: string
  origin: "external" | "internal"
  adoption_scope: "global" | "domain" | "host" | "experimental"
  supersedes?: string[]
  version: string
  survival_score?: number
  state: "active" | "deprecated" | "extinct"
}
```

## 14.5 Extinction Ledger

Tracks removed or deprecated genes, species, workflows, or authority patterns.

Purpose:

* avoid reintroducing failed patterns blindly
* keep an audit trail of evolutionary decisions
* preserve learning without preserving low-performing behavior

---

## 15. Selection and Extinction Rules

## 15.1 What Competes

The system may let these compete:

* scheduler policies
* decomposition strategies
* review heuristics
* host lifecycle rules
* worker templates
* coordination patterns

## 15.2 What Gets Eliminated

Three levels of elimination exist.

### Individual Elimination

Disable or demote a weak worker / host specialist.

### Lineage Elimination

Remove an entire strategy family or workflow lineage.

### Gene Elimination

Deprecate or extinct a once-useful gene that no longer fits current system scale.

## 15.3 Selection Criteria

Selection should consider:

* throughput gain
* cost reduction
* failure reduction
* recovery improvement
* review burden reduction
* user-facing coherence
* context pollution reduction

---

## 16. Integration With Existing Greyfield Spine

## 16.1 Position in Spine

Hive Scheduler is a new module that attaches to the existing architecture rather than rewriting it.

Integration path:

* Persona Shell remains the external shell
* Context Runtime remains the context entry point
* Decision Runtime grows Overmind and Submind orchestration
* Execution Runtime hosts Hosts, Units, Drones, and Scheduler hooks
* Persistence Layer stores thread/session/handoff/artifacts/ledgers

## 16.2 Hard Dependencies

These must be in place before broad Hive execution:

1. Context Packet shape
2. Thread / session semantics
3. Minimal handoff mechanism
4. BroodTask model
5. Host abstraction
6. Memory access interface boundary

## 16.3 Soft Dependencies

These improve quality but are not blockers:

1. full review system
2. rich metrics pipeline
3. advanced scheduler scoring
4. domain-specific Submind specialization
5. Genome Registry UI

## 16.4 Postponed Dependencies

These are explicitly postponed:

1. vector memory retrieval
2. automatic long-term lesson extraction
3. massive fully parallel task swarms
4. unrestricted self-modification
5. generalized enterprise workflow compatibility

---

## 17. Phase Plan

## Phase E0 — Interface Lock

Scope:

* define ContextPacket
* define MemoryScope
* define HandoffDigest
* define BroodTask
* define Host abstraction
* define ledger interfaces

Output:

* stable type definitions
* module boundaries
* no heavy implementation required

## Phase E1 — Minimal Memory and Swarm Foundation

Scope:

* session memory
* thread summary
* handoff write/read
* Overmind skeleton
* one Submind
* one Host type
* basic BroodTask lifecycle

Output:

* one thread can sustain limited swarm work across sessions

## Phase E2 — Multi-Host Execution

Scope:

* more Host types
* more Unit/Drone species
* review gates
* host channels
* priority scheduling

Output:

* multiple bounded workstreams per thread

## Phase E3 — Evolution Layer

Scope:

* GeneCandidate
* TrialBrood
* SelectionReport
* GenomeRegistry
* promotion / demotion metrics
* extinction rules

Output:

* measurable adaptation of swarm behavior

## Phase E4 — Retrieval and Long-term Memory Upgrades

Scope:

* retrieved memory
* SQLite / structured persistence upgrades
* optional vector search
* lessons / SOP integration

Output:

* deeper continuity without breaking prior interfaces

---

## 18. Minimal Acceptance Criteria

A first acceptable version of Module E should demonstrate:

1. one external persona with internal swarm coordination
2. one Overmind managing at least one Submind
3. one Hive Base bound to one thread
4. one Host carrying continuous environment state
5. BroodTask creation, scheduling, execution, and completion
6. minimal session memory and handoff
7. promotion / demotion ledger placeholders
8. gene candidate ingestion placeholder
9. no direct raw memory access by swarm entities

---

## 19. Open Questions

1. Should promotion be global or domain-local by default?
2. How much host state should survive across sessions?
3. Should one thread always map to exactly one active Overmind instance?
4. How aggressive should automatic extinction be in early phases?
5. How should external gene ingestion be reviewed for safety and compatibility?

---

## 20. Final Rule Set

1. The user speaks to one persona, not a committee.
2. The swarm may be hierarchical, but hierarchy must remain auditable.
3. No rank exists without ongoing demonstrated value.
4. No gene is privileged by origin; only real performance matters.
5. Memory implementation can lag, but memory interfaces cannot.
6. Evolution without records is forbidden.
7. Selection without metrics is forbidden.
8. Hive Scheduler must strengthen the spine, not replace it.
