---
title: "I Hired Three AI Assistants. Now I Spend My Morning Managing Them."
date: 2026-05-26T09:00:00-07:00
category: "geek"
series: "ai-craft"
draft: false
---

![A banana in a tiny middle-manager suit directing three robot assistants at separate desks, each robot doing a distinctly different type of work](/images/three-assistants-banana.png)

For a long time, my workflow was simple: have a problem, open Claude, describe the problem, get an answer.

This worked. Claude is good at everything. The code quality was high, the explanations were clear, the refactors were coherent. I was productive. I kept going.

The bill kept growing too. Linearly, at first, which felt fine. Then the project grew — more files, more sessions, more "quick checks" that turned out not to be quick — and the bill grew faster than the project warranted. 💸 I wasn't doing anything wrong exactly. I was just using a $0.30-per-thousand-token model to answer questions that cost a tenth of that to answer.

This morning I finished setting up a routing framework. Three models, each with a defined lane. It took longer to build than I expected, saved more money than I expected, and required more management overhead than I expected. That last part is the part I hadn't planned for.

## The Starting Point: One Model for Everything

When I started building FinBot, the AI spend was negligible. A few sessions per week, mostly exploratory. Claude wrote the first version of the scoring pipeline. Claude helped design the ensemble architecture. Claude debugged the regime detection logic when it started misfiring on low-volatility days.

The spend-per-insight ratio felt fine because the insights were dense. Each session was doing something that actually required the kind of deep context reasoning Claude is good at.

The problem emerged gradually. As the codebase grew, more of my AI interactions stopped being "help me think through this design" and became "where is the function that does X" or "which files import this module" or "show me all the places this config key is used." These are locate tasks. Grep tasks. Symbol lookup tasks.

None of them need Claude. All of them were going to Claude because Claude was the only channel I had open.

<div style="background:#fff7ed;border-left:4px solid #f97316;padding:0.9rem 1.2rem;margin:1.5rem 0;border-radius:0 6px 6px 0;">
⚠️ <strong>The hidden waste:</strong> A typical working session involves a dozen locate operations before a single meaningful implementation block. Moving all of those through a premium model is the AI equivalent of hiring a senior staff engineer to look up a phone number. The per-task cost is small; the frequency makes it expensive.
</div>

## Three Models, Three Lanes

The routing framework I ended up with has three tiers. This is the table I didn't want to build but eventually did build:

| Task type | Model | Why |
|---|---|---|
| Grep / locate / symbol lookup | Codex o4-mini | Cheap, fast, correct for focused tasks |
| Small targeted edits (<100 lines) | Codex o4-mini | Well-defined scope, no cross-file reasoning needed |
| Broad design analysis, tradeoff evaluation | Gemini 2.5 Pro | Thinking budget control, generates multiple approaches |
| Short structured outputs, JSON, summaries | Gemini 2.5 Flash | Overkill to use Pro; Flash is sufficient |
| Multi-file implementation, refactors | Claude Sonnet | Cross-file coherence, long context reasoning |
| Code review, debugging | Claude Sonnet | Holds full context, catches subtle issues |
| Architecture decisions, system design | Claude Opus | Full system reasoning, worth the cost |

The logic behind each lane is simpler than the table makes it look. Locate tasks don't need context windows. Analysis tasks benefit from generated alternatives, which is where Gemini's thinking budget earns its keep. Implementation tasks need a model that can hold a dozen files in mind simultaneously without losing coherence — that's where Claude earns its price.

**Codex o4-mini** handles the high-volume, low-complexity work. Finding where `score_ticker` is defined. Listing all files that import `RegimeDetector`. Writing a small utility function with a well-specified signature. The output is correct, the latency is low, and the cost is a fraction of what the same request costs in Claude.

**Gemini 2.5 Pro with a thinking budget** handles design decisions. When I'm asking "should the tier-two model run before or after the position sizing step, and what are the implications of each," I want a model that will generate both paths, analyze the tradeoffs, and flag the risks I haven't asked about. The thinking budget lets me control how deep this goes — budget 8000 for complex design questions, budget 0 for quick structured outputs where I just need the format right.

**Claude Sonnet** handles implementation. Multi-file refactors. Debugging sessions that require holding the scoring pipeline, the ensemble logic, and the data fetching layer in mind at the same time. Code review where context across the whole change matters. This is where the context window and coherence are genuinely worth what they cost.

**Claude Opus** sits above Sonnet for decisions about the system as a whole — architectural choices where the reasoning needs to traverse the full design. Rare, expensive, appropriate.

## What the Routing Actually Looks Like

In practice, routing is a ten-second decision before spinning up a session. The question is: is this a locate task, an analysis task, or an implementation task?

Most of what felt like "AI work" is actually "find this, then do that" — and the find-this part doesn't need Claude.

A concrete example from last week: I wanted to add volatility regime detection to the scoring pipeline. The request sounds like one task. It's actually three:

