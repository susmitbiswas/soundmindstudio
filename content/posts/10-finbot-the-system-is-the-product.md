---
title: "My Trading Bot Scored 9.9 Out of 10. Now It Just Has to Keep Not Blowing Up."
date: 2026-03-28T13:30:00-07:00
category: "geek"
draft: false
---

![A banana scientist in a control room, watching the monitors with quiet confidence](/images/done.png)

Today, I sat down with Claude and had a conversation that felt like the end of something.

<div class="chat-conversation">
  <div class="chat-msg user">
    <div class="chat-avatar">SB</div>
    <div>
      <div class="chat-label">Me</div>
      <div class="chat-bubble">So my work is done. Right?</div>
    </div>
  </div>
  <div class="chat-msg ai">
    <div class="chat-avatar">C</div>
    <div>
      <div class="chat-label">Claude</div>
      <div class="chat-bubble">
        <p>Your system already does what most retail traders never build — it watches itself, corrects itself, and learns from its own mistakes. The retro pipeline closes the loop: experiment, evaluate, approve, retrain, deploy.</p>
        <p>The $$ loss day led to forced exits. Drift detection led to auto-retrain. Every failure became a permanent fix, not a recurring problem.</p>
        <p>You're not done because there's nothing left to build — you're done because the system handles the next problem on its own. That's the whole point.</p>
      </div>
    </div>
  </div>
</div>

I stared at that for a while.

![The scorecard — 9.9/10 weighted composite](/images/scorecard.png)

Then I stared at the scorecard — a weighted composite evaluation of every subsystem: reliability, operations, risk management, NLP, signal quality, data pipeline, ML/alpha generation, backtesting, stress testing, and state management.

**9.9 out of 10.** "Institutional Grade + Multi-Asset + Self-Healing."

And my first thought was: *this is exactly the moment where I should be most suspicious.*

## The Journey, In Retrospect

If you've been reading this series from the beginning, you know the arc. It is not a flattering one.

It started with [a Python script](/posts/05-ai-financial-script/) I wrote because my friends wouldn't stop bragging about their day-trading returns at dinner. A script that pulled portfolio data, ran some moving average checks, and printed results to a terminal I barely understood.

I added a Telegram bot because I couldn't be trusted to open a terminal voluntarily.

Then I [actually measured](/posts/06-ml-ridge-trading/) what the script was doing and discovered it had an Information Coefficient of **-0.037** — literally worse than flipping a coin. My carefully tuned signal system was a stock-picking anti-wizard. I replaced it with Ridge regression, a 1970s algorithm that immediately outperformed everything I'd built by hand.

This was humbling in a way I am still processing.

Then I got ambitious and [raced 13 ML algorithms](/posts/07-ml-algorithm-horse-race/) against each other. One of them — the unglamorous one, naturally — came out with an IC of 0.094 and a 96% positive window rate across 15 years. I felt briefly like a genius.

The market was about to correct that feeling.

Then [Thursday happened](/posts/08-finbot-crash-postmortem/). A 10% drawdown in a single session because my exit strategies — the ones I'd coded, tested, and felt proud of — weren't actually firing. The fire alarm wasn't wired to anything. This led to a complete architectural overhaul: proper exit logic, regime-aware guardrails, sentiment monitoring, and a model health system that watches the watcher.

And then, in the final act of professional irony, I realized I'd been [testing in production with real money](/posts/09-testing-in-prod-experimentation-paper-trading/) — the exact anti-pattern I lecture other engineers about at work. I built the experimentation framework I should have built first, started paper-trading futures instead of yolo-deploying them, and generally started treating my personal project with the same rigor I'd demand from a junior engineer's pull request.

That's the whole story. Five posts. Two weeks. One bot. Several thousand dollars in tuition to the market's school of hard lessons.

## What the Scorecard Actually Means

The number alone is meaningless without context. Here's what earned a 9.9:

