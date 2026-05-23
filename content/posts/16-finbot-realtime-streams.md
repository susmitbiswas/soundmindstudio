---
title: "I Replaced My Polling Loop With Real-Time Streams. The Bot Got Faster. I Got Slower."
date: 2026-05-23T11:00:00-07:00
category: "geek"
series: "finbot"
draft: false
---

![A banana engineer frantically juggling live WebSocket cables while a dusty old cron job clock sits forgotten and cobwebbed in the corner](/images/realtime-banana.png)

Polling worked.

A cron job fires once an hour, a Python script wakes up, fetches the latest prices, runs the signal, decides whether to trade, goes back to sleep. Each scan takes 7 to 12 minutes. The system produces one fresh signal per hour during market hours.

That was the baseline. Then I moved to the ☁️ cloud and upgraded to real-time WebSocket streams. The bot got faster. I got slower. Here's what I learned.

## Act 1: The Thing That Was Already Working

The original setup was straightforward. A `launchd` plist on my home Mac fired a Python script once an hour during market hours. The script called Polygon's REST API for OHLCV data, ran the scoring pipeline — daily bar features and momentum signals, a model that's been through several rounds of retraining — computed positions, and either submitted trades or logged a "no signal" and exited.

Total runtime on the home Mac: anywhere from 7 to 12 minutes per cycle, depending on data feed latency and how many tickers needed retries. One fresh signal per hour in practice.

This worked. The problems weren't with the signal itself — they were with the platform running it:

- **Home internet outages** — my ISP hiccupped, the scan missed, I found out hours later
- **macOS `launchd` sleep/wake quirks** — occasionally required manual intervention to get back on schedule
- **No alerting** — if the machine lost power during a volatile session, I wouldn't know until I checked manually

An hourly scan that runs unattended is only as reliable as the infrastructure running it.

These were real problems that deserved a real fix.

## Act 2: Moving to the Cloud

The first and most defensible decision was moving off the home server. A cloud instance — I went with DigitalOcean — gives you an always-on process, real uptime guarantees, and no dependency on whether your home router decided to update its firmware at 9:31 AM.

Setting this up was mostly straightforward. The Python environment transferred cleanly, the API keys moved over, the scheduling logic stayed the same. I set up a `systemd` service to restart the process on failure. Along the way I also tried hosting Redis on Supabase for shared state between components — a decision that seemed reasonable until the latency made it obvious it wasn't. Supabase Redis sits in a different region from a DigitalOcean droplet, and you feel that gap on every single scan cycle. State that gets read on every run cannot live somewhere that adds a round-trip tax each time. Lesson learned; Redis moved to the droplet itself. This part worked. I should have stopped adding things here.

| | Home Mac (Polling) | DigitalOcean (WebSocket) |
|---|---|---|
| **Trigger** | cron/launchd, once per hour | persistent process, continuous |
| **Signal freshness** | up to 60 min stale | minutes |
| **Failure mode** | script didn't run → silent gap | connection drops silently → false "healthy" |
| **Infrastructure code** | ~0 lines | ~800 lines |
| **Operational overhead** | none | market-hours automation, Redis co-location, heartbeat monitoring |
| **Marginal cost** | $0 | per-hour droplet rate |

Instead, flush with cloud optimism, I kept going. If I was already setting up a persistent process, why poll? Why not connect to a live feed and process events in real time? Polygon has a WebSocket API. I had a running process. What could go wrong.

The answer, as it turns out, is several things.

## Act 3: What Real-Time Actually Costs You

**🔌 WebSocket connections drop silently.** This is the first thing you learn. Not with an error — the error comes later, when you notice no events have arrived in twelve minutes. A proper WebSocket client needs a heartbeat loop, a reconnect handler with exponential backoff, a watchdog that escalates if reconnection fails repeatedly, and monitoring on all of the above. This is not a small amount of code, and every line of it is infrastructure that has nothing to do with your trading signal.

