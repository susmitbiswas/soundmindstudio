---
title: "I Taught My Bot to Read Good News. The Stocks Went Down. I Have Questions."
date: 2026-04-09T18:00:00-07:00
category: "geek"
series: "finbot"
draft: false
---

![A banana reading a glowing newspaper with a giant green thumbs up, while the stock ticker behind it shows red arrows pointing down](/images/banana-good-news-red.png)

Here is a thing I believed, with the confidence of someone who has written a lot of code and done very little investing:

*If the news about a stock is positive, the stock price will go up.*

This is the kind of belief that sounds so obviously correct that you don't even realize it's an assumption. You just build on top of it. You score headlines on a scale of 0 to 100 — 0 being "company spontaneously combusts," 100 being "company discovers infinite money" — and you wire that score into your trading system as a signal. High score: maybe buy. Low score: maybe sell. The logic is airtight. A child could follow it.

The market, as it turns out, did not read my design doc.

## Background: The Sentiment Stack

If you've been reading this series, you know that FinBot — my personal trading system, the one I built in the middle of a tech stock rally and have been learning expensive lessons from ever since — has a sentiment module. It scrapes headlines, scores them, and uses that score as one of several inputs to the signal that decides when to enter and exit positions.

The scoring has been done by [FinBERT](https://huggingface.co/ProsusAI/finbert), a BERT-based model fine-tuned specifically on financial text. It lives in a separate Python virtual environment on my home server because it needs dependencies that are incompatible with everything else, which tells you something about the state of ML tooling that I will not expand on here.

FinBERT works. Measurably. Over a 55-trading-day evaluation window, it produced a quintile long/short return of **+7.86%** with a Sharpe of +1.86. That means if I went long on the tickers FinBERT was most positive about and short on the ones it was most negative about, I'd have made money. Consistently. Across a volatile market period that included a tariff-driven crash regime starting in early April.

That's real signal. I've seen enough non-signal in my life to recognize what signal looks like.

But FinBERT is also a 2019 model that runs in a subprocess because it can't share a runtime with anything else, takes 30 seconds to score a batch, and has the infrastructure footprint of a small goat. So the natural question was: can a modern LLM do better?

Specifically: can Claude Haiku — fast, cheap, API-based, no subprocess archaeology required — replace it?

## The Technologist's Assumption

I'll be honest about what I expected.

I expected Haiku to win. Or at least tie. Because Haiku is *smarter*, in the general sense — it can reason, it can contextualize, it can read a headline and understand the nuance that a 2019 BERT model might miss. It knows what a Fed pivot is. (Well, I did not know before I wrote this article). It understands that "better-than-expected earnings" means something different when the whisper number was already baked in. Surely this generalist intelligence advantage would translate into a better signal.

I set up the evaluation properly. I re-fetched Polygon.io historical headlines for all 63 tickers in my evaluation universe, from January 23 through April 9, 2026 — 55 trading days, 5,799 headlines total. I scored every ticker-day with Haiku using the standard sentiment prompt: *score this headline 0-100, where 0 is very bearish and 100 is very bullish*. I merged those scores with actual next-day returns. I computed IC (information coefficient — how well the scores predict returns), quintile P&L, and a few other things.

The results came back. I stared at them.

| Scorer | Quintile P&L | Sharpe | 1d IC-IR |
|--------|-------------|--------|----------|
| FinBERT | **+7.86%** | **+1.86** | +0.065 |
| Haiku (textual) | **−9.78%** | −1.58 | −0.004 |
| VADER (for laughs) | −3.39% | −0.85 | +0.200 |

Haiku didn't just lose. It lost by nearly 18 percentage points relative to FinBERT. The long/short strategy using Haiku's scores — buying the bullish ones, selling the bearish ones — hemorrhaged money at a Sharpe of −1.58 across 52 days.

This is the part where I sat back in my chair and said something I will not reproduce here.

## The Counterintuitive Discovery

Here's the thing that took me a moment to fully absorb: the signal wasn't bad. It was *inverted*.

When I flipped Haiku's scores — treated high-sentiment as a sell signal and low-sentiment as a buy signal — the strategy made **+9.78%**. Same data. Same headlines. Same scores. Just: if Haiku says bullish, go short. If Haiku says bearish, go long.

I verified this by looking at the IC broken down by market regime. On days when Haiku's average sentiment score across all tickers was bullish (above 55), the mean IC was **−0.018** — meaning positive scores *negatively predicted* next-day returns. The stocks that Haiku rated most bullish actually *underperformed* the ones it rated most bearish.

On neutral-sentiment days, the IC flipped slightly positive: **+0.017**. No strong sentiment signal → weak directional correctness.

This is not a bug. This is a phenomenon with a name: **sell the news**.

When good news about a stock is public — widely visible, in the headlines, scoring an 85/100 on anyone's sentiment meter — the information is already priced in. The market has already processed it. Institutional traders who knew before the headline broke have already positioned. The retail investors who read the headline over breakfast are buying into a position that professionals are selling. The stock that looks most obviously bullish is often the one with the most exhausted buyers.

FinBERT, trained on labeled financial text with *actual financial outcomes* as labels, learned this. Somewhere in its weights is the pattern: "positive-sounding headline about a stock that already ran up → muted or negative return." Haiku, trained on general text to predict what comes next in a document, learned a different thing: "positive headline → stock goes up." Which is correct in the sense that it's what a journalism student would write. Incorrect in the sense of what the market actually does.

I, as an engineer, also believed the journalism student version. And I built my test on that assumption, which is why the Haiku directional strategy lost money and I had to be walked through the inversion by my own backtest data.

I would like to think I would have figured this out eventually. I am not confident in this.

## What We're Doing About It

The interesting question isn't "why did Haiku fail" — it's "can you fix it by changing how you ask the question?"

The original prompt was asking Haiku to be a journalism school sentiment analyzer: *is this headline positive or negative?* But what I actually need is a quantitative analyst who understands market pricing: *given that this headline is already public, will this stock outperform or underperform its sector tomorrow?*

These are completely different questions. The first one is about the text. The second one is about the market's reaction to the text — which requires reasoning about what's already priced in, whether this is a genuine surprise or a well-telegraphed event, whether the sector is rotating in a way that overwhelms stock-specific news.

I rewrote the prompt. Here's the difference:

**Before (textual framing):**
> Score each stock ticker's headlines on a 0-100 scale: 0 = extremely bearish, 100 = extremely bullish.

**After (outcome framing):**
> You are a quantitative analyst. These headlines are now public knowledge, visible to all market participants. Given that this information may already be priced in, will this stock OUTPERFORM or UNDERPERFORM its sector peers over the NEXT TRADING DAY? Consider: is this a genuine earnings surprise, or a restatement of known facts? Is the reaction likely exhausted?

I re-scored all 55 days with the new prompt. The results:

| Scorer | Quintile P&L | Sharpe | 1d IC-IR | Win % |
|--------|-------------|--------|----------|-------|
| FinBERT | **+7.86%** | **+1.86** | +0.065 | 52.4% |
| Haiku v1 (textual) | −9.78% | −1.58 | −0.004 | 51.9% |
| Haiku v2 (outcome) | **+3.68%** | **+0.59** | **+0.017** | **59.6%** |

The outcome prompt fixed the inversion. Haiku-v2 now makes money on the long/short strategy — not as much as FinBERT, but positive, with a win rate of 59.6% (actually better than FinBERT's 52.4%, which means it's right on direction more often, it's just less aggressive on the winners).

The gap with FinBERT remains. Prompt engineering can teach Haiku to *think about* market pricing, but it can't give it FinBERT's years of labeled financial training data. Haiku is reasoning from first principles. FinBERT has the pattern embedded. For now, FinBERT is still the better standalone scorer.

## What This Actually Means

I want to sit with the broader lesson here for a moment, because it's one I keep running into in this project.

The naive technologist model of markets — the one I had when I started this — is that markets are information processors. Good information goes in, price adjusts, equilibrium is restored. Therefore: score the information, use the score, profit.

The actual model is messier. Markets are also made of people who anticipated the information, people who are reacting to the anticipated reaction, options traders positioning for volatility regardless of direction, and algorithmic systems doing things that nobody fully understands. By the time a headline is readable and scoreable, it has already passed through all of those layers. The residual — what's left for a sentiment scorer to predict — is not the information itself. It's the delta between what the market expected and what arrived.

FinBERT learned to estimate that delta. The textual Haiku prompt estimated the information. These are not the same thing, and the difference between them is roughly 17 percentage points of annual return.

This is, I think, the fundamental lesson of every quantitative finance project I've read about, and apparently one I needed to re-derive myself from scratch using my own money and my own headline data. The market doesn't pay you for being right about the world. It pays you for being right about what the world will *surprise* the market with.

## Stay Tuned

We're not done. The next experiment is whether combining FinBERT and Haiku-v2 produces a better signal than either alone — they're measuring related but different things, and uncorrelated signals that are each individually predictive have a known tendency to get stronger when stacked. The early backtest results are encouraging.

There are also interesting questions about whether the outcome-framing prompt works better in certain regimes (calm markets vs. crisis) and whether a Sonnet-class model — more capable, more expensive — closes the gap with FinBERT further than Haiku managed.

For now: the system is running FinBERT in production. Haiku-v2 is in the lab. The inversion has been understood and fixed. The 400 alerts from two days ago have been addressed. And the market, as always, is waiting to teach me the next thing I thought I already knew.

---

*Questions, challenges, or "you're thinking about this completely wrong" — very welcome in the comments. I learn more from the people who disagree with me than the ones who don't.*

---

*← Previously: [My Phone Got 400 Alerts Yesterday. I Have Uber to Thank for Why I Actually Fixed Them.](/posts/11-finbot-alert-flood/)*

*← And before that: [I Used to Work on Designing Microprocessors at AMD. A Decade Later, the Same Trick Made My Dictation App Feel Instant.](/posts/13-mywispr-pipeline/)*

---

*Disclaimer: None of this is financial advice. Please do not build a trading system based on anything in this post and then blame me when it loses money. FinBERT's +7.86% quintile P&L is a 55-day backtest result, not a promise. The market will find new ways to be wrong about itself, and I will be there, updating prompts, re-running backtests, and writing about it.*