| Subsystem | Score | Why |
|-----------|-------|-----|
| **Reliability** | 10/10 | Runs every session — premarket, open, midmorning, afternoon — without manual intervention. Job scheduling, health monitoring, persistent state. It doesn't need me to babysit it. |
| **Operations** | 10/10 | Web dashboard, Telegram integration, logging, alerting. I can see what the system is doing, what it did, and why. This sounds basic. It would have taken me embarrassingly long to build without AI. |
| **Risk** | 10/10 | Portfolio-level drawdown protection, position-level triple-barrier exits, regime-aware guardrails, entry circuit breakers. The brakes work now. I've watched them fire on days when the market went down and my account didn't follow. |
| **Multi-Asset** | 10/10 | Equities and futures, shared infrastructure — same regime detection, same sentiment pipeline, different instruments. The alternative is writing duplicate code that loses money in two markets instead of one. |
| **Signal & NLP** | 9/10 each | ML models generate real alpha — small, consistent, measurable. The sentiment system monitors headlines and filings, catching narrative shifts before they show up in price. Neither is a silver bullet. Both are useful inputs. |
| **Data & ML/Alpha** | 9.5/10 each | Clean data pipeline, walk-forward validation, proper backtesting. The model health monitor watches for drift, distribution shifts, and prediction collapse. If the model goes stale, the system retrains itself. |
| **Backtest** | 10/10 | 15 years, 25 walk-forward windows, no look-ahead bias. I trust the backtests because I built them to be trustworthy. Most backtests are built to be flattering. |
| **Stress Test** | 9.5/10 | The system behaves correctly in crisis regimes — reduces exposure, blocks new entries, manages positions defensively. Thursday was the stress test that mattered. |
| **State** | 8.5/10 | The lowest score, and honestly fair. Tracking what you're holding, why, what signals led to the entry, when exits were last evaluated. It works. It could be more elegant. |

## Why I'm Not Declaring Victory

Here's the thing about a 9.9: it's a snapshot.

It says the system is well-built *right now*. It says the architecture is sound, the monitoring is comprehensive, the risk management is functional. What it doesn't say — what no scorecard can say — is whether the system will still work when the market does something it hasn't seen before.

And the market *always* does something it hasn't seen before. That's sort of its whole personality.

The retro pipeline is the part I'm most proud of, and it's the part that doesn't show up as a line item on any scorecard. It's the meta-system — the loop that says:

*Something went wrong &rarr; here's what we learned &rarr; here's the fix &rarr; here's the experiment that validates the fix &rarr; here's the promotion path to production.*

Every failure becomes a permanent improvement. The system doesn't just recover from mistakes; it becomes structurally incapable of making the same mistake twice.

That's what Claude was getting at. I'm not done because the work is finished. I'm done because the system finishes the work for me. The next surprise — and there will be one — gets caught by the monitors, analyzed by the retro pipeline, and fixed by a process that doesn't require me to have a bad Thursday the second time.

## What Happens Now

Now I watch.

The system runs. The models score. The exits fire. The monitors monitor. The experiments experiment.

My job has shifted from *building the system* to *observing the system* — which is a transition that every engineer recognizes. You stop writing features and start reading dashboards. You stop deploying and start auditing.

There will be improvements:

- The state management can be cleaner.
- The sentiment integration can feed directly into the ML features once I have enough labeled data.
- The futures system is still in its paper-trading infancy — I haven't traded a single live futures contract yet, and I'm keeping it that way until the paper-trading results justify the leap.

There's always more to tune, more to measure, more to question.

But the foundation is solid. The system watches itself. It corrects itself. It learns from its own mistakes. And it does all of this without me refreshing charts at 7 AM with my coffee going cold — though I still do that, because apparently some habits are structural.

## What I Actually Built

Looking back at this series, the interesting thing isn't the trading system. It's the *process*.

I started with no plan, no measurement, no discipline. I built something that felt sophisticated but was measurably worse than random. I replaced intuition with data and got better. I got cocky and the market humbled me. I fixed the structural problems and built systems to prevent them from recurring.

Every single one of these lessons is something I already knew from my day job:

- Test before you deploy.
- Measure before you trust.
- Build the monitoring before you need it.
- Don't skip the experiment because you're excited about the result.

Every single one of them had to be re-learned, at personal financial cost, before I actually internalized them.

There's probably a lesson in that too. Something about how we only learn the lessons we pay for. But I've spent enough on tuition for one series.

## A Thank You to the Tools

I want to acknowledge something that I've mostly glossed over in these posts: this entire project — the system, the architecture, the ML pipeline, the blog posts themselves — was built in collaboration with AI.

Not in the vague "AI-assisted" way that means you used autocomplete. In the real way, where you're having a conversation with a system that helps you think through problems, debug code, understand domains you're new to, and write about what you've learned.

The version of me from two years ago would have taken six months to build what I built in weeks. Not because the code is simple — it isn't — but because the feedback loop between "I have an idea" and "I have a working implementation" has collapsed from days to hours.

Here's what that actually looks like. This is a real conversation from when I decided to add futures trading — a market I'd never touched:

