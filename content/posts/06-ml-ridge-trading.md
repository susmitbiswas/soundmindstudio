---
title: "My Trading Bot Was a Masterpiece — Of Doing Everything Wrong"
date: 2026-03-19
category: "geek"
draft: false
---

If you read [yesterday's post](/posts/05-ai-financial-script/), you know the story: I built a little Python script to manage my money so I didn't have to. It sent me Telegram messages. I felt extremely sophisticated. I used phrases like "signal composite" at dinner parties. Life was good.

Turns out, the script was quietly losing money the whole time.

Not *all* the time. Not *catastrophically*. But in that slow, plausible way where you mostly blame the market and not the thing you built. "It's a rough quarter." "Everything's down." "The Fed did something." Classic avoidance behavior.

## The Uncomfortable Math

At some point I decided to actually measure what the script was doing. Not vibes. Not gut feelings. Actual backtested signal quality.

The metric is called Information Coefficient (IC): basically, how well does your score *predict* which stocks will go up? A positive IC means your model has a clue. A negative IC means your model is actively pointing in the wrong direction.

My linear composite had an IC of **−0.037**.

I'll let that sink in. My carefully crafted, lovingly tuned, multi-feature signal system — incorporating RSI, momentum, MACD, volume trends, sector returns, and more — was *less useful than a coin flip*. In fact, it was worse than a coin flip. It was an elaborate, computationally expensive coin flip that landed wrong 75% of the time.

I had built a stock-picking anti-wizard.

## Why This Happened (A Brief, Humbling Interlude)

Here's the thing nobody tells you when you start mapping raw indicators to 0–100 scores: you destroy the signal.

I had spent weeks tuning those mappings. RSI of 30 maps to 85 (oversold = bullish!). Momentum decile 1 maps to 15. Very sensible. Very thoughtful. And completely wrong, because by the time you average seven of those remapped numbers together, the actual information about which stock will go up next week has been thoroughly laundered into meaninglessness.

The sub-scores looked clean. The composite looked reasonable. The predictions were garbage. This is a specific kind of pain that I recommend to anyone who wants to feel genuinely humbled by software they wrote themselves.

## The Plan: Make the Machine Do It Properly

So I did what any reasonable person does when faced with a problem of this complexity: I spent a weekend reading academic papers about it. OK that's not correct...I know the basics of ML. 😛

(This is either admirable or pathological. The jury is still out.)

The short version of the literature: for short-horizon stock return prediction with noisy daily data, you don't want a complicated model. You want **Ridge regression** — simple, regularized linear algebra — but applied to *raw* features before any manual mapping, with a quantile transform so the model doesn't freak out about regime changes.

Gradient boosting, random forests, neural nets — all tried, all worse. The market is too noisy for the smart stuff. The smart stuff overfit. The boring stuff won. This is an important life lesson that I am still processing.

## Building It Right This Time

The new approach:

1. **Raw features only** — 20 of them, spanning multi-timeframe returns, RSI, MACD, volume ratios, volatility, and sector context. No piecewise mappings. No coddling.

2. **Percentile normalization** — converts each feature to its percentile rank within the training window. A 5% monthly return means different things in a bull market vs a crash. Now the model doesn't care.

3. **Walk-forward validation** — 25 out-of-sample test windows over 15 years of data. The model never touches future data. No cheating. This is how you find out if something actually works versus if you accidentally memorized the test answers.

4. **Winsorized targets** — 5-day forward returns capped at ±3 standard deviations, because one spectacular outlier shouldn't drag the whole thing.

The walk-forward backtesting gave me numbers I could trust. Ridge came out on top with an IC of **+0.039** and 80% of windows showing a positive correlation. For reference, the old linear composite had an IC of **−0.037** and positive correlation in exactly 25% of windows — which is worse than randomly guessing.

## The Chart That Made Me Feel Better About Myself

![Cumulative P&L: Old Linear vs New Linear vs ML Ridge — numbers blurred](/images/ml-ridge-pnl.png)

That white line going down is the old system. The green line going up is ML Ridge.

I stared at this chart for longer than I'm going to admit.

The blue line is the "improved" linear composite — I had actually made some tuning changes yesterday that would probably have helped if I waited for 10 days. But Ridge still adds meaningfully on top of that. Three distinct performance trajectories, clearly separable, validated over months of signal dates. The model is not just less bad. It's actually pointing the right direction.

## The One Thing Missing (And Why It's Fine)

The intermediate linear system I created yesterday included a sentiment score from news headlines, weighted at 15%. It's a genuinely useful signal — stocks getting positive coverage tend to have short-term tailwinds.

The ML model doesn't have it.

Why? Because my market data provider doesn't provide historical headlines. I can't backtest what I can't retrieve. Training on fabricated sentiment signals would just teach the model to be confidently wrong in a new and interesting way.

So instead, I've been quietly accumulating real headline sentiment data — one row per ticker per day, with actual forward returns. In about two weeks there will be enough data to measure whether news actually predicts anything in my specific universe. If the IC is positive, I'll add it to the ML model and retrain. If not, I'll leave it out and accept that the finance Twitter consensus is occasionally wrong.

This is, in my opinion, the correct way to do things. The fact that it took me a couple of weeks to get here is a separate conversation.

## The Deployment

Every morning at 7 AM, FinBot scores all 60-ish tickers using Ridge predictions, picks the top three, runs the risk check, and executes. Same Telegram message. Same morning routine. Just less systematically incorrect.

I have extremely modest expectations. The IC of 0.039 is not "quit your job" territory. It means the model has a small, real, demonstrable edge over time — the kind that compounds quietly in the background while you do literally anything else.

Which is exactly what I wanted in the first place.

## What I've Learned

A non-exhaustive list, in ascending order of embarrassment:

1. Measuring your system is not optional. "It seems to be working" is not a metric.
2. Cleaning up a signal before feeding it to a model is not always helpful.
3. The most sophisticated model is rarely the best one. Be suspicious of complexity.
4. Academic papers about quant finance are more accessible than I expected, and more useful than I deserved.
5. A Python file that correctly predicts stock movements, even modestly, is one of the stranger things I've built. I'm not entirely sure how to feel about it.

---

*Disclaimer: Still not financial advice. The system now loses money in a more statistically principled way. Consult a professional. Don't do this. I am a software person with an unreasonable tolerance for self-inflicted complexity — act accordingly.*
