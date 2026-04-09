---
title: "My Trading Bot Made 10%. Then Lost 10%. Then I Fixed the Brakes."
date: 2026-03-27
category: "geek"
series: "finbot"
draft: false
---

![The crash — account values on a very bad Thursday](/images/03262026-crash.jpg)

Last Monday I wrote a blog post about how FinBot was up 8.37% on the day while the market moved a quarter of that. I ended with a smug little line about how the system might "know something I don't."

On Thursday, the market decided to educate both of us.

## The Day Everything Went South

Here's the timeline. Going into Thursday, the account was sitting at roughly +10% cumulative — a comfortable lead over the broader market, which was up about 1.5%. I was feeling the particular brand of confidence that only comes from a few good weeks of watching green numbers on a screen. The kind that makes you think you've cracked something.

Then the crash happened.

It wasn't a gentle decline. It was the kind of market day where your Telegram bot starts pinging you with increasingly alarming updates and you watch the numbers fall in a way that makes your morning coffee taste different. By close, the account had given back nearly all of its gains. Roughly 10% down in a single session. From king to pauper in about six and a half hours.

The broader market was ugly too — but the concentrated positions that had been *amplifying* my gains on the way up were now, predictably, amplifying the losses on the way down. Leverage is a party trick that works in both directions, and on Thursday it worked in the direction I didn't want.

## The Postmortem (Not the Crying)

Here's where I could tell you that I spiraled. That I stared at charts, questioned my life choices, and briefly considered converting everything to index funds and never thinking about markets again.

Instead, I did the thing engineers do: I ran a postmortem.

And the postmortem revealed something embarrassing. The exit strategies — the ones I'd designed, coded, and felt quite proud of — **weren't actually firing.** The system was perfectly capable of identifying when positions were deteriorating. It had circuit breakers. It had drawdown detection. It had stop-loss logic. But due to a sequencing issue in how exit signals were evaluated relative to execution timing, the gates were effectively ornamental. Like having a fire alarm that's not wired to anything.

The entry logic was working beautifully. The system was getting *into* positions with all the confidence of a well-validated ML model. It just had no functional mechanism for getting *out* of them when things turned.

If you've ever deployed code that passed every test but failed in production because of an assumption you didn't know you were making — this was that. Except the test environment was my money.

## From Script to Service

Now, to be fair, I'd already started a major architectural overhaul before the crash. But the crash certainly... *accelerated* the timeline.

Over the past week or so, FinBot has undergone what I'd describe as a metamorphosis. What started as a Python script that I ran from the terminal every morning has become a proper service with multiple components:

- **A job scheduler** that manages different market sessions — premarket analysis, market open scanning, midmorning momentum checks, afternoon sweeps — each running on its own schedule with its own logic.
- **A web dashboard** for monitoring system health, reviewing signal history, and tracking job execution. Because staring at terminal logs stops being charming around the fourth week.
- **A persistent state layer** so the system remembers what it's done, what it's holding, and why. No more "starting fresh every morning and hoping for the best."
- **A proper A/B testing framework** running shadow variants in paper-trading mode alongside the live system. Multiple model variants compete silently — the challenger only gets promoted if the numbers hold up over time.

The transition from "I run a script" to "I operate a service" sounds small, but it changes everything about how you think about reliability, monitoring, and failure modes.

## The Exit Strategy Overhaul

This was the real work. The system now has exit logic at multiple levels:

**Portfolio-level protection:** If the account draws down beyond a threshold from its recent peak, the system force-deleverages — selling the weakest positions first to reduce exposure. This isn't a suggestion. It's automatic. The fire alarm is now wired to the sprinklers.

**Position-level exits:** Every position gets evaluated against a triple-barrier framework — a profit target, a stop loss calibrated to the stock's own volatility, and a time limit. If none of the first two trigger within the time window, the position gets closed anyway. No more holding losers indefinitely because the model still thinks they're "interesting."

**Regime-aware guardrails:** The system now detects what kind of market environment we're in — trending up, transitioning, sharp crash, slow grind down — and adjusts its behavior accordingly. In a crisis, it reduces the number of positions it's willing to hold, pulls back on leverage, and shifts toward defensive postures. In calmer markets, it loosens up. The point is that "one size fits all" position sizing was a mistake I'm no longer making.

**Entry circuit breaker:** When the prior day was bad *and* volatility is elevated, the system blocks new entries entirely. It can still manage and exit existing positions, but it won't add new risk into a deteriorating environment. This one is simple, but it would have saved me a meaningful chunk of Thursday's damage.

## The Sentiment Layer

One of the more fun additions — and one I've been quietly building for a while — is the sentiment analysis system.

The idea is straightforward: stock prices don't just react to numbers. They react to *narratives.* An FDA rejection, an earnings surprise, a regulatory filing — these events show up in headlines before they show up in price data. If the model is only looking at technical indicators, it's flying half-blind.

