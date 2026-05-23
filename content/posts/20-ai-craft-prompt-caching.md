---
title: "I Found a Way to Make AI 90% Cheaper. It Requires Making Your Prompts Worse."
date: 2026-05-27T09:00:00-07:00
category: "geek"
series: "ai-craft"
draft: false
---

![A banana excitedly stuffing a huge stack of documents into a filing cabinet labeled CACHE 90% OFF while smaller documents labeled context quality quietly fall out the back](/images/prompt-caching-banana.png)

Prompt caching is, in theory, free money. 💰

You send the same large context to the API repeatedly. The API caches the stable prefix. Subsequent requests that match the cached prefix get a significant discount — around 10% of normal input token cost for a cache hit versus full price for a miss. The math is obvious. Send the same system prompt a hundred times, pay for it once. What's not to like.

The implementation is not obvious. And the path I took trying to make it work produced a lesson I should have seen coming but didn't.

## What Prompt Caching Is (and Isn't)

Claude's prompt caching works by caching a prefix of the input tokens. If a subsequent request shares that exact prefix, the provider detects the cache hit and charges a fraction of the normal input token cost. The prefix has to be stable — any change to it invalidates the cache. New request, full price.

There's a constraint in the documentation that's easy to miss: **the cached prefix must meet a minimum token threshold**. Depending on the model, this is roughly 1024 to 2048 tokens. Below that threshold, caching simply doesn't activate. The request goes through at full price regardless of whether you've marked the prefix as cacheable.

I read this, understood it, and then proceeded to not think about it again for several weeks. 🙃

## Why This Bit Me

Most of the AI calls in my FinBot workflow are short. Targeted, task-specific calls: "Here is the `score_ticker` function. This is the error message. Find the bug." The system prompt for these calls covers coding guidelines — naming conventions, exception handling rules, logging standards — and comes out to maybe 200 tokens. Add a few hundred tokens of code context, and the total is well under 1000 tokens.

Caching was enabled. The model supports it. I had set the relevant parameters in the API client. And caching was doing exactly nothing, because none of these calls were long enough to hit the threshold.

This isn't a bug. The API was behaving correctly. But "behaving correctly" and "doing what I assumed" are two different claims, and I had been operating on the assumption that caching was saving me money on the majority of my API calls. I hadn't verified that assumption. I had just assumed it because I had enabled the feature.

<div style="background:#fff7ed;border-left:4px solid #f97316;padding:0.9rem 1.2rem;margin:1.5rem 0;border-radius:0 6px 6px 0;">
⚠️ <strong>The reality check:</strong> When I finally looked at the actual cache hit metrics, the hit rate for operational calls was <strong>zero</strong>. The cache miss rate was <strong>100%</strong>. I had been paying full price for every single one while believing I was getting a discount. Caching was enabled. The model supports it. It was doing exactly nothing.
</div>

## Fix Attempt 1: Restructure the Long Calls

The correct application of prompt caching is to front-load your stable, reusable content so that the cached prefix is substantive. For design and analysis sessions — where I'm walking through the full project architecture, describing the feature list, explaining the evaluation framework, and asking the model to reason about a structural decision — the system prompt can be written to include all of that context explicitly, in stable form, at the top.

I restructured the prompts for these sessions. A system prompt that includes the full project architecture description, the model's current feature inventory, the evaluation framework overview, and the complete coding standards comes out around 3000 to 4000 tokens — well above the threshold. The stable prefix is genuinely stable: it doesn't change between calls in the same session and barely changes between sessions on the same project.

<div style="background:#f0fdf4;border-left:4px solid #22c55e;padding:0.9rem 1.2rem;margin:1.5rem 0;border-radius:0 6px 6px 0;">
✅ <strong>This part worked:</strong> Cache hit rate for design and analysis sessions after restructuring: ~70%. Cost dropped significantly. If your prompt is long and naturally stable, caching is genuinely free money. The optimization is clean because the context is real.
</div>

The operational calls were still a problem.

## Fix Attempt 2: Padding

For the short calls — "find the bug," "refactor this function," "does this test cover this edge case" — the stable prefix was still too short. The real content of those prompts is inherently brief. Options:

1. Accept no caching for short calls, since they're cheap anyway
2. Restructure them to include more real, task-relevant context that happens to be stable
3. Add content to hit the threshold — what I will charitably call "strategic padding" and less charitably call what it actually was

I tried option 3. And this is where it gets interesting.

