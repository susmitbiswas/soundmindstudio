---
title: "I've Been Testing in Prod With Real Money. On Purpose. By Accident."
date: 2026-03-28T08:00:00-07:00
category: "geek"
draft: false
---

![A banana scientist running experiments — but the lab is on fire](/images/testing-in-prod.png)

Here's a confession that would get me fired from my own code review.

For the past several weeks, every improvement I've made to FinBot — every new model, every weight tweak, every exit strategy overhaul — has been deployed directly into production. And by "production," I mean my actual brokerage account. With actual money. The kind you can spend at grocery stores.

At work, I have spent *years* building and enforcing experimentation frameworks. A/B testing. Shadow deployments. Canary releases. Staged rollouts with automatic rollback. I have given talks about this. I have blocked PRs that didn't have proper feature flags. I have, on more than one occasion, used the phrase "testing in production is not a strategy" with the kind of quiet authority that makes junior engineers nod solemnly.

And then I went home, opened my personal project, and yolo'd ML models directly onto my life savings.

The cognitive dissonance is genuinely impressive. I'm like a fire safety inspector who goes home and juggles lit torches over a pile of oily rags. "It's different when it's my house," I apparently told myself, while deploying untested exit logic to a system that moves thousands of dollars before breakfast.

## The Moment It Clicked

It took the [Thursday crash](/posts/08-finbot-crash-postmortem/) to shake this loose. Not because the crash itself was caused by a lack of testing — it was caused by exit strategies that weren't firing. But the postmortem surfaced a deeper problem: I had no mechanism for knowing whether a change was *better* before I made it live. Every deployment was an implicit bet that my latest idea was an improvement. The only feedback loop was my portfolio balance, and by the time that told me something useful, the tuition had already been paid.

This is the exact anti-pattern I lecture people about. Test in staging. Validate with data. Promote only when confident. I know this. I *teach* this. I just... forgot to apply it to myself.