**🔀 Events arrive out of order.** During high-volume periods, the exchange isn't promising you sequential delivery. Timestamps help, but you need deduplication logic keyed on sequence numbers or event IDs, and you need to decide what to do with a bar that arrives after you've already processed a later one. The polling approach sidesteps this entirely — you ask for data up to a known timestamp and the API sorts it out for you.

**🌊 Backpressure becomes your problem.** A polling loop that takes 7 to 12 minutes to run is fine when the triggering interval accommodates it. With a WebSocket feed during a high-volatility session, events can arrive faster than your processing pipeline can consume them. The queue grows. You need to decide:

- **Process everything** — latency builds until you're minutes behind
- **Sample** — you might miss something important
- **Drop** — now you need to define "important" in real time, under pressure

Polling doesn't have this problem. If the scan takes longer than usual, you just run late.

**💸 Cloud egress adds up.** Streaming tick-level data for several hundred tickers, all day, every day, is not the same cost profile as making REST calls a dozen times per session. Tick data has volume. The API charges for it, and DigitalOcean charges for egress. Running the numbers for a full month made me revisit some assumptions about the cost-benefit of shaving latency that was already irrelevant.

**🧾 The billing model is different.** A cloud instance running a persistent WebSocket process has a per-hour rate regardless of market hours. You can stop the droplet on weekends and holidays — that's a solvable problem, not an inherent cost. But it does mean the operational overhead includes thinking about when to start and stop the instance, not just whether the signal ran correctly. The home server had none of this overhead; it just sat there, idle, at zero marginal cost. The cloud instance requires a bit more management to achieve the same.

I built all of the reconnect logic. I built the deduplication. I built a backpressure handler that sampled events under load and logged when it had to drop. It worked. It was also about 800 lines of infrastructure code that has nothing to do with the trading signal — and unlike the signal, it needs ongoing maintenance.

## Act 4: What Actually Got Better

Here is the honest accounting of what real-time changed.

Going from hourly to continuous updates is not the same as going from five-minute polls to millisecond ticks. Hourly means **events happen, and the system doesn't know for up to 60 minutes:**

| Event | Hourly polling | Real-time WebSocket |
|---|---|---|
| 📰 News breaks at 10:15 | System sees it at 11:00 (**45 min stale**) | System processes within minutes |
| 📉 Regime shifts at 9:45 | Model runs on old regime for another hour | Reacts within the same session |
| 💬 Sentiment signal surfaces at 10:30 | No effect until next scheduled run | Feeds into the next signal cycle |

Real-time closed that gap — not to milliseconds, but to *minutes*. That matters most for the intraday inputs like news sentiment, which have a time-decay problem: a headline from 9:30 AM means more at 9:32 than at 10:30.

The core model features — multi-day rolling averages, momentum across lookback windows — don't move meaningfully minute-to-minute. But the signal also incorporates intraday context, and that context degrades over an hour.

<div style="background:#f0fdf4;border-left:4px solid #22c55e;padding:0.9rem 1.2rem;margin:1.5rem 0;border-radius:0 6px 6px 0;">
✅ <strong>What's genuinely better:</strong> Signals are fresher. Intraday inputs are less stale. The system responds to market events within minutes instead of waiting for the next scheduled run. Whether this moved the P&L needle is genuinely unclear — too many confounders. What's clear: the system is now doing what it's supposed to do.
</div>

## Act 5: What Running Real-Time Actually Looks Like

The WebSocket architecture stayed. The cloud instance stayed. That was the right call.

What changed was how I think about operating it.

<div style="background:#fff7ed;border-left:4px solid #f97316;padding:0.9rem 1.2rem;margin:1.5rem 0;border-radius:0 6px 6px 0;">
⚠️ <strong>The new failure mode:</strong> A scheduled script either ran or it didn't — the absence of output was a signal. A WebSocket process can be running, connected, receiving events, <em>and</em> silently wrong in ways that require active monitoring to catch.
</div> The infrastructure I built during the streaming experiment — heartbeat loops, reconnect handlers, backpressure watchdogs — wasn't wasted. It became the operational layer that makes the system trustworthy.

