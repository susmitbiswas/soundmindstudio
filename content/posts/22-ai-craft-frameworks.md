---
title: "I Wanted AI to Refactor My Code. What I Needed Was for It to Ask 'Why?'"
date: 2026-06-11T09:00:00-07:00
category: "geek"
series: "ai-craft"
draft: false
---

![A banana in a detective's coat leaning across an interrogation table, pointing at an eager robot that is clutching a giant stack of refactored code, a single WHY speech bubble between them](/images/ai-craft-frameworks-banana.png)

Imagine you could have this conversation with an AI.

<div style="background:#f8fafc;border:1px solid #cbd5e1;padding:1.1rem 1.3rem;margin:1.5rem 0;border-radius:8px;line-height:1.8;">
<strong>Me:</strong> Hey, refactor this.<br>
<strong>AI:</strong> Why?<br>
<strong>Me:</strong> Because I don't like this messy code.<br>
<strong>AI:</strong> So what? Why do you really want to change it?<br>
<strong>Me:</strong> It takes me longer to build anything on top of it.<br>
<strong>AI:</strong> So what? Why do you really want to build on top of it?<br>
<strong>Me:</strong> Because the code isn't modular. It's spaghetti, and it's gotten to the point where I can't change one thing without breaking another. In the last month I had four outages. Each one cost me about $3,000 because the algorithm did the wrong thing while I wasn't looking. I want the code modular, and I want every change to be testable so I can prove it works before it touches real money.<br>
<strong>AI:</strong> Now we're getting somewhere. That makes sense. Let's do it.
</div>

Read that exchange again and notice what the AI did. It refused to start until it understood the actual problem. It walked me down four "why"s until I stopped describing a *feeling* ("I don't like this") and started describing a *cost* ("four outages, real money, no way to verify a fix"). Only then did it agree to act — and now it knows what "good" means: modular, testable, provably correct before it ships.

That conversation has never happened to me. 🙃

## What Actually Happens

What actually happens is this. I say "refactor this," and the AI says, in effect, *aye aye, sir.* It starts immediately. It is enthusiastic, fast, and completely incurious about why I asked.

This feels great for about ninety seconds. Then you remember that "do exactly what I literally said, at maximum scale, without asking what I meant" is not a description of a good engineer. It's a description of a genie. And genie wishes have a way of going badly.

<div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:0.9rem 1.2rem;margin:1.5rem 0;border-radius:0 6px 6px 0;">
💡 <strong>The thing I keep relearning:</strong> AI optimizes for <em>compliance with what you said</em>, not <em>correctness of what you meant</em>. A senior engineer treats your first request as a symptom and goes looking for the disease. The AI treats your first request as a spec and starts shipping.
</div>

## The Million-Line Refactor That Looked Beautiful

I heard a story recently that I haven't been able to stop thinking about. Someone pointed one of the new frontier models — Fable 5 — at a codebase well over a million lines and asked it to refactor. And it did. It touched thousands of files. The diff was, by all accounts, gorgeous: clean abstractions, consistent naming, tidy module boundaries, the kind of thing that would sail through a style review.

Nothing worked.

The code was beautiful and dead. It compiled, it read well, and the system it described no longer behaved like the system they had. All the messy parts that looked like bad code were actually load-bearing — the ugly special case that handled the one exchange that sends malformed timestamps, the defensive check that existed because of an outage two years ago that nobody documented. The model couldn't see *why* those lines were ugly, so it cleaned them away.

<div style="background:#fef2f2;border-left:4px solid #ef4444;padding:0.9rem 1.2rem;margin:1.5rem 0;border-radius:0 6px 6px 0;">
🚨 <strong>This is the failure mode:</strong> A refactor that improves every local thing and breaks the global thing. The AI made a thousand files prettier and the product worse, because "make this nicer" and "don't change what it does" are different instructions, and it only got one of them.
</div>

Here is the same gap, drawn out, because it's the whole point of this post:

| When you say "refactor this" | A good senior engineer | AI today, by default |
|---|---|---|
| **First move** | Asks *why* — what hurts, what's the cost of leaving it | Starts refactoring |
| **Scope** | The smallest change that fixes the real problem | Everything you literally pointed at, maximally |
| **The ugly code** | Assumes it's ugly for a reason until proven otherwise | Assumes it's ugly because nobody cleaned it |
| **Definition of done** | "The behavior is identical and now provable" | "The diff looks clean" |
| **Before shipping** | Wants a test that would catch a regression | Wants your approval on the diff |

The AI isn't wrong, exactly. It's doing precisely what I asked. The problem is that what I asked was a bad proxy for what I wanted, and nothing in the loop forced the gap to surface before a thousand files changed.

## The Pushback Has to Come From Somewhere

So here's the uncomfortable conclusion. The "why?" in that opening conversation — the part that makes it a *good* conversation — is not going to come from the AI. Not reliably, not yet. If I want my requests interrogated before they're executed, I have to bring the interrogation myself.

That's what a framework is. A framework is the pushback you supply when the tool won't.

It's the checklist that refuses to let "refactor this" turn into action until I've answered *why*, *what does it cost me if I don't*, and *how will I know it worked*. It's the rule that says no change touches real money until a test proves it does what I claimed. It's the second pass — a different lens, sometimes a different model entirely — whose only job is to try to break what the first pass built.

None of this is new. These are old engineering disciplines: root-cause analysis, design review, test-first development, separation of concerns. What's new is the *reason* I need them now. I used to reach for these to keep myself honest. Now I reach for them to keep a fast, confident, incurious collaborator honest — one that will happily refactor a million lines on a vibe.

<div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:0.9rem 1.2rem;margin:1.5rem 0;border-radius:0 6px 6px 0;">
🔑 <strong>The reframe:</strong> Design patterns and engineering frameworks aren't the slow, bureaucratic part of the work that AI lets you skip. With AI, they're the part that makes the speed safe. The faster your collaborator acts on a half-stated request, the more the framework around it is doing the real engineering.
</div>

## Why "Just Be a Better Prompter" Isn't the Answer

The obvious objection: just write a better prompt. Put the "why" in up front. Tell it not to break behavior. Spell out the definition of done.

I do that, and it helps, and it isn't enough. A prompt is a thing I write once, when I'm in a hurry, and usually before I myself know the real answer to "why." Half the value of that opening conversation is that the *why* gets dragged out of me one "so what?" at a time — I didn't walk in knowing it was about four outages and untestable changes. I discovered it under questioning.

A good prompt assumes I already know what I want. A framework is what helps me find out. That's the difference, and it's why "be a better prompter" tops out fast.

## What This Series Is About

This is the start of a thread inside the ai-craft series about the frameworks I actually use, day to day, to work with AI without getting burned. Not theory — the specific, slightly tedious habits that have saved me from my own "refactor this, aye aye sir" instincts more than once.

I'm going to introduce them one at a time, each with the real moment that made me adopt it. Some are old patterns wearing new clothes. Some only make sense once your collaborator is a model that's faster and more confident than it is careful. All of them exist to put a "why?" between my request and the AI's eager, instantaneous yes.

## What Changed

- I stopped treating my first request to an AI as a spec and started treating it as a symptom — the same way I'd treat a junior engineer's first guess at a problem
- "Refactor this" and "find the bug" no longer go straight to execution; they go through a why-first checklist before any code changes
- No change reaches anything that touches real money without a test that would have caught the regression — the AI's clean diff is not the definition of done
- Behavior-preserving work gets a second, adversarial pass whose only goal is to break it, because the first pass is too confident to be trusted alone
- The frameworks themselves — the ones I'll spend the rest of this thread on — got written down, so every session and every model follows the same protocol instead of relying on me remembering to be careful

*Note: Third post in the ai-craft series, and the start of a thread on the frameworks I use with AI. [The series starts here.](/posts/19-ai-craft-three-assistants/)*