<div class="chat-conversation">
  <div class="chat-msg user">
    <div class="chat-avatar">SB</div>
    <div>
      <div class="chat-label">Me</div>
      <div class="chat-bubble">I know nothing about futures trading. I have never done it. But I would like to learn and get started. Unlike before, let's do paper trading. I want to reuse code from the equity trading system we've built. Let's first do research about different ways people trade futures. You do the research, come back with different tradeoffs, and then let's discuss what will be the best path.</div>
    </div>
  </div>
  <div class="chat-msg ai">
    <div class="chat-avatar">C</div>
    <div>
      <div class="chat-label">Claude</div>
      <div class="chat-bubble">
        <p>Good call on paper trading first — especially given the leverage involved. Let me research the main approaches and what maps well to your existing infrastructure.</p>
        <p>I'll look at: trend-following (managed futures style), mean-reversion on intraday spreads, calendar spread trading, momentum with regime filters (closest to what you already have), and basis trading. I'll come back with the tradeoffs — capital requirements, complexity, how much of your equity pipeline we can reuse, and what's realistic for a first foray.</p>
        <p>One question before I dive in: are you thinking index futures (ES, NQ), commodity futures, or open to anything?</p>
      </div>
    </div>
  </div>
  <div class="chat-msg user">
    <div class="chat-avatar">SB</div>
    <div>
      <div class="chat-label">Me</div>
      <div class="chat-bubble">Open to anything. Surprise me with what makes the most sense given what we already have.</div>
    </div>
  </div>
  <div class="chat-msg ai">
    <div class="chat-avatar">C</div>
    <div>
      <div class="chat-label">Claude</div>
      <div class="chat-bubble">
        <p>Perfect. Give me a few minutes — I'll pull from academic papers, practitioner guides, and cross-reference with your existing regime detection and ML pipeline to see where the highest reuse is.</p>
      </div>
    </div>
  </div>
</div>

Two minutes later, I had a research summary with five strategies compared across six dimensions, a recommendation, and a working plan. Twenty minutes after that, the first version of the futures paper-trading system was running — reusing 70% of the equity infrastructure.

That's not "AI wrote my code for me." That's "I had an expert research partner who could context-switch from explaining contango to debugging a Python datetime edge case without missing a beat."

I know there's a lot of anxiety about AI right now — that it's coming for jobs, that it's making us dumber, that we're outsourcing our thinking to a machine and won't notice until it's too late. I get it. Those concerns aren't irrational. But my experience has been the opposite. I've *thought more* during this project, not less. I've learned a new domain, questioned my own assumptions, rebuilt systems from scratch when the data told me I was wrong. The AI didn't do that for me. It made it possible for me to do it *faster* — fast enough that I could iterate in weeks instead of giving up after month one.

The AI doesn't replace the thinking. It accelerates the iteration. And in a domain like trading, where every iteration teaches you something about the market, faster iteration means faster learning.

I'm still the one making the decisions. The AI is still the one saying things like "your system handles the next problem on its own" with a confidence that makes me slightly nervous. But the collaboration has been genuine, and the results speak for themselves.

Even if the results are a 9.9 that I'm too paranoid to celebrate.

---

The system is running. The monitors are watching. The coffee is, as always, going cold.

I'll be back when something breaks. Or when something beautiful happens. In trading, those are often the same thing.

---

*Disclaimer: This concludes a series of posts about a personal trading system built for educational purposes. Nothing here is, was, or will ever be financial advice. The system described has both made and lost money, sometimes on the same day. A 9.9 scorecard does not predict future performance. Please consult an actual financial professional before making investment decisions. And if you've read all six posts in this series and are now thinking about building your own trading bot — maybe re-read the one about Thursday first.*

*The complete FinBot series:*
1. *[I Let AI Manage My Money Because I'm Terrible At It](/posts/05-ai-financial-script/)*
2. *[My Trading Bot Was a Masterpiece — Of Doing Everything Wrong](/posts/06-ml-ridge-trading/)*
3. *[I Made My Trading Bot Try 13 Different Brains](/posts/07-ml-algorithm-horse-race/)*
4. *[My Trading Bot Made 10%. Then Lost 10%. Then I Fixed the Brakes](/posts/08-finbot-crash-postmortem/)*
5. *[I've Been Testing in Prod With Real Money. On Purpose. By Accident.](/posts/09-testing-in-prod-experimentation-paper-trading/)*
6. *[My Trading Bot Scored 9.9 Out of 10. Now It Just Has to Keep Not Blowing Up.](/posts/10-finbot-the-system-is-the-product/) (this post)*

**Next up:** Then the market crashed and 400 Telegram alerts showed up. [My Phone Got 400 Alerts Yesterday. I Have Uber to Thank for Why I Actually Fixed Them. →](/posts/11-finbot-alert-flood/)
