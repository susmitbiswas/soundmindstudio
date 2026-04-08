---
title: "My Phone Got 400 Alerts Yesterday. I Have Uber to Thank for Why I Actually Fixed Them."
date: 2026-04-07T10:00:00-07:00
category: "geek"
draft: false
---

There's a song. It goes like this:

*Something's broken, something's broken*
*It's your fault, it's your fault*
*Are you gonna fix it, are you gonna fix it*
*Right away, right away*

If you worked in tech between roughly 2014 and 2022, you may have just felt something move in your chest. That is the PagerDuty alert jingle — sung to the tune of "Frère Jacques" (or "Bruder Jakob," its German counterpart, a centuries-old canon that somehow became the musical backbone of engineering trauma). It's cheerful. It is chirpy. It wakes you up at 3am and it doesn't stop until you acknowledge it.

I worked at Uber. My first team was heavily on-call. I once got paged from Hawaii. Not figuratively — I was literally on vacation, sitting on a beach, and my phone started screaming the PagerDuty song. I closed my laptop, waded back out, and fixed it. That's what you do.

Yesterday, my Telegram got approximately 400 alerts. My trading system, FinBot, decided that one day was a good day to surface every latent failure it had been quietly sitting on. And because of everything Uber burned into me, I did not mute the notifications. I did not go for a walk. I opened a session and worked through every one of them.

Here's what broke and why.

## The Context: A Market in Freefall

Before the alerts, there was a regime. The tariff situation had pushed the market into what the system calls **CRISIS_SLOW** — VIX at 25, SPY down over 3% on the month, VaR gate blocking all new buys, the portfolio sitting in defensive positions. The system was doing its job, broadly.

But a stressed market regime is also a stress test for the system itself. Every edge case that doesn't matter in calm conditions suddenly matters. Thresholds get hit. Rare code paths get executed. And on April 7th, they all got hit at once.

## The Alerts, Categorized

400 alerts is a lot. Not all of them were distinct. Here's what was actually underneath them:

### Category 1: The Wrong Trade (1 alert, maximum severity)

The most alarming message came early: the system was recommending selling 148 shares of SGOV — a T-bill ETF held as a cash ballast in crisis mode. The recommendation was wrong. The regime was still CRISIS_SLOW. SGOV should stay.

The root cause was elegant in its awfulness. The `compute_regime_context()` function was failing silently on every intraday run. An `except Exception` caught the error, printed a warning nobody was reading, and returned an empty dict. The downstream code then did:

```python
regime_label = regime_ctx.get("regime", "UNKNOWN")
# "UNKNOWN" not in {"CRISIS_SLOW"} → in_regime = False
# SGOV held + not in_regime → triggers SELL
```

The safety mechanism that was supposed to protect a $14,865 position was returning "UNKNOWN" regime on every run and concluding that the T-bills should be sold. The premarket run had been fine because there was no SGOV at the time. Every run after the SGOV purchase quietly generated a bad recommendation.

A broken function wearing the costume of a working one.

### Category 2: The File Descriptor Leak Cascade (dozens of alerts)

The news evaluation job — which scans 63 tickers for market-moving headlines — started failing with `OperationalError: unable to open database file`. This looked like a SQLite problem. It was not a SQLite problem.

It was a file descriptor leak.

The Telegram manager, which runs a bot watchdog every 5 minutes (288 times per day), was opening log files with bare `open()` calls and never closing them inside exception handlers. The A/B framework registry had 12 functions doing `conn = _get_conn(); conn.close()` with no protection against exceptions between the two. The dashboard models had 15 more. Three HTTP sessions in the main signal script were created and never released.

After enough market signal runs — and there are a lot of them on a volatile day — the process exhausted its file descriptor limit. When `news_eval.py` tried to open the SQLite cache, there were no descriptors left. Every alert from this category was downstream of the same root cause: we were leaking 288 file handles per day and nobody had noticed because it takes time to fill the bucket.

The fix was context managers everywhere. `with open(...) as f:`, `with _conn_ctx() as conn:`, `with requests.Session() as sess:`. Forty-four tests, all passing. The bucket no longer leaks.

### Category 3: The Model That Was Always Degrading (continuous retrain loop)

The futures model drift monitor exists to answer: "is the model still good?" If it detects decay, it triggers a retrain. This is a good idea. The implementation had two bugs that turned it into an alarm that could never be silenced.

