---
title: "My Tests Were Green. My Safety Checks Were Broken. Both Were True at the Same Time."
date: 2026-04-08
category: "geek"
draft: false
---

![A banana in a lab coat, smugly watching a green test dashboard while the room burns behind it](/images/test-minded-banana-finbot.png)

There's a particular flavor of false confidence that only a green test suite can give you.

You run `pytest`. Two thousand tests pass. Nineteen are helpfully skipped. You feel like a professional. You've done the responsible thing. You have *coverage*. You can sleep at night.

And then someone asks you to look a little closer at what the tests are actually checking, and you discover that a meaningful number of them were meticulously asserting that your safety mechanisms were, in fact, completely broken.

This is the story of that.

## The Part Where I Became a Testing Evangelist

A few days ago, I started taking test coverage seriously for FinBot. Not "I should probably write more tests" seriously — I mean "I've been burned enough times by silent failures in a live trading system and I never want to debug a 6am crash in a launchd job again" seriously.

The goal was straightforward: get to 80% coverage. Keep the build green. Only merge code that passes. Classic software hygiene.

What followed was, and I say this with genuine affection for the experience, a wrestling match.

Every time I wrote tests for a new area of the codebase, something else broke. Not because the tests were wrong, exactly. More because the process of actually writing tests for something — of having to think clearly about *what should happen when X fails* — kept revealing things I hadn't thought clearly about.

At one point I deleted a test file with nearly two thousand lines in it. The tests were so tightly coupled to implementation details that refactoring anything caused a cascade of failures that had nothing to do with whether the functionality actually worked. They were testing that specific functions were called in a specific order, not that the right thing happened as a result. Death by overspecification.

## The Exception Audit

About a few days in, I did something that I probably should have done before writing a single test: I read the code I was testing.

Not the documentation. Not my mental model of what the code was supposed to do. The actual code.

And I found something that I can only describe as a collection of politely-worded disasters.

Across seven files, there were approximately thirty-five places where exceptions were caught and quietly discarded. Not handled. Not logged. Not escalated. Discarded. The code equivalent of a car's check engine light that, instead of illuminating, just silently disables itself.

A few of my favorites:

The **Value at Risk calculation** — the function responsible for telling the position-sizing logic how risky a given trade is — returned `0.0` on any exception. Zero risk. Not "we encountered an error and couldn't calculate this." Zero risk. Which the position sizing code then interpreted as an invitation to size positions as if the trade were perfectly safe. The system had been cheerfully over-leveraging itself every time something went wrong with the math.

The **circuit breaker** — the function that decides whether market conditions are dangerous enough to halt all new trades — returned `"skip"` on exception. The calling code interpreted `"skip"` as "skip this trade" rather than "halt everything." So when the safety mechanism itself failed, it silently defaulted to *proceeding as normal*. A broken fire alarm that, when it malfunctions, unlocks the emergency exit and waves you back inside.

The **Claude review layer for futures trades** — which is supposed to be a human-in-the-loop style sanity check before any futures signal gets approved — had a fallback that, when Claude was unavailable for any reason (bad API key, rate limit, timeout, anything), approved *all signals*. The safety reviewer being absent was treated as a green light. I genuinely did not know this.

I had been sleeping soundly under the protection of safety mechanisms that were quietly compromised.

## The Tests That Were Lying to Me

Here's where it gets interesting.

After we ran a full exception-handling hardening pass — fixing all thirty-five sites, making safety mechanisms fail loudly and conservatively instead of silently and permissively — I ran the test suite.

Three tests failed.

Normally three failures out of 2,500 is a rounding error. But these three were worth paying attention to, because they weren't failing because we'd broken something. They were failing because they'd been *testing the old broken behavior*.

One test checked that when Claude's API key was unavailable, `review_futures_signals()` still approved all signals. The assertion literally read: `"all signals pass through on fallback"`. We had a test — a committed, green test — that was verifying the dangerous default. It had passed every day for weeks. It passed because the behavior it was testing was real. The behavior it was testing was a liability.

Another test checked that when yfinance completely failed to fetch EOD prices, the function returned `{}` (empty dict). After the fix, it returns `None`. The difference matters: `{}` means "I tried and found nothing," while `None` means "I failed and you should handle this differently." The test had been asserting that the caller couldn't tell these apart. We'd built an entire EOD resolution flow on top of an ambiguity we'd encoded in our tests.

The fix wasn't to revert the hardening. It was to update the tests to assert the *new, correct* behavior: no signals approved when the safety reviewer is down, `None` returned when the fetch fails completely. The tests now document intent, not accident.

