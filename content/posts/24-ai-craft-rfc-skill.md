---
title: "An RFC Is a Request for Comments. Most of Mine Used to Get None."
date: 2026-06-11T17:00:00-07:00
category: "geek"
series: "ai-craft"
draft: false
---

![A banana architect in a hard hat presenting a tidy blueprint titled RFC on an easel to a row of nodding robot reviewers, while a giant chaotic wall of text crumbles in the background](/images/rfc-skill-banana.png)

The name says it out loud: an RFC is a **Request For Comments**. You write a document, you hand it to your peers, and you ask them to think with you. That's the whole point — comments.

For years, mine got none. Not because the ideas were bad, but because the document was a wall of text and busy people bounce off walls of text. A reviewer opens a 12-page RFC with no structure, scrolls once, thinks "I'll get to this later," and never does. You asked for comments and built a document that quietly discouraged them. 🙃

So over several years I converged on a structure. The same sections, in the same order, every time — tuned for one thing: a reviewer can open it, *get it*, and leave a useful comment in the time they actually have. And recently I did the obvious thing: I turned that structure into a skill my AI runs, so I never have to remember it again.

## The Skeleton

Here's the structure. Every RFC I write now hangs on these bones:

| Section | The job it does |
|---|---|
| **TL;DR** | Why we're doing it, how, and how we'll know it worked — in a few lines, at the very top |
| **Context** | What it is, why, why *now*, what happens if we don't |
| **Approach** | How we plan to do it |
| **Alternatives + tradeoff table** | What else we considered, scored honestly |
| **Metrics & success criteria** | The numbers that decide whether this worked |
| **Milestones** | The path broken into pieces worth celebrating |
| **Diagram** | The picture that replaces a section you'd never read |
| **Risks & mitigations** | What could go wrong and what we'll do about it |
| **Appendix** | Everything a curious reader wants and a busy one can skip |

The order isn't decoration. It's the pyramid — but I'll come back to that, because it's the load-bearing idea.

## TL;DR at the Top, Always

The first thing in the document is the last thing most people will read. So it has to carry the whole argument on its own. A good TL;DR answers three questions and nothing else:

- **Why** are we doing this?
- **How** are we going to do it?
- **How will we measure** that it succeeded?

<div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:0.9rem 1.2rem;margin:1.5rem 0;border-radius:0 6px 6px 0;">
💡 <strong>The test for a TL;DR:</strong> if a busy VP reads only those few lines and walks away knowing what you're doing and how you'll prove it worked, it's done its job. If they have to scroll to understand the point, the TL;DR failed and so did the document.
</div>

## Context: The Questions Every RFC Has to Answer

This is the section that earns the reader's trust, and it's just a set of honest answers:

- **What is it?**
- **Why are we doing it?**
- **Why is it important to do *now*?** (the question most RFCs skip — and the one reviewers most want answered)
- **What if we don't do it?** (the cost of inaction is part of the case)
- **How do we plan to do it?**
- **What are the alternatives?**

That "why now" and "what if we don't" pair is where weak proposals quietly fall apart. If you can't answer them, the work may not belong in this quarter — and it's better to learn that from your own document than from a reviewer.

## The Tradeoff Table

When I get to alternatives, I don't write paragraphs. Paragraphs hide the comparison. I use a table — options across the columns, criteria down the rows, every cell marked **(+)**, **(=)**, or **(−)** and color-coded so the shape of the decision is visible at a glance. A verdict goes *above* the table, never inside it.

Here's the format, rendered the way it actually looks:

**VERDICT: Managed push service — it wins on latency and scalability, and the added vendor dependency is an acceptable, reversible cost.**

<table style="border-collapse:collapse;width:100%;font-size:0.92rem;margin:1rem 0;">
<tr>
<td style="background:#BDD7EE;border:1px solid #aaa;padding:8px;font-weight:bold;">Criteria</td>
<td style="background:#BDD7EE;border:1px solid #aaa;padding:8px;font-weight:bold;text-align:center;">A: Polling</td>
<td style="background:#BDD7EE;border:1px solid #aaa;padding:8px;font-weight:bold;text-align:center;">B: WebSockets</td>
<td style="background:#BDD7EE;border:1px solid #aaa;padding:8px;font-weight:bold;text-align:center;">C: Managed push</td>
</tr>
<tr>
<td style="background:#BDD7EE;border:1px solid #aaa;padding:8px;font-weight:bold;">Description</td>
<td style="border:1px solid #aaa;padding:8px;">Client asks on a timer.</td>
<td style="border:1px solid #aaa;padding:8px;">Persistent server connection.</td>
<td style="border:1px solid #aaa;padding:8px;">Third-party delivery service.</td>
</tr>
<tr>
<td style="background:#BDD7EE;border:1px solid #aaa;padding:8px;font-weight:bold;">Latency</td>
<td style="background:#FCE4D6;border:1px solid #aaa;padding:8px;">🔴 (−) Seconds of lag</td>
<td style="background:#E2EFDA;border:1px solid #aaa;padding:8px;">🟢 (+) Real-time</td>
<td style="background:#E2EFDA;border:1px solid #aaa;padding:8px;">🟢 (+) Real-time</td>
</tr>
<tr>
<td style="background:#BDD7EE;border:1px solid #aaa;padding:8px;font-weight:bold;">Complexity</td>
<td style="background:#E2EFDA;border:1px solid #aaa;padding:8px;">🟢 (+) Trivial</td>
<td style="background:#FCE4D6;border:1px solid #aaa;padding:8px;">🔴 (−) Connection state to manage</td>
<td style="background:#FFF2CC;border:1px solid #aaa;padding:8px;">🟡 (=) SDK, but a dependency</td>
</tr>
<tr>
<td style="background:#BDD7EE;border:1px solid #aaa;padding:8px;font-weight:bold;">Scalability</td>
<td style="background:#FCE4D6;border:1px solid #aaa;padding:8px;">🔴 (−) Wasteful at scale</td>
<td style="background:#FFF2CC;border:1px solid #aaa;padding:8px;">🟡 (=) Needs careful infra</td>
<td style="background:#E2EFDA;border:1px solid #aaa;padding:8px;">🟢 (+) Their problem, not yours</td>
</tr>
<tr>
<td style="background:#BDD7EE;border:1px solid #aaa;padding:8px;font-weight:bold;">Reversibility</td>
<td style="background:#E2EFDA;border:1px solid #aaa;padding:8px;">🟢 (+) Easy to rip out</td>
<td style="background:#FFF2CC;border:1px solid #aaa;padding:8px;">🟡 (=) Moderate</td>
<td style="background:#FFF2CC;border:1px solid #aaa;padding:8px;">🟡 (=) Vendor lock, but exit-able</td>
</tr>
</table>

