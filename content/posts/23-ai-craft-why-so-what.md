---
title: "Two Questions I Make My AI Ask Me: 'Why?' and 'So What?'"
date: 2026-06-11T15:00:00-07:00
category: "geek"
series: "ai-craft"
draft: false
---

![A banana in a factory-floor supervisor's vest holding two signs, one reading WHY and one reading SO WHAT, standing in front of a robot that is sheepishly lowering an oversized wrench, an assembly line of bananas in the background](/images/why-so-what-banana.png)

Last time I argued that the "why?" you want from an AI isn't going to come from the AI. You have to supply it. A few people asked the obvious follow-up: *fine — how?*

So here are the two questions I actually use. They're old, they're boring, and they have saved me from myself more times than I'd like to admit. One is **"Why?"** The other is **"So what?"** Between them they catch most of the work that looks important and isn't, and most of the bugs that look shallow and aren't.

## Framework One: "Why?" (Five Times)

The 5 Whys came off the Toyota factory floor — Sakichi Toyoda's idea, baked into the Toyota Production System and popularized by Taiichi Ohno. The premise is almost insultingly simple: when something breaks, ask "why?", then ask "why?" of the answer, and keep going. The first answer is almost never the real one. It's a symptom wearing the costume of a cause.

People ask why *five*. Why not three, why not ten? It's not a law — it's a heuristic. Empirically, the causal chain usually bottoms out around the fifth question. Fewer and you stop at a symptom; many more and you've usually already hit the root and are now just philosophizing. Five is where the chain tends to reach something you can actually fix.

<div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:0.9rem 1.2rem;margin:1.5rem 0;border-radius:0 6px 6px 0;">
💡 <strong>If 5 Whys feels familiar, it should:</strong> it's chain-of-thought for incidents. You're forcing a reasoning chain instead of jumping to the answer — each link has to follow from the last. The same discipline that makes a model reason better step-by-step makes a human debug better step-by-step.
</div>

Here's a real one. My trading system runs a streaming service and a Telegram bot on a Mac at home. One evening both started dying with the same error: **"Anthropic key not found."** The obvious read is "the API key is wrong." That's where most debugging stops. Here's where the whys went instead:

| | Question | Answer |
|---|---|---|
| **Why 1** | Why is the key missing? | `get_secret` returned an empty string — it catches *every* exception and quietly returns a default. |
| **Why 2** | Why did the keychain lookup fail at 17:36 when it worked at 17:33? | macOS had locked the keychain. |
| **Why 3** | Why did the keychain lock right then? | The screen locked — there's a Touch ID event logged at 17:30:01. |
| **Why 4** | Why did the screen lock mid-run? | I locked my Mac and walked away, while an unattended training job was still running. |
| **Why 5** | Why did this cascade instead of recovering? | The watchdog respawned the failing process every five minutes with no backoff and no alert that the *cause* was environmental. |

The error said "bad API key." The actual root cause was **"I locked my laptop."** Four questions stood between the symptom and the truth, and every fix I'd have written at Why 1 — rotate the key, re-check the env var, add a retry — would have been useless, because none of them were the problem.

<div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:0.9rem 1.2rem;margin:1.5rem 0;border-radius:0 6px 6px 0;">
🔑 <strong>The point of the chain:</strong> the fix you'd write after Why 1 and the fix you'd write after Why 5 are different fixes. Stopping early doesn't just cost you elegance — it costs you the *correct* change. The bug here wasn't the key. It was a silent except, a watchdog with no backoff, and no alert that distinguished "the world changed" from "the code is broken."
</div>

## Framework Two: "So What?" (The Smell Test)

The 5 Whys interrogates a problem. "So what?" interrogates a *plan*.

It works like this. I say: *I want to do this.* Better: *I did this.* And the question that should immediately follow is — **so what?** What changes because you did it? And then the demand that makes the test sharp:

<div style="background:#f0fdf4;border-left:4px solid #22c55e;padding:0.9rem 1.2rem;margin:1.5rem 0;border-radius:0 6px 6px 0;">
✅ <strong>The rule:</strong> if you can translate the answer into a dollar figure — wonderful. If you can translate it into another <em>provable</em> metric — good. If you can't translate it into anything measurable at all — that's the smell. The work might not be worth doing.
</div>

"So what" is what turns *"I don't like this messy code"* — a feeling — into *"this code caused four outages and a real loss"* — a number. It's the same move the AI made in the opening dialogue of the last post, dragging me from a preference down to a cost.

The example that taught me to respect it: a single position in the trading system dropped sharply one morning and I took a four-figure loss — roughly the price of a decent used car — on one trade. The surface story was "the market moved against me, that happens." Apply "so what" honestly and it doesn't survive:

| Claim | So what? | Verdict |
|---|---|---|
| "The market moved against me." | So what? There was supposed to be a 2% stop-loss at the level it blew through. | 🚩 Doesn't hold |
| "I have a stop-loss monitor." | So what? Did it fire? The ledger shows realized P&L of zero — it never triggered. | 🚩 Doesn't hold |
| "The monitor runs every 60 seconds." | So what? It read a null price, silently skipped, and the daily-loss halt didn't survive midnight. | ✅ *Now* we have the real work |

The loss wasn't bad luck. It was a measurable, preventable gap — and "so what" is what forced it from a shrug into a dollar figure attached to two specific bugs. A feature that *should* have saved that money provably didn't, and the metric proved it.

<div style="background:#fff7ed;border-left:4px solid #f97316;padding:0.9rem 1.2rem;margin:1.5rem 0;border-radius:0 6px 6px 0;">
⚠️ <strong>Where "so what" bites hardest:</strong> not on bugs — on <em>features</em>. "I want to add a dashboard." So what? "I want to refactor this module." So what? If the honest answer is "it would feel nicer," you've just saved yourself a week. Most of the work "so what" kills is work that was never going to matter, dressed up as work that does.
</div>

## How the Two Fit Together

They're a front end and a back end for the same instinct — *don't act until the action is justified.*

| | 5 Whys | So What |
|---|---|---|
| **Aims at** | A problem that already happened | A plan you're about to execute |
| **Direction** | Backward — symptom to root cause | Forward — action to measurable impact |
| **Fails when** | You stop at the first plausible answer | You can't name a dollar or a provable metric |
| **Gives you** | The *correct* fix, not the convenient one | Permission to do the work — or to skip it |

## The Part Where AI Comes In

Here's the move that ties this back to the last post. You don't have to ask these questions yourself, by hand, every time. You can make your AI ask them *for* you.

In my global `CLAUDE.md` — the standing instructions every session inherits — the very first step of the workflow is: **use 5 Whys to find root cause before writing any solution. Do not propose a fix until you understand why the problem exists.** And the assistant is told, explicitly, to be a critic: to push back when I ask for something, to ask *why I want this* and *what it costs or buys in measurable terms* before it touches code.

The effect is exactly the conversation I said never happens. I say "refactor this," and instead of "aye aye, sir," I get "why?" — because I configured the why. I say "let's add this," and I get "so what does it buy you?" — because I made the smell test part of the contract. The pushback I complained the tool wouldn't give, it gives, because I wrote it into the standing orders.

<div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:0.9rem 1.2rem;margin:1.5rem 0;border-radius:0 6px 6px 0;">
🔑 <strong>The whole trick:</strong> an AI won't bring judgment on its own, but it will faithfully apply judgment you've written down. "Be my critic. Ask why five times before you fix anything. Ask 'so what' before you build anything, and make me answer in dollars or a metric." That's three sentences in a config file, and it changes every session after it.
</div>

## What Changed

- The first step before any fix is now a 5 Whys chain, not a patch — stopping at the first plausible cause is treated as an unfinished diagnosis, not a fix
- Every proposed feature or refactor has to pass "so what?" — answerable in a dollar figure or a provable metric, or it doesn't get built
- Both questions are written into my global `CLAUDE.md`, so every AI session starts as a critic that pushes back before it acts, instead of an order-taker
- The silent-except, the no-backoff watchdog, and the stop-loss that read a null price and skipped are fixed — but the durable change is the habit that surfaced them, not the individual patches
- "I don't like this" and "the market moved against me" are no longer accepted as reasons by me *or* the assistant — both get interrogated until they become a cost or get dropped

*Note: Fourth post in the ai-craft series, and a direct follow-up to ["the why AI won't ask."](/posts/22-ai-craft-frameworks/) [The series starts here.](/posts/19-ai-craft-three-assistants/)*