A few specific things that needed solving that didn't exist in the polling world:

**Automated start/stop around market hours.** A persistent process running 24/7 with no market activity is spending money and accumulating potential drift. Startup before open, shutdown after close, handling early closes and market holidays — this is a small amount of ops work that didn't exist when launchd just fired a script and the script exited cleanly.

**State management.** The real-time architecture needed shared state between components — signal cache, position tracking, reconnect state. I initially tried hosting Redis on Supabase. Supabase Redis is geographically remote from a DigitalOcean droplet, and the round-trip on every read compounds quickly across a multi-stage pipeline. Redis is now on the droplet. Co-locate your state with your compute; this is not a new lesson but it needed to be relearned in context.

**Silent failure detection.** A WebSocket that stopped receiving events twelve minutes ago looks exactly like a WebSocket that's receiving events normally. You need explicit heartbeats, sequence-number monitoring, and alerts that fire when the event stream has been quiet longer than expected. The polling model had an implicit version of this — if the script didn't run, launchd would retry. The streaming model requires you to build that explicitly.

The workloads have since spread across dedicated infrastructure:

| Workload | Where it runs | Why |
|---|---|---|
| Live signal + WebSocket feed | DigitalOcean droplet | Latency-sensitive, must be continuous |
| News evaluation collector | DigitalOcean droplet | Always-on, feeds the live signal |
| Model retraining | Vultr | Scheduled, compute-heavy, not time-critical |
| IBKR client (Telegram-driven actions) | Home Mac | Needs local brokerage client installed |

This separation didn't come from a design document. It came from running each workload and noticing which ones cared when they were interrupted.

## The Lesson That Cost Three Weeks

Real-time is worth building when you know what you're actually buying. What I bought: fresher signals, lower latency on intraday inputs, a system that responds to market events within minutes rather than waiting for the next hourly run. That's real. The improvement is real.

What it cost: 800 lines of infrastructure that has nothing to do with the signal. Ongoing ops work that didn't exist before. A Supabase Redis bill I shouldn't have paid. Three weeks of elapsed time.

The move from a home Mac to a cloud host was unambiguously correct — uptime, reliability, and not depending on my ISP are worth it. The move from hourly polling to real-time streaming was probably worth it, with asterisks. The asterisks are the operational complexity that comes with it: silent failure modes, state co-location, market hours automation.

<div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:0.9rem 1.2rem;margin:1.5rem 0;border-radius:0 6px 6px 0;">
🔑 <strong>The lesson:</strong> The move to the cloud was unambiguously correct. The move to real-time streaming was probably worth it, with asterisks. The lesson isn't "don't build this" — it's <em>build it knowing what it costs to run, not just what it costs to build.</em>
</div>

## What Changed

- Moved from home Mac (macOS `launchd`, home internet, hourly scans) to DigitalOcean droplet (`systemd`, always-on)
- Upgraded from hourly polling to real-time WebSocket streams — signal freshness improved from once-per-hour to continuous
- Built reconnect logic, deduplication, backpressure handling, and market-hours start/stop automation as the operational layer for the streaming system
- Moved Redis from Supabase to the local droplet after measuring the round-trip cost of remote state on every scan cycle
- Split workloads across dedicated infrastructure: news evaluation on the DigitalOcean droplet, model retraining on Vultr, IBKR client on the home Mac
- Kept all the monitoring infrastructure: heartbeats, reconnect alerts, sequence-number gap detection

---

*Disclaimer: None of this is investment advice. FinBot trades real money, and the story above involves three weeks of work that made the system genuinely better and also significantly more complex to operate. Both of those things are true at the same time.*

**Previously:** [Good Code (Arguable), Wrong Assumptions →](/posts/15-good-code-wrong-assumptions/)
