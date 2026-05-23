---
title: "I Built a System to Watch My System. The Watcher Needed a Watcher."
date: 2026-05-25T09:00:00-07:00
category: "geek"
series: "finbot"
draft: false
---

![A banana confidently monitoring a green SYSTEM HEALTHY dashboard while through a window behind them a second monitor shows the monitoring system itself has a red error light](/images/watchdog-banana.png)

The most dangerous kind of broken system is one that tells you it's fine. 😬

A silent failure is at least honest. It fails, the logs stay empty, eventually you go looking and find the problem. The absence of output is a signal, if a quiet one. But a system that actively reports "healthy" while being wrong — that's the failure mode that earns the most expensive lessons. You're not getting silence. You're getting false confidence, delivered on a schedule, formatted nicely, sent to your phone.

Post 15 mentioned this briefly: a health monitor woke me up one morning with two alerts — model drift and a broken ensemble health guard. The fixes were described as "relatively surgical." That was accurate, but it glossed over the part that was actually interesting: the ensemble guard had been broken for weeks. Every morning during those weeks, I had glanced at "ensemble: healthy" in the logs and moved on with my day.

This is the longer version of that story.

## Act 1: Why the Watchdog Exists

FinBot runs autonomously. Launchd fires it every morning. It fetches data, scores a universe of tickers, generates signals, and places orders. Nobody is watching this happen in real time — that's the whole point.

The problem with autonomous systems: **they fail quietly.** Two distinct failure modes drove the monitoring design:

| Failure mode | What happens | The monitor that catches it |
|---|---|---|
| **Model drift** | Regime changes, momentum features invert, IC goes negative — system keeps trading in the wrong direction | IC monitor: rolling correlation check with Telegram alert |
| **Single-model degradation** | One model silently breaks; system runs on a single degraded model with no fallback | Ensemble guard: requires ≥2 healthy validated models before trading proceeds |

Both checks exist because I got tired of discovering that something had been wrong for *days*. The alerts are Telegram messages. They're not subtle.

So I built the monitors. I deployed the monitors. The monitors ran. One of them had a bug.

## Act 2: The Ensemble Guard Bug

The guard's job is straightforward: load all configured models, validate each one, count the healthy ones, halt if the count is below the threshold.

What "healthy" means for a model: the file loads without error, the feature count matches what the model expects, and a quick validation run on recent data doesn't produce nonsense (IC above a floor, predictions within a reasonable range). A model can be *loaded* — meaning the file exists and imports cleanly — without being *healthy*. These are different things.

The bug conflated them.

Somewhere in a refactor of the model loading logic — I traced it back to a session several weeks prior where I'd restructured how models were initialized — the health check had been wired to count loaded models rather than validated models. The variable names were close enough that the error wasn't obvious at a glance. The logic looked like:

```python
# Bug (simplified):
healthy_models = sum(1 for m in models if m.loaded)

if healthy_models >= 2:
    halt()  # backwards
proceed()
```

Two problems. First, `m.loaded` was checking load status, not validation status. Second, the halt condition was inverted — the system halted when it had *two or more* models and proceeded when it had fewer. The opposite of the intended behavior.

In practice: one model was loaded and failing health validation. The second wasn't loading at all due to a file path issue from the same refactor. The guard checked, found `1 >= 2` was False, and — because the condition was inverted — proceeded.

```python
# Fix:
healthy_models = sum(1 for m in models if m.is_healthy())

if healthy_models < 2:
    halt()
proceed()
```

<div style="background:#fff7ed;border-left:4px solid #f97316;padding:0.9rem 1.2rem;margin:1.5rem 0;border-radius:0 6px 6px 0;">
⚠️ <strong>The bug in full:</strong> A <code>&lt;</code> vs <code>&gt;=</code> sign flip, plus counting loaded models instead of <em>validated</em> ones. Six weeks of false "ensemble: healthy" logs. 6am is not when you catch one-character bugs — you're reading code the way you <em>want</em> it to work, not the way it does.
</div>

What made this worse: the guard was logging "ensemble: healthy" as part of its normal status output. The log line came from a different part of the code, upstream of the validation check, and reflected the outcome of the load step rather than the health check. So the logs were accurate about what they were measuring. They just weren't measuring the right thing.

## Act 3: The Model Drift That Actually Got Caught