The obvious content to pad with: documentation, coding standards, example patterns, reference implementations. Content that's real, plausibly relevant, and stable across calls. I added an 800-token block of coding standards and annotated example functions to the system prompt for operational calls. Total prompt length: past the threshold. Cache hit rate: improving. Cost: down.

I felt clever for about two days. 😅

## Why Padding Hurts Quality

A language model reads everything you give it. There is no "background" context. Every token is part of the input the model generates from.

When you add 800 tokens of coding standards and annotated examples to a "find the bug in this function" prompt, the model reads those examples — and then it *responds* to them. The bug fix is correct. The output is noisier than you asked for.

**The specific failure modes I kept hitting:**

| What I padded with | What the model did | What I actually asked for |
|---|---|---|
| Well-documented example functions | Added docstrings to every function it touched | Bug fix |
| Examples with clean separation of concerns | Fixed the bug + suggested a full refactor | Bug fix |
| Verbose example responses | Returned verbose responses | Short diff |

The model wasn't wrong. It was attending to all the context provided and generating output consistent with that context. The context was just wrong for the task.

## The Actual Tradeoff

Here it is plainly, because I spent too long not thinking about it plainly:

| Option | Savings | Quality Impact | Use It? |
|---|---|---|---|
| **No caching (short calls)** | None — full price | Optimal | Yes — short calls are cheap anyway |
| **Cache long natural prompts** | Significant (~90% on hits) | None | Yes — this is the correct use |
| **Pad short prompts to hit threshold** | Moderate | Subtly degraded | No — quality cost outweighs savings |
| **Restructure with real stable context** | Moderate | Maintained | Yes — if real stable context exists |

The long natural prompt case: correct use, clean results, works exactly as advertised.

The padding case: the savings are real. The quality cost is also real, and it's the kind of cost that's easy to miss because the output is still usually *correct* — it just doesn't match the codebase.

The padding temptation is real because it looks like a free optimization. You're not making anything up — these are real coding standards, real examples, real documentation. You're just including them in prompts where they're not needed. That feels like a low-cost way to hit a threshold.

It isn't free.

<div style="background:#fef2f2;border-left:4px solid #ef4444;padding:0.9rem 1.2rem;margin:1.5rem 0;border-radius:0 6px 6px 0;">
🚨 <strong>This is the part that bites you:</strong> Every token you add to a prompt is a token the model acts on. There is no such thing as "ignored" context. The model read your 800-token padding block. It responded to it.
</div>

## What "Quality Degradation" Actually Looks Like

Making this concrete, because "subtle quality degradation" is easy to dismiss as hypothetical:

- **Unsolicited docstrings** — function edits added docstrings not present in any surrounding function. Not wrong, just inconsistent with a codebase where functions are undocumented by convention. A diff that should show a bug fix also showed an unexplained style divergence.
- **Unsolicited refactoring suggestions** — bug fixes included reorganization suggestions with code snippets, following patterns from the padding. The fixes were correct. The suggestions were noise in code review.
- **Brief outputs became long outputs** — padded prompts that included verbose examples produced verbose responses. A "fix this function" request that should return a ten-line diff started returning the fix plus commentary, structured the same way the examples were.

None of these broke anything. They were slightly wrong in a way that compounded — in code review, in codebase consistency, in the overhead of reading and filtering output. The cost was diffuse and easy to rationalize away, which is the exact category of cost that tends to accumulate without anyone formally deciding to accept it.

## What's Running Now

- Short operational calls with under 500 tokens of real content: no caching, full price, clean prompts — they're cheap enough that the math on caching them doesn't justify the quality risk
- Design and analysis sessions with long natural context: caching enabled, 3000 to 4000 token stable prefix, approximately 70% hit rate — this is the right use of the feature and the savings are real
- Padding: explicitly not used — the quality cost outweighs the savings, and the threshold exists for a reason
- Cache hit and miss rates: logged per session type after each run, so assumptions about what caching is actually doing get verified rather than assumed
- Rule added to CLAUDE.md: prompt padding to hit the caching threshold is prohibited; if a prompt is short, either accept no caching or add real context that belongs there

<div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:0.9rem 1.2rem;margin:1.5rem 0;border-radius:0 6px 6px 0;">
🔑 <strong>The lesson that keeps coming back:</strong> The optimization that changes your input changes your output. Padding is not neutral. It's instructions you didn't mean to give. This is not a new lesson. It keeps needing to be relearned.
</div>

*Note: Second post in the ai-craft series. [The first post is here.](/posts/19-ai-craft-three-assistants/)*