(Engineers are excellent at building sophisticated systems to protect against everyone's blind spots except their own.)

## The Experimentation Framework

So I built the thing I should have built first.

The A/B testing framework sits alongside the live trading system and does what any proper experimentation system does: it runs *variants* in parallel, measures them against the same reality, and only promotes a challenger when the numbers justify it.

Here's what it does:

Every experiment gets registered with a hypothesis, a baseline configuration, and one or more challenger variants. Each variant is a complete parameter set — signal weights, model selection, position sizing rules, entry/exit thresholds. The challenger variants paper-trade alongside the live system: same market data, same stock universe, same schedule, different decisions. A simulated trader takes each variant's picks and runs them through realistic execution — stop losses, profit targets, position sizing — and tracks full P&L per variant per day.

At the end of a two-to-three week observation period, I compare the results. If a challenger consistently outperforms on the metrics that matter — predictive accuracy, consistency, risk-adjusted returns — it gets promoted. If not, it gets archived with dignity.

The key design decision: the experiment engine calls the *exact same scoring code* as the production system. It doesn't reimplement anything. The only thing that changes between variants is the configuration — which knobs are set to which values. This eliminates the most dangerous failure mode in experimentation: the one where your experiment says "Model B is 12% better" and then you deploy Model B and it behaves differently because the experiment environment was subtly different from production. Same code, same data, same timing. The only variable is the thing you're actually testing.

This is not revolutionary. This is how every serious engineering organization runs experiments. The only thing unusual about it is that I managed to build an entire ML-powered trading system *before* building this, which is the engineering equivalent of installing a turbocharger before checking whether the car has brakes.

## Futures: Paper Trading From Day One

Here's where the lesson gets applied in real time — and where I'm entering genuinely unfamiliar territory.

I have never traded futures. Not once. Not a single contract. I know equities. I've spent ~~months~~ weeks (probably few days of development effort at best given this is my side project) building systems around them, measuring signals, getting burned, iterating. But futures — the leverage, the contract mechanics, the margin requirements, the fact that they trade nearly 24 hours — all of this is new to me. I am, for the first time in this project, a complete beginner.

Which is exactly why this time I'm doing it right.

I've started building a futures advisory system — analysis and trade setups for E-mini S&P 500 (ES) and E-mini Nasdaq (NQ) contracts. And unlike every previous feature I've added to FinBot, I'm starting with paper trading. Not "I'll add paper trading later." Not "I'll just run a few live trades to see if the signals make sense." Paper trading *first*. As a design requirement. Written down in the spec. Because the version of me who skipped this step with equities has been *thoroughly* discredited by recent events.

The futures system is advisory-only. It doesn't execute trades. It tells me what it sees — regime, bias, key levels, setups — and I decide whether to act on it. When I do trade, I report the position back to the system via Telegram (`/futures buy MES 5420`), and it tracks P&L, monitors position health, and tells me when my stops should fire or when the setup thesis has been invalidated.

But here's the part I'm most excited about: **every suggestion comes with a rationale.** The system doesn't just say "go long MES at 5420." It explains *why* — what the regime looks like, what the key technical levels are, what the sentiment picture suggests, why this particular setup was identified. It's not just an advisory system. It's a teaching system.

This is where I have to pause and appreciate the age we're living in. I'm building a system that teaches me futures trading *while* I learn futures trading, using AI to accelerate both the development and the education simultaneously. The AI helps me write the code. The code helps me understand the market. The market teaches me what the code got wrong. And then the AI helps me fix it. It's a feedback loop of accelerated learning that simply wasn't possible a few years ago.

I'm not just learning faster — I'm learning *differently*. Instead of reading a textbook about support and resistance and then trying to apply it months later, I'm implementing the concept in code, watching it identify levels in real data, and then paper-trading against those levels to build intuition. The gap between theory and practice has collapsed to nearly zero. The system explains every setup like a patient tutor, and I get to test my understanding immediately in a sandbox where the only thing at risk is my ego.

The architecture reuses shared infrastructure from the equity engine — the same regime detection, the same sentiment monitoring, the same market data pipeline. Same code, different application. A crisis regime means the system won't suggest long setups. The sentiment layer that watches stock headlines now also watches macro sentiment. Code reuse strikes again: I didn't have to build these capabilities twice, just point them at different instruments.

The futures-specific pieces are new: key level identification, multi-signal bias scoring, and a setup identifier that looks for trend continuation, pullback entries, and mean-reversion opportunities (gated by regime — no mean reversion in a crisis, because "catching a falling knife" is not a setup, it's a lifestyle choice).

And the learning path is deliberately conservative: start with micro contracts — one-tenth the size of the full contracts — with tight risk limits per trade and per day. I will paper trade for at least two weeks before going live with even a single micro contract. The system will teach me how to operate it before I'm allowed to operate it with real money. That sentence would have sounded absurd to me six months ago. Now it sounds like the most reasonable thing I've ever said.

## What This Is Actually About

At its core, this is about applying the same discipline to personal projects that I'd apply at work. Which sounds obvious when you say it out loud. But there's something about personal projects that makes you cut corners — no code review, no staging environment, no one watching. The feedback is just your own results, and humans are spectacularly good at rationalizing their own results.

The experimentation framework isn't just tooling. It's a forcing function for honesty. It says: "You think this change is better? Prove it. Run both versions. Measure them against the same reality. Show me the numbers." And then it archives the numbers so I can't conveniently forget the experiments that didn't work.

The futures paper trading system isn't just caution. It's the acknowledgment that I have never traded futures in my life, and the responsible thing is to learn in a sandbox before I learn with my savings account. But it's also something more optimistic than that — it's a bet that with the right tools, I can compress months of learning into weeks.

A year ago, learning futures trading would have meant reading books, watching courses, opening a simulator account somewhere, and slowly building intuition through repetition. Today, I'm building the simulator *and* the tutor *and* the risk management system simultaneously, with AI as a collaborator at every step. The system I'm learning from is also the system I'm building. That recursive quality — learning by building the thing that teaches you — is genuinely new, and I am loving every minute of it.

These are not novel insights. Every engineering organization knows this. Every professional trader knows this. I knew this. I just didn't do it until my portfolio politely screamed at me to start.

Better late than expensive. Well — more expensive.

---

*Disclaimer: This is still not financial advice. This is a software engineer confessing to professional malpractice against his own money and then describing the remediation plan. The systems described here are experimental and personal. The experimentation framework exists because the author cannot be trusted to deploy untested changes responsibly. Please consult an actual financial professional before making investment decisions. Especially if you, like me, are prone to forgetting your own best practices.*

**Next up:** The system scored 9.9 out of 10. Now I just have to not break it. [My Trading Bot Scored 9.9 Out of 10. Now It Just Has to Keep Not Blowing Up. →](/posts/10-finbot-the-system-is-the-product/)
