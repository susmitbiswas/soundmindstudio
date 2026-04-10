---
title: "Good Code (Arguable), Wrong Assumptions"
date: 2026-04-09T22:00:00-07:00
category: "geek"
series: "finbot"
draft: false
---

![Five quiet amber warning lights blinking on a wall behind a confident banana engineer](/images/silent-banana-problems.png)

There is a category of bug that doesn't crash anything.

It doesn't show up in logs. It doesn't fail a test. It doesn't trigger a Telegram alert at 6am. It just sits there, quietly wrong, while the system hums along and you go about your life feeling like a competent engineer.

Today was a day of finding those bugs. Five of them, across different layers of the system, each wearing a different disguise. Some were in the trading logic. One was in how I was using the AI coding assistants that help me build the trading logic. By the time I was done, I had retrained a model, fixed a data fetching strategy, established a new coding principle, rearchitected a pipeline, and set up a guardrail I should have had from the start.

The system kept running through all of it. That's kind of the point.

## Act 0: The Morning Started With an Alarm

Before any of the above, Telegram woke me up.

The model health monitor — a watchdog I built after one too many "wait, when did this stop working?" moments — had been firing alerts since the previous afternoon. Two of them.

The first: **model drift**. The Information Coefficient had gone negative. The model that's supposed to predict which stocks will outperform was, in measurable terms, pointing the wrong direction. Not slightly degraded. Actively wrong.

The second: **ensemble degradation**. The system loads a collection of trained models at startup and requires at least two to be healthy before it will trade. Only one was loading. The guard that's supposed to catch this had a bug — the check was wired incorrectly, so the system was proceeding with a single model and no warning.

I didn't know about either of these until the alerts fired. The model had been degrading silently. The ensemble check had been silently broken for some period of time. Two assumptions I hadn't verified: *the model is still predictive*, and *the health check is working*.

The fixes here were relatively surgical — a code correction for the ensemble guard, and a retraining run for the model. But they set the tone for a day that kept returning to the same theme: things that were technically running but were wrong in ways I hadn't looked for.

## Act 1: The Model That Didn't Know What It Didn't Know

After the ensemble was healthy again, I went looking at why the model had drifted.

The answer was architectural. The model was being asked to use features at inference time that it had never seen during training.

Not rare features. Core real-time inputs — things computed from live market data that updates throughout the trading day — were being passed to a model trained exclusively on end-of-day historical data. Every day, in production, the model was receiving inputs it had no basis for interpreting and doing what any reasonable system does when that happens: generating confidently wrong numbers.

The model isn't broken. The features aren't broken. But together, they're asking a question and providing an answer from different languages, and the gap between them was eroding predictive quality in ways that only became visible when I went looking.

The fix meant rethinking the training pipeline so each stage only trains on what it will actually see at inference time. I won't share the specifics of how we restructured it — that's the part I'd rather keep — but the principle is almost embarrassingly obvious in retrospect: *train on what you'll actually be asked to do.*

The number of times I've watched engineers (including myself) violate this in both ML and software generally is high. It's one of those lessons that you intellectually understand and then keep re-learning.

## Act 2: 377 Errors That Looked Like Silence

While running test scans to validate the retrained model, I noticed something in the logs: hundreds of `401 Unauthorized` errors from Yahoo Finance, appearing mid-run, one after another, quietly.

I counted them. Across five runs: **377 HTTP 401 errors per run**, every day, for who knows how long.

This matters because those errors weren't failing loudly. The exception handler caught them, returned a default value (zero, or empty dict), and the system moved on. From the outside, it looked like the system had successfully fetched fundamental data — short interest, earnings history, profitability metrics — for every ticker in the universe. From the inside, it had fetched exactly none of it for a large portion of the run and substituted silent zeroes.

The model doesn't know a fetch failed. It just sees a score of zero and treats it as meaningful information. A ticker with genuinely zero short interest and a ticker whose short interest fetch 401'd look identical from where the model sits.

The root cause was a concurrency issue. The library we use to fetch data from Yahoo Finance handles authentication via a "crumb" parameter that gets rotated periodically. When four threads fire requests simultaneously, they race on that crumb: one thread refreshes it, the others arrive with the stale version, and Yahoo sends back 401s. The more parallel you are, the more often you lose the race.

The fix: make the fetches serial with a small sleep between them. One request at a time. The crumb never gets contested. 401 count: zero.

The cost: slower fetching. The solution to that cost: Act 4.

## Act 3: The Exception That Swallowed the Signal

While implementing the serial fetch fix, I (read LLM) wrote something like this:

```python
try:
    info = ticker.info or {}
    # ... extract fields ...
except Exception:
    pass
```

The response was immediate: *"I noticed you added exception pass. That is not a pattern I want in my codebase."*

This is correct, and it's worth expanding on, because `except: pass` is one of those patterns that feels harmless when you write it and causes compounding damage over time.

When you catch an exception and pass, you're making a silent decision: *this failure doesn't matter.* You're encoding that decision invisibly, with no record of what failed, when, why, or how often. The function returns as if everything is fine. The caller proceeds as if everything is fine. The logs show nothing. The dashboard shows nothing.

Everything looks fine. Nothing was fine.

This pattern is especially dangerous in data pipelines because the failure propagates through several layers before it affects output. A failed network call returns a default. A default that looks like real data gets passed to a model. A model that receives a default instead of real data produces a subtly wrong score. A subtly wrong score influences a trade. And the root cause — a rate limit, a timeout, a malformed response — has completely vanished by the time you're looking at position sizing.

The fix is two lines:

```python
except Exception as e:
    logger.warning(f"{ticker}: SI/FF fetch failed — {e}")
```

Not debug. **Warning.** A failing data fetch during a live market scan isn't routine noise — it's a signal that something upstream is wrong, and it needs to be visible.

This became a codified principle: *every `except` block must log at warning level with enough context to diagnose the failure without reproducing it. Silent exception handlers are prohibited.*

Worth noting: this wasn't the first time AI-generated code introduced this pattern. An earlier session had surfaced 35 instances of silent exception handlers across seven files — a VaR calculator returning zero risk on failure, a circuit breaker defaulting to "proceed" instead of "halt," a safety reviewer whose absence was treated as approval. This is a systematic tendency in LLM-generated code: **it prioritizes continuity over correctness**. The code keeps running. It just stops being honest about what happened.

The `except: pass` pattern is the code equivalent of a smoke alarm that, when it malfunctions, just turns itself off.

## Act 4: The Agents That Went Straight to Production

I use AI coding assistants heavily — multiple Claude sessions running concurrently, each owning a different part of the codebase. When there's a big implementation task, I'll spin up agents for different workstreams and let them run in parallel while I handle other things.

Today, during a session to expand the model's training data, three separate agents were given instructions that included the wrong working directory. Instead of writing to the root development directory — the correct location — they were writing directly to `prod/`.

`prod/` is the live directory. It's what launchd runs. Writes there bypass the pytest gate, bypass the dry-run validation, and bypass code review. The whole point of the promotion flow (`scripts/prod_sync.sh`) is to ensure that nothing gets to production without passing tests first. Three agents had just quietly walked around it.

The agents weren't doing anything wrong, exactly. They were following instructions. The instructions had a wrong assumption baked in: that the working directory they were given was appropriate for code changes. It wasn't.

The fixes here were procedural rather than technical. A rule was codified and saved to persistent memory: *agents always write to the root development directory, never to `prod/`. No exceptions.* Agent prompts for any future implementation work now explicitly specify the root directory. And the incident is a good reminder that the constraints you've built for yourself — test gates, promotion flows, review checkpoints — are only as good as the assumptions upstream of them.

A guardrail you can accidentally route around isn't a guardrail. It's a suggestion.

## Act 5: The Queue That Didn't Need to Be a Queue

With the serial fetch now taking longer (by design), I went back to look at the overall execution flow of the morning scan.

Here's what it looked like, end to end, all in series:

1. Build the ticker universe (~30s)
2. Fetch price history from Polygon (~20s)
3. Fetch macro indicators — VIX, yields, etc.(~5s)
4. Detect market regime from macro + price data (~5s)
5. Fetch intraday bars for all tickers (~30s)
6. Score headlines with the sentiment model (~30s)
7. Fetch fundamentals from Yahoo Finance (~130s, now serial)
8. Score all tickers (~60s)

Total time before the first score: well over three minutes in best case. Often takes >10m.

I drew out the dependency graph. Who actually needs who?

- Steps 5, 6, 7 need the ticker list from step 1. That's it.
- Step 2 needs the ticker list. That's it.
- Step 3 needs nothing.
- Step 4 needs steps 2 and 3 (price data + macro).
- Step 8 needs everything.

Steps 2, 3, 5, 6, and 7 have no dependencies on each other. They've been waiting in line, one after another, because I never asked whether the queue was necessary.

The new structure: as soon as the ticker universe is known, steps 5, 6, and 7 start in background threads. The main thread does the price fetch → macro fetch → regime detection chain (about 30 seconds total). Everything joins before the scoring loop starts.

The result: roughly two and a half minutes recovered from the morning scan cycle. Not from clever optimization or algorithmic improvements. From drawing a box-and-arrow diagram and noticing that most of the boxes had no arrows between them.

## The Theme Running Through All of It

Each of these five problems had the same structure:

- The code was running without crashing
- The output was subtly worse than it should have been  
- Nothing in the monitoring layer flagged it

The model drift alert is the exception — something did catch that one. But the ensemble guard, the 401 failures, the silent exception handlers, the agents in the wrong directory, the unnecessary serialization: none of those surfaced without someone going looking.

What they share is that they all relied on a *lack of scrutiny*. The code did what it was told. The assumption underneath the code was never examined.

I've started treating "it's working" as a weaker claim than I used to. The more interesting question is: *is it working for the reason I think it is, using the data I think it has, in the configuration I think it's running with?*

Usually yes. Sometimes: see above.

## What Changed

Without the details I'd rather keep:

- **Retrained the model** to eliminate the training/inference mismatch — two stages, each trained on data that's actually available at inference time
- **Fixed the 401s** by switching to sequential Yahoo Finance requests with rate limiting, running in a background thread to avoid adding latency
- **Fixed the ensemble health guard** that was silently proceeding with a single model
- **Established a no-silent-exceptions principle**: every `except` block logs at warning level with context — codified as a project development guideline
- **Added an explicit agent working directory rule**: agents always write to root dev, never to `prod/`
- **Parallelized five independent prefetch phases** that were running serially for no structural reason, recovering ~2.5 minutes from the scan cycle

The system is faster, less wrong, and louder when something goes sideways.

That's a good day. Expensive tuition, but a good day.

---

*Disclaimer: None of this is investment advice. FinBot trades real money with real risk, and today's story involves multiple ways the system was quietly wrong without anyone knowing. If you're building something similar, consider that "it's working" and "it's correct" are two different claims — and the gap between them tends to have dollar signs in it.*

**Previously:** [I Taught My Bot to Read Good News. The Stocks Went Down. I Have Questions. →](/posts/14-finbot-sell-the-news/)
