---
title: "The Verdict Is In on My News Signal. It Works. Just Not the Way I Expected."
date: 2026-05-24T09:00:00-07:00
category: "geek"
series: "finbot"
draft: false
---

![A banana scientist in a lab coat holding two test tubes labeled FinBERT and LLM while stock charts show confusing mixed signals behind them](/images/news-verdict-banana.png)

Hypothesis testing is great in theory. 🧪

In practice, you form the hypothesis, wire up the experiment, and then wait. In this case, 45 trading days. Which is about nine calendar weeks. Which is enough time to forget the exact question you were trying to answer and start second-guessing the framing.

When the data finally came in, I ran the analysis and got a result. Then I spent another week trying to figure out if the result meant what I thought it meant. It didn't. It meant something more useful, which I'll get to.

## Act 1: The Setup

Back in post 14, I added FinBERT as a sentiment scorer for daily headlines. FinBERT is a BERT model fine-tuned on financial text — it reads a headline and returns a sentiment score between -1 and 1. The idea was simple: if a ticker is in the news and the news is positive, maybe the stock outperforms the next day. Maybe.

The IC-IR at the time was unusually high — the kind of number that's real but not representative of normal market conditions. It was based on a period of elevated volatility where sentiment happened to correlate unusually well with short-term price movements. The number was real; the durability of it was not.

The question I ended post 14 with: does a modern LLM do better than a 2019 fine-tuned BERT model?

To answer it, I built `news_eval.py` — a daily collector that gathers headlines for each ticker, records the FinBERT score, records the LLM score, and pairs both with the next trading day's return. I started it running March 19. Then I waited.

By early May: 45 trading days, roughly 70 tickers in the universe, around 3,000 headline-to-return pairs. Enough to compute IC and IC-IR with some statistical footing.

## Act 2: What FinBERT Said

FinBERT's IC over this window: **positive**. IC-IR: **positive**, clearing the threshold I set for promotion. ✅

The number was lower than the initial reading from post 14 — and that was expected. The earlier window was an unusually good stretch for sentiment signal: elevated volatility, more market-moving news events, cleaner sentiment-to-price relationships. The new window was normal market conditions. Normal is what you want to see.

The IC-IR cleared my promotion threshold. The signal is real. It's just not miracle-of-the-century real.

> It's "useful feature in an ensemble" real — which is exactly what features are supposed to be.

