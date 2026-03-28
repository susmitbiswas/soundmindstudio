---
title: "I Made My Trading Bot Try 13 Different Brains. One of Them Is Suspiciously Good."
date: 2026-03-24
category: "geek"
draft: false
---

If you've been following this series, you know the arc: I built a trading bot. It was bad. I measured how bad it was. I added machine learning. The numbers got better. I felt briefly competent. End of story.

Except it wasn't the end of the story, because now I had a new question: *is Ridge the best we can do?*

Ridge regression is the answer I arrived at after reading a few papers and running some backtests. It's a regularized linear model — simple, principled, hard to break. It won its little three-way matchup against the old linear composite and a random forest. But that was three contestants. What if I ran a proper tournament?

## The Reasoning (Rationalization) Behind This

Here's the thing about Ridge: it's a 1970s algorithm. Linear algebra with a penalty term. Effective, yes. But the field of machine learning has not been idle since 1970. There are gradient boosting variants I'd never tried. Tree ensembles. Probabilistic models. A new generation of tabular learning algorithms from 2024 research papers.

Was I leaving performance on the table? Were there models that could handle the nonlinearities in stock returns that Ridge, by design, can't capture?

The only way to find out was to race them.

## The Setup

Same framework as before — 15 years of daily data, 63 tickers, 24 features per stock per day (multi-timeframe momentum, RSI, MACD, volume ratios, volatility, sector context), 25 walk-forward validation windows. Each model trains on 24 months of data and gets tested on the next 6, then the window slides forward. No peeking at the future.

The metric is Information Coefficient (IC): Spearman rank correlation between predicted scores and actual 5-day forward returns. The IC-IR is mean IC divided by standard deviation of IC — a consistency measure, like a Sharpe ratio for your model's predictive skill rather than raw returns.

Thirteen contestants. May the best algorithm win.

## The Results

| Model | Mean IC | IC-IR | Sharpe | IC > 0 |
|-------|--------:|------:|-------:|-------:|
| A | 0.0943 | 1.27 | 0.808 | 96% |
| B | 0.0532 | 0.73 | 0.464 | 72% |
| C | 0.0477 | 0.64 | 0.335 | 72% |
| D | 0.0245 | 0.29 | 0.183 | 52% |
| E | 0.0225 | 0.32 | 0.182 | 56% |
| F | 0.0221 | 0.33 | 0.146 | 60% |
| G | 0.0203 | 0.32 | 0.174 | 60% |
| H | 0.0149 | 0.24 | 0.097 | 64% |
| I | 0.0138 | 0.21 | 0.087 | 60% |
| J | 0.0132 | 0.17 | 0.060 | 68% |
| K | 0.0118 | 0.19 | 0.105 | 56% |
| L | 0.0103 | 0.16 | 0.065 | 44% |
| M | 0.0022 | 0.04 | 0.009 | 52% |
| *Old linear composite* | *−0.037* | *−0.82* | *−0.308* | *17%* |

I'm not going to tell you which letter is which model yet, because we're still in the middle of an experiment and I don't want to jinx it. But I will tell you a few things I noticed.

## What Surprised Me

**The old linear composite makes another appearance at the bottom.** IC of −0.037 and positive in only 17% of windows. I've now confirmed this from multiple angles and it remains grimly consistent. The elaborate manual scoring system is not just unhelpful — it's actively counterproductive. This is a great argument for measuring your assumptions before trusting them.

**Model A is not what I expected to win.** I went into this assuming one of the newer, more complex algorithms — the ones with dense academic papers and impressive benchmark results — would come out on top. They did not. The winner is an algorithm that I would describe charitably as "unglamorous." It's the statistical equivalent of a sensible sedan: it goes where you point it, every time, without drama. IC of 0.094 and positive in *96% of all 25 windows* across 15 years. That consistency number is the one I keep staring at.

**The very sophisticated models ended up in the middle of the pack.** Gradient boosters, probabilistic models, a stacked meta-learner — all reasonably good. None of them embarrassed themselves. None of them ran away with the trophy either. The market is noisy enough that brute-force complexity doesn't help as much as you'd expect.

**One model (M) is indistinguishable from random.** IC of 0.002 and Sharpe of 0.009. This one is a newer gradient boosting variant that I had high hopes for. The market simply does not reward the particular bet it makes. This is useful information.

## The Part Where I Don't Trust My Own Results

Here's the thing about a 96% win rate across 25 windows: it makes me nervous.

Any time a backtest looks this clean, the responsible thing to do is assume you've made an error somewhere. Maybe I introduced subtle look-ahead bias. Maybe I got lucky with the specific 15-year window I picked. Maybe the model will fall apart the first week it runs live.

So rather than declaring a winner and immediately deploying it, I've set up a proper A/B experiment. The current production system keeps running exactly as it was — Ridge, live execution, real trades. Starting today, a shadow system runs alongside it using the candidate model, paper-trading only, tagging its output with a different label. Both systems look at the same universe, score the same stocks, and save their picks to disk every morning. In two or three weeks I'll compare what each of them would have done with real money.

If the backtest holds, I promote the challenger. If the challenger underperforms, Ridge keeps its job and I go back to the drawing board with the humility of someone who thought they'd cracked it.

This is, I've come to believe, the only honest way to do this.

## Meanwhile, In the Real World

The irony of spending a day running algorithm tournaments is that the existing Ridge system was apparently having a very good time without me.

![FinBot up 8.37% on the day while futures pointed red — account values blurred](/images/ML-ridge-win.jpeg)

By end of day, FinBot's account was up **8.37%** — on a day when the broader market moved about a quarter of that. I have no idea if this is the Ridge predictions doing their job or just a good day to have held the positions that happened to be in the book. Probably some combination. I'm trying not to read too much into single-day returns, because that way lies overconfidence and bad decisions.

But still. Eight percent. Whilst I was busy questioning whether I should replace it.

Maybe the system knows something I don't. Or maybe tomorrow it gives it all back and I spend the morning refreshing charts with my coffee going cold. That's the deal you make.

Either way — there's a better algorithm in the pipeline now, validated against 15 years of data, already running in the shadows. If the numbers hold up over the next few weeks, it goes live. And then we get to find out what a Sharpe of 0.808 feels like in practice, rather than on a chart.

I am cautiously, irrationally, completely unreasonably optimistic.

---

*Disclaimer: This remains not financial advice. I am a software person who runs backtests and pretends to understand what he sees. Model A is not a promise — it's a hypothesis with good credentials. Act accordingly, and please consult an actual financial professional before you do anything I describe here.*