**Bug 1:** `check_feature_drift()` compared the model's output scores against a synthetic Gaussian distribution `N(50, 15)`. A directional trading model — one that scores high on strong buy signals and low on weak ones — will never look like a Gaussian centered at 50. So the drift check always returned "warning." Always. Every time it ran. The model was always "degrading" because the reference distribution was one it could never match.

**Bug 2:** `check_ic_decay()` was computing IC by correlating today's model score against the *past* 5-day return. IC is supposed to answer "does a high score today predict a strong return tomorrow?" This code was answering "does a high score today correlate with what already happened last week?" In a crash regime where everything is correlated and everything is down, the answer to that question is noise. The IC was meaningless and the monitor was acting on it.

Fixed: drift now compares the model's own recent output against its own older output. IC now computes forward returns from the OHLCV cache. The retrain loop stopped.

### Category 4: The Alert Deduplication That Wasn't (many duplicate alerts)

There was a 4-hour dedup window for Telegram alerts. If an alert had fired recently, the system was supposed to suppress repeats. `model_drift_monitor.py` respected this. `futures_drift_monitor.py` had the dedup logic — correctly computed `_tg_ok = False` when a recent alert existed — and then on the very next line:

```python
emit_alert_fn(..., send_telegram=True)   # ← hardcoded True
```

The dedup variable was computed and immediately discarded. One-character fix: `send_telegram=_tg_ok`. The suppression now actually suppresses.

### Category 5: The Race Condition at 07:37 (the mysterious one)

At 07:37:56, three concurrent calls to `run_all_checks(auto_retrain=True)` fired simultaneously. The cooldown check was supposed to prevent concurrent retrains. The cooldown check reads the state file, checks the timestamp, and only triggers a retrain if enough time has passed.

Three threads read the state file at the same time. None of them saw a recent retrain. All three decided to trigger one. Two emergency retrain records entered the database simultaneously and both stalled.

The underlying trigger was never fully identified — something in the scheduler or a completing background process invoked the check three times in two seconds. But the race condition in the cooldown itself was fixable: `fcntl.LOCK_EX` on a lock file makes the read-check-write atomic. Even if three callers arrive simultaneously, only one gets the lock. The others wait, then see the updated state and stand down.

### Category 6: The Timezone That Was Never There (silent IC failure)

`futures_drift_monitor.py` was computing IC on zero pairs. Not a few pairs — zero. IC over zero pairs is undefined, so it returned `insufficient_data` on every run, which triggered a permanent warning status.

The root cause: the realized returns DataFrame had a timezone-aware index (`America/New_York`). The comparison timestamps were naive. In pandas, comparing tz-aware to tz-naive raises a `TypeError`. The `TypeError` was caught by `except Exception: pass`. The function silently returned zero pairs on every call.

Three lines of fix: strip the timezone once before the loop. Suddenly the IC was computing over ~40 pairs and producing meaningful results.

### Category 7: The Data Collision (ES = NQ, literally)

During the crash, the Polygon API returned SPY data for the QQQ symbol on one run. ES and NQ reported identical prices — a physical impossibility, since ES tracks the S&P 500 and NQ tracks the NASDAQ 100, and those indices diverged significantly during the tariff selloff. The identical prices caused the ML futures scoring to produce garbage signals, which triggered drift alerts.

Fix: if ES and NQ report the same price, assume data corruption, skip ML scoring, and flag the run as bad data rather than a model failure.

## What 400 Alerts Actually Means

Most of these bugs had been there for a while. The file descriptor leak was accumulating every day. The IC calculation had been wrong since the drift monitor was written. The dedup bypass had probably been firing duplicates for weeks.

They became visible on April 7th because the market was in crisis and the system was running more often, under more load, hitting more edge cases than usual. A volatile day is a load test. This one failed it in seven distinct ways simultaneously.

This is, I think, the honest reality of running a system like this alone. The happy path gets tested constantly. The failure modes accumulate quietly until a bad day surfaces them all at once.

The Uber on-call instinct is: don't ignore the alerts. Every alert is a question the system is asking. Sometimes the answer is "this alert is wrong and should be suppressed." Sometimes it's "this alert is right and something is broken." But you have to look at each one.

By 3am, 364 tests were passing. The cascade was traced. The dedup was working. The IC was meaningful. The file descriptors were closing.

The PagerDuty song didn't play. But I would have heard it in my head regardless.

---

*← Previously: [My Trading Bot Scored 9.9 Out of 10. Now It Just Has to Keep Not Blowing Up.](/posts/10-finbot-the-system-is-the-product/)*

*Next up: [My Tests Were Green. My Safety Checks Were Broken. Both Were True at the Same Time. →](/posts/11-tests-that-lie/)*