So now the system continuously monitors news headlines and SEC filings, running them through a financial language model that scores sentiment. Not just "positive or negative" — but tracking how sentiment *changes*. A stock might have neutral sentiment all week, and then suddenly the tone shifts. That shift is a signal.

Two kinds of triggers fire from this:

1. **Sudden reversal** — when a single event causes a big sentiment swing (think: surprise FDA rejection, CEO departure announcement). The system flags these for immediate position re-evaluation.
2. **Slow drift** — when sentiment gradually deteriorates over a session, like a stock getting hit with a sequence of mildly negative articles. No single one is alarming, but the cumulative effect matters. Death by a thousand cuts.

There's a cooldown mechanism so the same stock doesn't trigger alerts every five minutes — because alert fatigue is its own kind of blindness. And all the scores get cached so we're not re-analyzing the same articles on every poll cycle.

Is it a silver bullet? No. Sentiment analysis in finance is notoriously noisy. But it's another input, another perspective, another reason to pause before letting a position ride into oblivion. And combined with the technical signals, it gives the system something closer to situational awareness.

## The ML Model Health Monitor

Here's something I wish I'd built earlier: a system that watches the *model itself* for signs of degradation.

The ML model that generates trading signals isn't static — the market changes, and a model that worked brilliantly in one regime can quietly become useless in another. So now there's a monitor that tracks the model's predictive power over rolling windows. If the Information Coefficient (the measure of how well predictions correlate with actual returns) drops below a threshold, the system raises an alert. If it drops to zero — meaning the model's predictions are essentially random — it triggers an automatic retrain.

It also watches for feature distribution shifts (are the inputs the model sees today significantly different from what it trained on?) and prediction collapse (is the model just outputting the same score for everything?). A retrained challenger model has to prove itself against the current production model before it gets promoted. No more blind trust.

## Today: The Brakes Work

So here's the payoff. Today, the market continued its decline. The same conditions that would have meant another bloodbath on Thursday. And this time?

The stop gates fired. The circuit breaker engaged when it should have. Exit logic closed positions that were deteriorating before they could crater. The regime detector recognized the environment and pulled back exposure.

The result: slightly positive. Not dramatically. Not enough to write home about. But *positive* on a day the market went further down. After Thursday, I'll take "didn't lose money" as an absolute win.

The difference between Thursday and today isn't that the market was kinder. It's that the system had functional brakes.

## What I Actually Learned

1. **Entry logic without exit logic is just gambling with extra steps.** You can have the best signal model in the world, but if you can't get out of positions when they turn, you're just a sophisticated way of losing money.

2. **The jump from script to service is a mindset shift, not just an architecture one.** A script runs when you tell it to. A service is responsible for *staying running*, monitoring its own health, and handling failure gracefully. The code changes are significant, but the bigger change is accepting that the system needs to be more reliable than you are.

3. **Measure everything, especially the parts you trust.** The exit strategies existed. I'd written the code. I assumed they worked because the code looked right. They didn't. If I'd been monitoring execution — not just signals — I would have caught this before Thursday taught me the lesson at a cost.

4. **Single-day returns are noise, but single-day losses reveal structural problems.** The 8.37% gain from last week didn't teach me anything useful except overconfidence. The 10% loss taught me exactly where the system was broken.

5. **Sentiment is not a replacement for risk management, but it's a useful early warning system.** Headlines move faster than price, and having a system that reads the room — even imperfectly — gives you a few extra minutes to react. In markets, a few minutes can be everything.

## What's Next

The A/B testing framework is now running multiple model variants in shadow mode. The current production model (Ridge regression — the sensible sedan from previous posts) keeps executing live trades, while challengers paper-trade alongside it. In a few weeks, if a challenger consistently outperforms, it gets promoted. If not, Ridge keeps its job.

The sentiment system is accumulating data for eventual integration into the model's feature set. Right now it's a monitoring and alerting layer. Eventually, sentiment scores should feed directly into the prediction pipeline, giving the ML model another dimension of information to work with.

And the model health monitor is keeping watch, ready to flag the moment the market moves in a way that makes our carefully trained models obsolete.

The system is better than it was a week ago. It's more instrumented, more defensive, and more honest about its own limitations. But if there's one lesson this whole journey keeps teaching me, it's this: the next surprise is always the one you haven't planned for.

I'll be here when it arrives. Probably with my coffee going cold again.

---

*Disclaimer: Still not financial advice. This is a software engineer writing about his trading bot's growing pains. The system described here is experimental, personal, and has demonstrably lost money. Thursday proved that. Please consult an actual financial professional before making investment decisions based on anything you read here — or frankly anywhere on the internet.*

**Next up:** After the crash, I finally built the thing I should have had from the start — a proper experimentation framework. [I've Been Testing in Prod With Real Money. On Purpose. By Accident. →](/posts/09-testing-in-prod-experimentation-paper-trading/)