While the ensemble guard was quietly broken, the IC monitor was working correctly. Worth pausing on this — it would be easy to walk away from this story thinking all the monitoring was useless.

**What happened in late March:**

1. A sharp market reversal inverted the momentum features the model depended on
2. The rolling IC moved from positive to meaningfully negative over ~two weeks
3. The IC monitor crossed its alert threshold → Telegram alert fired 📱
4. I retrained → IC recovered to positive territory within the following week

The window and threshold choices mattered. IC computed over a short window is noisy — false alarms that cost unnecessary retraining runs. A longer rolling window smooths that out: a consistently negative IC over that window is a real signal, not just a bad week.

<div style="background:#f0fdf4;border-left:4px solid #22c55e;padding:0.9rem 1.2rem;margin:1.5rem 0;border-radius:0 6px 6px 0;">
✅ <strong>The IC monitor worked exactly as designed.</strong> The ensemble guard is the part of this story that <em>looked</em> like it was working.
</div>

## Act 4: The Meta-Problem

The ensemble guard bug was found and fixed. The natural reaction is to move on.

The second reaction — the one that took a few hours to arrive — was the more useful one: *how long had this been broken?*

The answer, traced through git history and launchd logs, was approximately six weeks. For six weeks, the system had been trading on a single model while the ensemble guard reported a healthy ensemble. Every morning I had looked at the health summary. Every morning I had seen what I expected to see. The monitor was running. It was just wrong about what it was monitoring.

The principle that surfaced from this:

<div style="background:#fef2f2;border-left:4px solid #ef4444;padding:0.9rem 1.2rem;margin:1.5rem 0;border-radius:0 6px 6px 0;">
🚨 <strong>The meta-problem:</strong> <em>Monitoring systems need tests. Not just the things they monitor. The monitors themselves.</em><br><br>
The health guard was testing the trading system. I had mentally categorized it as infrastructure — the thing that checks other things — so it never made it into the test suite. Infrastructure doesn't usually need to be checked. Except when it does.
</div>

This sounds obvious after the fact. It didn't feel obvious before.

<div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:0.9rem 1.2rem;margin:1.5rem 0;border-radius:0 6px 6px 0;">
💡 <strong>Think about it this way:</strong> A monitoring system that isn't tested is an assertion about the system's health that you've never verified. Every morning you read it, you're extending trust to a piece of code you haven't validated. You don't know if it's checking the right thing. You don't know if the check logic is correct. You don't know if the alert would actually fire if the condition were met.<br><br>
👉 In my case, the answer to all three was "no, incorrectly, and maybe."
</div>

## Act 5: How the Monitors Are Now Tested

The fix was to put the monitoring logic in scope for the test suite. This meant writing tests for the health checks themselves — not for the models or the trading logic, but for the code that checks whether those things are working.

The ensemble guard tests cover the specific cases that the original bug would have caught:

```python
def test_ensemble_guard_halts_with_zero_healthy():
    guard = EnsembleHealthGuard(min_healthy=2)
    result = guard.check(healthy_count=0)
    assert result.should_halt is True

def test_ensemble_guard_halts_with_one_healthy():
    guard = EnsembleHealthGuard(min_healthy=2)
    result = guard.check(healthy_count=1)
    assert result.should_halt is True

def test_ensemble_guard_proceeds_with_two_healthy():
    guard = EnsembleHealthGuard(min_healthy=2)
    result = guard.check(healthy_count=2)
    assert result.should_halt is False

def test_loaded_but_unhealthy_model_counts_as_zero():
    model = MockModel(loaded=True, healthy=False)
    assert model.is_healthy() is False
    guard = EnsembleHealthGuard(min_healthy=2)
    count = guard.count_healthy([model])
    assert count == 0
```

The last test is the one that would have caught the original bug. A loaded model that fails health validation should contribute zero to the healthy count, not one. The old code was counting it as one.

The IC monitor tests verify that the alert fires when and only when it should:

```python
def test_ic_monitor_alerts_below_threshold():
    monitor = ICMonitor(threshold=ALERT_THRESHOLD, window=IC_WINDOW)
    # Simulate rolling IC well below the alert threshold
    alert = monitor.evaluate(rolling_ic=BELOW_THRESHOLD_IC)
    assert alert.should_fire is True

def test_ic_monitor_no_alert_above_threshold():
    monitor = ICMonitor(threshold=ALERT_THRESHOLD, window=IC_WINDOW)
    alert = monitor.evaluate(rolling_ic=ABOVE_THRESHOLD_IC)
    assert alert.should_fire is False
```