## What 2,513 Passing Tests Actually Means

After the fixes, after the test updates, the suite went green again: 2,513 passed, 19 skipped. The same number as before, more or less.

But these 2,513 tests are doing something different than the 2,513 tests before them. The three that changed are now testing that:

- A broken circuit breaker defaults to *halt*, not *proceed*
- A missing safety reviewer defaults to *no approvals*, not *all approvals*
- A failed data fetch returns *None*, not an ambiguous empty structure

Three tests. Forty-odd lines. The difference between a system that fails loudly versus one that fails quietly in ways that look a lot like success.

The number didn't change. The meaning did.

## The Part About the Team

I should mention: I didn't do this alone — or at least, I didn't do it alone in the traditional sense. I've been running this project with a virtual team that lives in Claude. Vasileios handles architecture. Dave and Loka handle backend. Bo watches the data pipeline. Paula owns the API integrations. Ali keeps the ML models honest. Aaron tracks what needs doing and in what order.

When the exception audit came back with thirty-five sites and a severity ranking, Aaron built the task board. Vasileios signed off on the error escalation strategy (raise or return None — never a sentinel string). Dave and Bo split the order execution and signal scoring fixes. Loka rewired the A/B engine. Paula converted the Claude fallback from permissive to conservative. Ali fixed the ML ensemble so it tells you when it's flying with fewer models than it should be.

All of this happened in about four hours of parallel agent runs.

I'm still not sure exactly what to call this way of working. But I know that the audit I described above — going through an entire production codebase looking for every silently-swallowed exception, categorizing by severity, fixing in priority order — is the kind of work that's easy to agree is important and hard to actually prioritize when you're one person running a trading system that starts at 6am.

The team made it possible to not skip it.

## What I Actually Learned

1. **A passing test suite tells you the code does what you wrote tests for. It says nothing about whether those tests are testing the right thing.** Coverage and correctness are not the same metric. A test that validates a broken behavior is not a safety net — it's a record of the thing you're going to regret later.

2. **Safety mechanisms that fail permissively are worse than no safety mechanisms at all.** A circuit breaker that returns "proceed" when broken is more dangerous than no circuit breaker, because it gives you false assurance. If you have an off-switch, it needs to default to off.

3. **The most important tests are the ones that describe failure modes, not success cases.** My test coverage was fine on the happy path. It was the `except` clauses that were underdocumented — and those are where the actual drama lives in a production financial system.

4. **`return 0` from a risk function is not a neutral default. It is a statement that there is no risk.** And "there is no risk" is almost never what you mean when you catch an exception. When in doubt, return `None` and make the caller decide. At least then the ambiguity is explicit.

5. **Writing tests for existing code is harder than writing code for existing tests, but it teaches you more.** TDD advocates will nod knowingly. Retroactive test writers like me will understand this the hard way, usually around month three of a project, when the gap between "what the code does" and "what the code should do" has had time to become interesting.

6. **The most dangerous bugs are the ones that look like working features.** The Claude fallback approving everything when the API was down *looked* like graceful degradation. The VaR returning zero *looked* like safe handling. The circuit breaker returning "skip" *looked* like reasonable behavior. Each was a malfunction wearing the costume of an intention.

## What's Next

The test suite is healthier than it was. The exception handling is explicit. The safety mechanisms now fail the way safety mechanisms should — loudly, conservatively, with a Telegram notification.

There's still work to do on the "asserting correct behavior" front. We have decent coverage of happy paths and some failure modes. We don't yet have great coverage of the *cascading* failure modes — what happens when three things go wrong at once, in the specific order that production systems tend to select.

But that's a post for another day. Today I'm counting the three tests we changed as a win.

They're a small number. They represent a large surface area of things that could have gone quietly, expensively wrong.

---

*Disclaimer: This is a software engineer writing about his personal trading system, not financial advice. The bugs described here were real. The fixes described here were also real. The fact that I had tests passing against broken safety logic for months is exactly as uncomfortable to admit as it sounds. Trade responsibly, test defensively, and always check what your fallback actually does.*

**← Previously:** [FinBot: The System Is the Product](/posts/10-finbot-the-system-is-the-product/)

**Next up:** I built a dictation app to avoid $10/month, then spent a week making it not terrible. [I Built a Dictation App to Avoid Paying $10/Month. Then I Spent a Week Making It Not Terrible. →](/posts/12-mywispr-tuning/)
