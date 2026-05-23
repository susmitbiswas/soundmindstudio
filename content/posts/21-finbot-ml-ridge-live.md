---
title: "My ML Model Looked Great on Paper. Here's What Happened When It Traded Real Money."
date: 2026-05-28T09:00:00-07:00
category: "geek"
series: "finbot"
draft: false
---

![A banana in a graduation cap proudly holding a backtest diploma certificate while standing next to a live trading terminal showing more modest but honest real-world results](/images/ml-live-banana.png)

On March 18, I deployed a new ML model to replace the linear composite that had been running since late 2025.

The backtest numbers were, by the standards of this kind of thing, embarrassing to look at. Not embarrassing-bad. Embarrassing-good. The linear composite had been anti-predictive — its IC was negative, meaning it was consistently ranking the wrong tickers first. The new model had a positive IC across many years of walk-forward out-of-sample windows, with a meaningfully positive IC-IR. Simulated P&L in the evaluation window was substantially better than the baseline.

The numbers were clean enough that I almost didn't trust them. When a result looks that unambiguous, the correct response is to go looking for what you missed. I went looking. I didn't find a disqualifying flaw. I deployed anyway, with appropriate caution about the gap between backtests and reality. 🤞

It has now been running in production for six weeks. Here is what actually happened.

## Act 1: What These Numbers Actually Mean

Before the results, it's worth being precise about what these numbers claim — because the gap between what they mean and what they sound like is exactly where unrealistic expectations come from.

| Metric | What It Measures | What It Doesn't Tell You |
|---|---|---|
| **IC** (Information Coefficient) | Rank correlation between predicted rankings and actual returns. Positive = better than random. | How right it is in absolute terms — even a small positive IC can be real and useful. |
| **IC-IR** | Stability: mean IC ÷ std dev of IC. High = consistently positive across windows. | Your P&L. The dollar outcome also depends on sizing, slippage, and regime. |

IC-IR matters more than raw IC. A model with high average IC but wildly variable IC is less useful than a model with moderate IC that stays positive reliably. Consistent edge beats occasional brilliance.

What IC-IR does not tell you is what your P&L will be. The actual dollar outcome depends on position sizing, slippage, concentration risk, market regime, and the capital efficiency of your execution. The backtest P&L is a model output, not a promise. The translation from a modest edge to a dollar figure involves compounding a lot of assumptions, several of which won't hold in live trading.

<div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:0.9rem 1.2rem;margin:1.5rem 0;border-radius:0 6px 6px 0;">
💡 <strong>The framing that matters:</strong> The backtest says: <em>there's an edge.</em> The live test answers: <em>how much of it survives contact with reality.</em> Every column in that comparison table is the gap between those two questions.
</div>

## Act 2: Six Weeks of Live Data

The honest version of six weeks of live trading in a volatile regime is this: the model is working, just not at backtest levels.

April and May were noisy months — tariff announcements, earnings season surprises, a macro environment where the dominant feature of the tape was unpredictability rather than trend. The model's features are calibrated on historical distributions from the training period. Regime breaks are exactly the condition under which those calibrations are most likely to be off:

- The features are still computing the right things
- The thresholds that historically distinguished "high momentum" from "moderate momentum" just mean something different when the whole market is whipsawing

Live IC across the six-week window: **positive** — but below the walk-forward average from backtesting. The drop is explained by two things:

| Cause | What happened |
|---|---|
| **Partial in-sample contamination** | The backtest evaluation included February and March dates — close to the training window boundary. Those dates are structurally similar to training data. Live data from April-May is genuinely new. |
| **Regime difference** | The model trained on a different market environment. April-May whipsawing wasn't in the training data. |

Neither of these is a failure. They're the **expected output** of deploying a model into a world it hasn't seen. P&L over six weeks: positive relative to the linear baseline, with a smaller delta than the backtest suggested. That's what honest accounting looks like.

## Act 3: The Counter-Intuitive Part

The finding that still catches me off guard, six weeks in: the simpler, regularized model continues to outperform the more complex nonlinear alternatives in live conditions. Same result as the backtest, which means the backtest wasn't lying about this particular comparison.

This shouldn't be surprising. It still is. 🤔

| | Complex nonlinear model | Simple regularized model |
|---|---|---|
| **Expressive capacity** | High — captures nonlinear interactions | Low — linear relationships only |
| **Looks better on paper** | ✅ Yes | ❌ No |
| **Performance in live low-SNR conditions** | ❌ Worse | ✅ Better |
| **Why** | Fits the noise with confidence | Skeptical about its own signals — shrinks toward zero |

Short-horizon equity returns are mostly noise. A model that can fit complex patterns *will* — and in a low-signal environment, those patterns are mostly spurious. Regularization is the model expressing a prior: *the signals are probably weaker than they appear.* In a noisy regime, that prior is correct.

<div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:0.9rem 1.2rem;margin:1.5rem 0;border-radius:0 6px 6px 0;">
🔑 <strong>On model complexity:</strong> Complexity is only useful when signal exceeds noise. Short-horizon equity returns are mostly noise. When you're operating below that threshold, the sophisticated model is sophisticated in the <em>wrong direction</em>. The right answer is simpler, regularized, and skeptical about its own signals.
</div>

## Act 4: What Broke the Feature Set