These tests run as part of the daily pytest gate before any code gets promoted to the production directory. The monitors are now in scope.

One additional change: at startup, the health monitor now logs its own configuration — which models it's watching, what thresholds it's using, what alert channels are wired, and what the minimum healthy count is. This makes it possible to verify the monitor's setup by reading the logs, without having to reproduce a failure to see what the monitor would do.

## Act 6: What the Full Stack Looks Like Now

The health monitoring system has five checks. All five are tested.

| Check | What It Monitors | Alert Condition | Tested? |
|---|---|---|---|
| **IC Monitor** | Rolling IC over a sliding window | IC drops below threshold | Yes |
| **Ensemble Guard** | Healthy *validated* models (not just loaded) | Healthy count < 2 | Yes |
| **Data Freshness** | Price data recency during market hours | No update in 2+ hours | Yes |
| **Signal Staleness** | Top-ranked ticker variation across runs | Identical rankings 3 runs in a row | Yes |
| **Daily Summary** | Everything above | Sent every morning regardless | Yes |

**Model IC monitor**: computes rolling IC over a sliding window, sends a Telegram alert when IC drops below a configured threshold. Tested for threshold boundaries and alert formatting.

**Ensemble guard**: requires at least two models to pass health validation before trading proceeds. Halts and alerts if the count is below the minimum. Now correctly distinguishing loaded from healthy.

**Data freshness check**: alerts if price data hasn't updated in more than two hours during market hours. This catches upstream data feed issues before they reach the scoring loop — a model that scores on stale prices is doing something, but not what you want.

**Signal staleness check**: alerts if the top-ranked tickers haven't changed at all across three consecutive runs. A perfectly static ranking is a sign of a stuck cache or a data feed that's returning the same values over and over. Legitimate signal outputs have some variation.

**Daily summary**: every morning, a Telegram message with rolling IC, trade count, P&L delta, model health status, and which alerts fired in the last 24 hours. This is the message I was reading every morning and feeling comfortable about. Now it contains the right numbers.

Each check exists because something went wrong without it. The IC monitor came first, after a regime change I didn't catch. The ensemble guard came after a model file went missing and the system didn't notice. The freshness and staleness checks came after the 401 debugging session in post 15 surfaced how many ways a data feed can fail silently. The daily summary came after I realized I had no consolidated view of whether any of the individual alerts had fired.

<div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:0.9rem 1.2rem;margin:1.5rem 0;border-radius:0 6px 6px 0;">
🔑 <strong>The goal:</strong> The current stack doesn't prevent failures. It just makes them louder and faster. The goal isn't to build a system that never breaks — it's to build a system where you find out it's broken <em>before it's been broken for six weeks.</em>
</div>

## What Changed

- Fixed ensemble guard logic inversion — the halt condition was `>= 2` where it should have been `< 2`, and healthy-model counting was using load status instead of validation status
- Added unit tests for all health monitor conditions, including the specific case that the original bug would have caught: a loaded-but-unhealthy model must count as zero, not one
- Added configuration logging at monitor startup — model list, thresholds, alert channels, and minimum healthy count are logged on every run for easy verification
- Added data freshness check that alerts when price data is stale during market hours
- Added signal staleness check that alerts when top-ranked tickers are identical across three consecutive runs
- Retrained the model after the IC drift alert fired; IC recovered to positive territory over the following week

The monitoring is now tested. The monitors are now honest about what they're measuring. The daily summary now reflects the actual state of the system rather than the state I assumed the system was in.

That distinction — between what a system reports and what a system is doing — is the one that cost six weeks of false confidence and a retraining run that could have come sooner.

---

*Disclaimer: None of this is investment advice. FinBot trades real money and today's story is a case study in how a system can be simultaneously running and wrong without announcing either fact clearly. If you're building autonomous systems, consider adding tests for your monitors — not just for the things your monitors watch. The failure mode where your watchdog has a bug is not theoretical.*

**Previously:** [The Verdict Is In on My News Signal. It Works. Just Not the Way I Expected. →](/posts/17-finbot-news-signal-verdict/)