You can decide that in five seconds. That's the point — the color does the arguing so the reader doesn't have to reconstruct it from prose.

## Metrics and Success Criteria

If you can't say how you'll measure success, you don't have a goal — you have a vibe. Every RFC names the metrics up front, because without them, six months later nobody can honestly say whether the thing worked. (This is the same "so what?" smell test from the [last post](/posts/23-ai-craft-why-so-what/), living in a document: state the measurable outcome, or admit there isn't one.)

## Milestones — Don't Save the Celebration for December 31

This one I feel strongly about. If you work on something for a whole year, produce all the code on December 31, ship it, and celebrate once — that's not a triumph, it's a bad engineering practice.

<div style="background:#fff7ed;border-left:4px solid #f97316;padding:0.9rem 1.2rem;margin:1.5rem 0;border-radius:0 6px 6px 0;">
⚠️ <strong>The big-bang trap:</strong> a year of invisible work ending in one giant drop is a year of unverified assumptions, no feedback, and a single terrifying release. Break it into milestones. At each one, ship something real, celebrate, and re-share what's next. The doc that lists those milestones is the doc that lets people see the path instead of trusting a leap.
</div>

## A Diagram Is Worth More Than a Thousand Words

A picture is worth a thousand words. In an RFC it's often worth more — because the alternative isn't a thousand words a reviewer reads carefully, it's a wall of text they skip entirely. If a diagram can carry the architecture, the diagram goes in and the wall comes out. I add one wherever it's remotely possible.

## Risks and Mitigations

Naming a risk doesn't make a project riskier. It makes it *less* risky — because the moment a risk has a written mitigation next to it, you've already decided what you'll do when it shows up, instead of improvising during the incident. A project whose risks are listed and handled is a calmer project than one that pretends it has none.

## The Idea Holding It All Together: Naomi-isms

I write the whole document following two principles from **[Naomi Gleit](https://naomi.com/canonical-everything-c85441a84e70)**, Meta's Head of Product (employee #29). Her best practices got repeated to so many PMs that people started calling them "Naomi-isms."

The most famous is **Canonical Everything**: there should be *one* document — the canonical doc — that holds the basic, critical information and links out to all the deeper detail. One source of truth, not five competing half-versions. An RFC should *be* that doc.

The one I lean on most for readability is her pyramid — the **School Pyramid**. You write so the top is understandable by a high-schooler. Go one level down and a college grad follows it. One more, and the specialist gets their depth. The mistake is writing the whole thing at the PhD level, where only a few people can read it — then the document loses its value, because most of your reviewers can't engage with it.

<div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:0.9rem 1.2rem;margin:1.5rem 0;border-radius:0 6px 6px 0;">
🔑 <strong>Why there's an appendix:</strong> the pyramid is exactly why the gnarly, queried-to-death details go in an appendix, not the body. The main document stays readable top-to-bottom for everyone; the reader who wants the deep end follows a link and dives. Structure is what lets one document serve the high-schooler and the PhD at the same time.
</div>

## The Part Where AI Comes In

Here's what closes the loop with the rest of this series. Every section above is something I used to remember — or, honestly, half-remember and skip when I was rushing. So I codified it. The whole framework is now a **skill** I use to draft RFCs at work.

When I ask my AI to start an RFC, it doesn't hand me a blank page. It produces this skeleton, asks me the Context questions I'd otherwise skip — *why now? what if we don't?* — builds the tradeoff table in my exact color format, insists on a measurable success criterion, and pushes the deep details down into the appendix where the pyramid wants them. The framework stopped being discipline I had to summon and became structure the tool enforces.

That's the same move as the [why / so-what post](/posts/23-ai-craft-why-so-what/): a good judgment, written down once, applied by the AI every time after. An RFC is just the "why" and the "so what" in document form — canonical, structured, and readable enough that someone actually leaves a comment.

## What Changed

- Every RFC opens with a TL;DR that answers why, how, and how-we'll-measure-it — readable on its own by someone who reads nothing else
- Alternatives are a color-coded tradeoff table with the verdict above it, not paragraphs that hide the comparison
- No RFC ships without named metrics and milestones — success is measurable, and the work is broken into pieces worth celebrating before December 31
- Deep and frequently-queried details live in an appendix, so the body stays readable at every level of the School Pyramid
- The whole structure is now a skill my AI runs, so the framework is enforced by default instead of remembered by luck — and the documents finally get the comments their name asks for

*Note: Fifth post in the ai-craft series. Builds directly on the [why / so-what frameworks](/posts/23-ai-craft-why-so-what/). [The series starts here.](/posts/19-ai-craft-three-assistants/)*