One feature started going quiet on me six weeks in — a momentum feature that tracks where each ticker sits relative to its moving average.

Not broken. Not miscalculating. Just... useless. 🤫

**Here's the problem in plain terms.** This feature works by measuring *spread*. In a trending market, stocks fan out: some are extended well above their averages, some are well below. That spread is what gives the model something to rank against.

April-May was a flat, news-rattled, going-nowhere market. Stocks reverted. The whole universe converged on its averages.

| | Trending market ✅ | Sideways market (April-May) ❌ |
|---|---|---|
| **Ticker A** | +14% above avg 🔼 | +1% ➡ |
| **Ticker B** | +7% above avg 🔼 | +2% ➡ |
| **Ticker C** | −4% below avg 🔽 | 0% ➡ |
| **Ticker D** | −13% below avg 🔽 | −1% ➡ |
| **Model can rank?** | ✅ Clear ordering | 🤷 Everyone looks the same |

When every ticker reads the same value, ranking by that value is meaningless. The code is correct. The math is right. The market just stopped cooperating with the feature's assumptions.

<div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:0.9rem 1.2rem;margin:1.5rem 0;border-radius:0 6px 6px 0;">
💡 <strong>The hidden assumption in every spread feature:</strong> It only works when the universe is <em>dispersed</em> enough to carry cross-sectional information. In a consolidating regime, dispersion collapses and so does the feature's usefulness. This went into the monitoring log as a regime-sensitivity note, not a bug. When the tape becomes directional again, it'll come back online.
</div>

👉 **Practical implication:** Features that measure spread need explicit attention during consolidating regimes. This isn't new knowledge in quant finance. It's the kind of thing that stays abstract until you watch it happen to a specific feature you built.

## Act 5: The News Score Addition

After accumulating enough forward return data from `news_eval.py`, I added the sentiment score to the ML feature set and retrained.

The contribution is **positive and small**. IC with news included is marginally higher than IC without it. Not transformative. Expected.

The case for including it anyway breaks down like this:

| | Value |
|---|---|
| **Infrastructure cost** | Near zero — FinBERT was already running; adding the score is a column in a dataframe |
| **Marginal IC improvement** | Small but consistent |
| **When it helps most** | High news volume periods — exactly when other features are noisiest |
| **Relationship to other features** | Complementary, not redundant |

<div style="background:#f0fdf4;border-left:4px solid #22c55e;padding:0.9rem 1.2rem;margin:1.5rem 0;border-radius:0 6px 6px 0;">
✅ <strong>The bar:</strong> The retrained model is marginally better than it was before. That's the bar. It passed.
</div>

## Act 6: The Honest Accounting

Six weeks of live trading against the backtested model yields this:

| Metric | Backtest | Live |
|---|---|---|
| IC (mean) | Positive | Positive, below backtest avg |
| IC-IR | Positive | Not yet stable (window too short) |
| P&L vs linear baseline | Better (simulation) | Better, smaller delta |
| Simple vs complex models | Simpler wins | Simpler wins |
| Moving average feature | Normal contribution | Reduced in sideways regime |

The gap between columns one and two is explained by the two causes identified in Act 2: partial in-sample contamination and genuine regime difference. Neither is a failure — they're the expected output of deploying a model into a world it hasn't seen.

<div style="background:#f0fdf4;border-left:4px solid #22c55e;padding:0.9rem 1.2rem;margin:1.5rem 0;border-radius:0 6px 6px 0;">
✅ <strong>Where it stands:</strong> The linear composite that ran before had a negative IC — it was, in a measurable sense, anti-predictive. The new model has a positive IC in live conditions. That is a real improvement. It is not a money printer. The backtest looked like it might be. The live data is a more honest accounting.
</div>

The model is also improving as more out-of-sample data accumulates:

- **June retrain** will incorporate 6 weeks of data the original model never saw
- Features that held up in live conditions → higher weight
- Features that proved regime-sensitive → lower weight or conditional activation
- That's the expected trajectory: incrementally better as the world gives it more information

What it won't do is suddenly start performing at backtest levels. The backtest was measuring something partially in-sample. The live system is measuring something genuinely out-of-sample. The latter is the honest number, and it's positive.

> That's good enough to keep running.

## What Changed

- New ML model deployed March 18, live for 6 weeks as of this writing; linear composite retired
- IC in live conditions: positive but below backtest average — expected outcome given partial in-sample contamination in the evaluation window
- Moving average momentum feature flagged as low-information in sideways regimes; noted for regime-conditional weighting in future retrain
- `news_score` added to ML feature set after 45-day forward-return evaluation; model retrained; IC marginally improved
- Simple regularized model vs. complex nonlinear alternatives: simpler model still wins in live conditions; added to production notes as a confirmed result, not just a backtest artifact
- Walk-forward retrain scheduled quarterly; first retrain due June; will incorporate 6 weeks of genuinely out-of-sample data

---

*Disclaimer: None of this is investment advice. FinBot trades real money and the story here is a six-week case study in the difference between backtest performance and live performance. If you're building something similar, the gap between columns one and two in that table is not a problem to be solved — it's the correct behavior of a system being honest about what it knows.*

**Previously:** [I Built a System to Watch My System. The Watcher Needed a Watcher. →](/posts/18-finbot-watchdog-had-a-bug/)