What struck me was the subprocess setup still working without complaint: FinBERT loads in its own Python process (the model weights would bloat the main process's memory footprint), runs a 30-second batch job every morning, and produces scores that weakly but genuinely predict next-day returns. Inelegant in every possible way. Working.

## Act 3: What the LLM Test Said

For the LLM evaluation, I replaced the FinBERT scoring step with API calls to Claude — one call per ticker, per day, structured to return a numerical sentiment score in the same -1 to 1 range. The prompt was direct: here are today's headlines for this ticker, rate the overall sentiment for a short-horizon equity holder.

The results: LLM scores correlate highly with FinBERT scores. The models largely agree on what's positive news and what's negative news. This isn't surprising — FinBERT was specifically trained to understand financial text, and it's good at its job. The LLM brings broader world knowledge and better contextual reasoning, but for most run-of-the-mill earnings headlines and analyst upgrades, both models land in the same zip code.

| | FinBERT | LLM (Claude) |
|---|---|---|
| **IC over 45-day window** | Positive, above threshold | Similar to FinBERT |
| **Cost per ticker/day** | Fraction of a cent | ~30x more |
| **Model vintage** | 2019, finance-specific | Current, general-purpose |
| **Contextual reasoning** | Pattern-matching on financial vocabulary | Full contextual understanding |
| **IC difference** | Baseline | Marginally better/worse depending on horizon — not meaningful |
| **Verdict** | Production | Sanity check only |

I expected one of them to win clearly. Neither did.

## Act 4: The Unexpected Finding

When neither model wins clearly, the interesting question stops being "which model" and starts being "when does the signal work at all."

I broke the dataset into two groups: days with major news events (earnings releases, significant analyst calls, macro announcements affecting the sector) and days with routine or low-volume news. Then I looked at IC separately for each group.

The pattern was stark. Sentiment had substantially more predictive power on the day *after* major news, not on the day of.

On the day of a significant announcement, the price already incorporates the news. Financial news breaks in the morning — pre-market, during market hours, sometimes in the prior evening's after-hours session. By the time the morning scan runs, the market has been trading on that information for hours. The signal in the headline is largely already in the price.

What FinBERT and the LLM are actually capturing is different from what I initially assumed. The model isn't identifying "this news is positive, so buy." It's identifying "this news has a clear sentiment direction, and the market's reaction to that direction tends to continue into the next session." There's a day-after continuation effect — positive news days are followed by continued buying, negative news days are followed by continued selling — and the sentiment score is a decent proxy for which camp a ticker is in.

<div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:0.9rem 1.2rem;margin:1.5rem 0;border-radius:0 6px 6px 0;">
💡 <strong>The unexpected finding:</strong> <em>This is a continuation feature, not a directional signal.</em> The model isn't predicting "good news → buy today." It's predicting "the market started reacting to this news — and that reaction tends to carry over into tomorrow." Same code. Different meaning. Still useful.
</div>

It's the same code. Different meaning. I built one thing and it turned out to be measuring something adjacent to what I thought I was measuring, which happens to still be useful.

## Act 5: What This Means for Infrastructure

Having established that the signal is real, that the LLM doesn't substantially beat FinBERT, and that I understand roughly what the signal is measuring, the infrastructure question becomes straightforward.

FinBERT runs at a fraction of a cent per ticker per day. The LLM API costs an order of magnitude more at the same scale. The multiplier is large enough that you don't need a spreadsheet — you just need to run the numbers once and accept the answer.

A significant cost premium for a quality improvement that didn't survive statistical significance testing. The LLM scores are arguably better in some qualitative sense — the model reasons about context rather than pattern-matching on financial vocabulary — but the quantitative evidence doesn't support paying 30x for it.

The decision was easy: keep FinBERT. The 2019 model in a subprocess is the correct tool for this task at this scale. The LLM is a useful sanity check and a good comparison anchor. It's not the right production component when the cheaper model performs equivalently on the metric that matters.

I've noticed a pattern in my own reasoning where "more capable model" gets conflated with "better for this specific use case." They're different claims.

<div style="background:#f0fdf4;border-left:4px solid #22c55e;padding:0.9rem 1.2rem;margin:1.5rem 0;border-radius:0 6px 6px 0;">
✅ <strong>Why FinBERT wins:</strong> It's narrower, older, and less capable in general. It is also well-calibrated for financial text specifically, costs almost nothing to run, and produces results statistically indistinguishable from a much more sophisticated alternative on this particular task. "More capable" ≠ "better for this specific use case."
</div>

## Act 6: What "The Signal Works" Actually Means

A modest IC sounds underwhelming if you read it as a standalone number. A few percent of rank correlation? That's... not a lot of information.

But that's not what features do in an ensemble model. Features vote.

| Scenario | What sentiment is doing |
|---|---|
| Sentiment agrees with momentum + relative strength | 👍 Confirmation from a different data source — agreement means more than any single vote |
| Sentiment disagrees with momentum | ⚠️ Caution signal — the model can down-weight or investigate |
| Sentiment is noisy (flat market, low news volume) | 🤷 Contributes little — other features carry the weight |

None of FinBot's features predict returns well in isolation. They predict returns better together because they're measuring different things. A sentiment score that weakly predicts returns on its own can still meaningfully improve an ensemble — particularly in periods of high news volume, when other features are noisiest and sentiment is most informative.

<div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:0.9rem 1.2rem;margin:1.5rem 0;border-radius:0 6px 6px 0;">
🔑 <strong>Lesson:</strong> <em>Evaluate features as part of an ensemble, not in isolation.</em> The 45-day IC analysis told me the feature was worth including. The backtest will tell me whether the model with the sentiment score outperforms the model without it. Those are different questions that require different tests.
</div>

I have one; now I need the other.

What I know going in: the signal is real, the interpretation is clearer than it was, and the infrastructure is stable. That's a reasonable position to start a feature from.

## What Changed

- Completed 45-day news evaluation; FinBERT IC confirmed positive over the full window, IC-IR cleared the promotion threshold
- LLM (Claude) vs FinBERT comparison: similar IC across forward-return horizons, significantly higher cost — kept FinBERT
- Added the sentiment score to the ML feature set and retrained on the updated feature matrix
- Identified that sentiment signal is strongest as a morning-to-next-day continuation feature following major news events, not as a standalone directional signal on the day of the news
- Updated `news_eval.py` to run daily and append to a history CSV for ongoing IC monitoring — so the next time someone asks "is this still working," the answer takes less than nine weeks

---

*Disclaimer: None of this is investment advice. FinBot trades real money with real risk, and the fact that a sentiment signal has positive IC over a 45-day evaluation window does not mean it will continue to have positive IC forever, or that you should build anything resembling this and expect it to work. Markets change. Features decay. The 2019 model running in a subprocess is doing fine today; check back later.*

**Previously:** [I Replaced My Polling Loop With Real-Time Streams. The Bot Got Faster. I Got Slower. →](/posts/16-finbot-realtime-streams/)