1. Find the current scoring entry point and understand how the pipeline feeds into it. That's a locate task. Codex.
2. Decide whether to integrate regime detection as a pre-filter, a score modifier, or a separate signal layer. That's a design task. Gemini.
3. Implement the chosen approach across the relevant files without breaking the existing signal logic. That's an implementation task. Claude.

Before routing, all three of those went to Claude in one long session. After routing, Codex runs the locate pass, the output goes into a Gemini brief for design review, and Claude gets a well-specified implementation prompt with the context already established. Claude's context window is used for synthesis, not for grep.

This matters because the implementation prompt Claude receives is now much shorter and more precise. Less time establishing context means more of the session doing useful work.

## The Overhead Surprise

Here is what the routing framework actually costs: not money, but attention.

Before routing, the workflow was frictionless. Have a question, open Claude, ask it. The cognitive overhead was zero.

After routing, there is a decision step before every session:
1. Is this a locate task, a design task, or an implementation task?
2. Write a brief that fits the chosen model's strengths
3. Verify the output and decide whether to escalate

If Codex can't find what you're looking for, upgrade to Sonnet. If Gemini's analysis is inconclusive, write a tighter brief or bring in Opus.

For a production team with a $5,000/month AI budget and dedicated infrastructure, this overhead is clearly worth it. The math is straightforward.

For a hobbyist running a trading system on nights and weekends, the math is more complicated. The money I'm saving is real but not large in absolute terms. The attention I'm spending is also real, and attention is the actual scarce resource on a project maintained in the gaps between other obligations.

I landed on a rule: only route tasks where the volume is high or the cost differential is significant. Locate operations get routed because they're frequent and the cost gap is 10x. One-off design questions don't get elaborate routing — they go to Gemini or Claude based on a quick read of the question type, without a formal brief process.

The framework is a guide, not a gate. A gate would add more overhead than it saves.

## What Actually Saved the Money

The honest accounting: most of the spend reduction came from a single change.

| Change | 💰 Spend Reduction | Mechanism |
|---|---|---|
| Locate ops → Codex o4-mini | **~35%** | Running grep queries through a 10x cheaper model |
| Structured tasks → Gemini Flash | **~20%** | Flash output for JSON/summaries is identical to Pro-with-thinking |
| Better prompt structure | **Remaining** | Specific briefs use fewer tokens per session |

👉 The 35% from locate ops was the biggest single change — and the simplest. I wasn't doing anything clever. I was just running grep queries through a model that costs 10x more than necessary.

The Gemini 20% came from one insight: **the output of a structured formatting task looks identical whether or not a model spent 8,000 thinking-tokens on it.** Flash vs Pro-with-thinking, for JSON or a short summary, is the same answer at a fraction of the cost.

The rest came from writing tighter prompts — which turned out to be a side effect of routing itself. Writing a brief for Codex forces specificity. That habit carried over to Claude sessions too.

## The Insight About "Best Model"

<div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:0.9rem 1.2rem;margin:1.5rem 0;border-radius:0 6px 6px 0;">
💡 <strong>"Best model" is not a meaningful claim without a task type.</strong> Claude Sonnet is the best model for a 20-file refactor. Codex is the best model for finding a function definition. Flash is the best model for converting a list to JSON. These aren't opinions about which lab makes better AI — they're cost-performance measurements for specific task categories.
</div>

The mistake I made for the first several months was treating "best at the hardest tasks" as equivalent to "best for all tasks." Claude is better than Codex at multi-file reasoning. It doesn't follow that Claude should handle every task — any more than you'd use a torque wrench to hang a picture frame.

<div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:0.9rem 1.2rem;margin:1.5rem 0;border-radius:0 6px 6px 0;">
🔑 <strong>Lesson:</strong> Once you accept that task type determines model choice, the routing table basically writes itself. You look at what you're actually doing, categorize the operations, check the cost-capability profile of each model, and assign. The insight sounds obvious. The implementation takes a week.
</div>

## What I'm Running Now

- Codex o4-mini: grep and locate operations, symbol lookup, targeted edits under 100 lines, well-specified small functions
- Gemini 2.5 Pro (thinking budget 8000): design analysis, tradeoff evaluation, multi-path decisions, adversarial review of design docs
- Gemini 2.5 Flash (thinking budget 0): structured outputs, JSON formatting, short summaries where format matters more than depth
- Claude Sonnet: implementation, multi-file refactors, code review, debugging sessions that require cross-file context
- Claude Opus: architecture decisions, anything requiring full-system reasoning — used sparingly
- Routing rule documented in `CLAUDE.md` so every session, including multi-agent ones, follows the same protocol automatically

---

*Note: This is the first post in a new series — ai-craft — about the experience of building with AI coding assistants. The FinBot series continues separately; this one is about the tools, not the trading system.*
