---
title: "I Built a Dictation App to Avoid Paying $10/Month. Then I Spent a Week Making It Not Terrible."
date: 2026-04-08T01:00:00-07:00
category: "geek"
draft: false
---

![A banana with headphones, a stopwatch, and three tiny race cars on a desk — measuring before optimizing](/images/banana-listens.png)

There is a $10/month dictation app called Wispr Flow that is very good. It runs locally on Apple Silicon, it types your words into whatever app you're using, and it costs $10 a month.

I refuse to pay it.

Not because I couldn't. Not because $10 is a lot of money. But because I *know* what's inside that box — it's a Whisper model and an LLM doing cleanup — and I have both of those things available to me at a cost that, with careful engineering, approaches three cents a month. Maybe less.

So I built MyWispr. And then I spent a week making it fast. And somewhere in that week I learned more about how to actually tune a software pipeline than I probably would have from a textbook, because nothing focuses the mind like your own tooling being slow while you're trying to use it to send a message.

## What It Is

MyWispr is a macOS menu bar app. Hold Right Option, speak, release. Your words appear in whatever app you were using, cleaned up, pasted directly.

Under the hood:
- **mlx-whisper** (large-v3-turbo) does the transcription on the Apple Silicon Neural Engine
- **Claude Haiku** polishes the output — fixes punctuation, removes filler words, generally makes me sound less like I'm describing something while waking up
- The result gets pasted via Quartz event injection, which sounds fancy and is, in fact, exactly as fun as it sounds

The whole thing costs me roughly a tenth of a cent per dictation. Sometimes less. I keep a running total in my head and it brings me genuine, specific joy.

## It Started as a Script

The first version was a Python script with a keyboard shortcut. It worked. It was also approximately 8 seconds from release to paste, which is fine if you're a very patient person and not fine if you're me.

That number — 8 seconds — is the kind of number that sounds manageable until you use the tool fifty times in a day. Then it becomes personal.

The first lesson of performance work is: before you optimize anything, find out where the time is actually going. This is advice I have seen in many places and periodically ignored in many projects. This time I listened to it.

## Measure First. Optimize Regret Later.

I added a `TimingSession` — a lightweight dataclass that marks timestamps at every stage of the pipeline: audio stop, silence trim, Whisper start, Whisper done, Claude start, first token, stream complete, clipboard write, paste inject.

After every dictation, it prints this:

```
━━━ MyWispr Timing Report ━━━━━━━━━━━━━━━━━━━━━
  tech vocab prompt : on
  audio duration   : 3.2s
  raw words        : 18
  polished words   : 16

  audio stop+concat:    12ms
  silence trim     :     4ms
  whisper          :   820ms
    └─ first token :   480ms
  claude (total)   :  1340ms
  clipboard write  :    22ms
  paste inject     :    55ms
  ─────────────────────────────
  TOTAL            :  2253ms
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

This is when the mystery became a puzzle, which is a much more useful thing to have.

Whisper: ~800ms. Claude: ~1300ms. Paste mechanics: ~80ms. Audio handling: trivial.

The pipeline wasn't slow everywhere. It was slow in two specific places. Now I knew which levers to pull.

## The Fails, In Roughly Chronological Order

### Attempt 1: beam_size=1

Classic move: I read that Whisper's default beam search (beam_size=5) is slower than greedy decoding (beam_size=1), and that you can get 30-50% speed improvement with minimal quality loss, since Claude is going to polish the output anyway.

I added `beam_size=1` to the `mlx_whisper.transcribe()` call, committed it with a very confident commit message, and moved on.

Two commits later I discovered that mlx-whisper doesn't implement beam search. It only does greedy decoding. `beam_size` is not a valid parameter. The implementation had been silently ignoring my very confident argument this entire time, running exactly as fast as it always had.

The parameter was removed. My commit message history contains the evidence.

### Attempt 2: max_tokens=256

Claude Haiku is already fast. But I figured: most of my dictations are short, the output is just a cleaned-up version of the input, surely 256 tokens is plenty.

It was plenty for 90% of dictations. For the other 10% — the ones where I'd dictated three or four sentences — the output just stopped. Mid-sentence. Cleanly truncated. As if the model had decided that was the natural conclusion of my thought.

I noticed this because the pasted text ended abruptly and I sat there re-reading it, convinced I had said something more interesting than I apparently had.

Reverted to 1024. The 256-token "optimization" lasted approximately forty minutes.

### Attempt 3: Russian

Before I added `language="en"` to the Whisper call, the model was doing its own thing with language detection. On short clips — a few words, maybe just a brief "um" before I'd found my thought — it would sometimes output what I can only describe as enthusiastic Russian.

Not a transliteration. Not a transcription error. Russian. Full Cyrillic. As if the model had decided my brief audio sample was probably someone speaking Russian and committed fully to that interpretation.

Adding `language="en"` fixed it immediately. I now force English at all times. I have not spoken Russian into this microphone and I do not plan to.

### Attempt 4: Apple's Speech Engine

At one point, in a fit of "I should use the platform-native thing," I added `SFSpeechRecognizer` as a faster first-pass transcription option that could fall back to Whisper. The pitch was: Apple's speech engine is faster, already on-device, no model loading time.

The reality was: "No speech detected." Over and over. For perfectly audible speech. The fallback rate was high enough that I was effectively running Apple's recognizer as an expensive gate before doing the Whisper call I was going to do anyway.

Removed. Whisper-only. Simpler is better and also faster when the "simple" path is the one that works.

### Attempt 5: The GPU Fight

This one was not subtle.

The app pre-warms the Whisper model at startup — runs a dummy transcription through the full pipeline so the Metal GPU is initialized and the model is loaded into cache before the first real dictation. Standard trick, works great.

What I had not thought about was the following scenario: the pre-warm thread is still doing its GPU initialization when the user (me) presses the hotkey and releases it very quickly. Now there are two threads trying to run `mlx_whisper.transcribe()` at the same time. Both of them want the Metal GPU. MLX is not thread-safe for concurrent GPU operations.

The resulting error was not a clean exception. It was a SIGSEGV followed by an `MTLReleaseAssertionFailure` that crashed the entire process. The menu bar icon just disappeared. Silently. As if it had simply decided it was done.

This happened twice before I understood what was happening.

The fix was a single `threading.Lock()`:

```python
_mlx_lock = threading.Lock()

# In both prewarm_whisper() and transcribe():
with _mlx_lock:
    result = mlx_whisper.transcribe(audio, ...)
```

One lock. Both crashes gone. The GPU now politely waits its turn.

### Attempt 6: The Model Race

After the GPU crash was fixed, I got curious about whether I was using the right Whisper model. So I added a mode that runs three models in parallel on every clip and prints a race table — large-v3-turbo, distil-whisper-large-v3, and whisper-medium — with their times and a truncated transcript snippet.

Four clips in, the race produced this:

```
━━━ Model Race ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  whisper-large-v3-turbo   3889ms  "...protecting your components. Tech enthusi" ◀ primary
  distil-whisper-large-v3  3586ms  "...protecting your components. D**k enthusi"
  whisper-medium           3000ms  "...protecting your components. Tech enthusi"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Yes. Distil-whisper heard "Tech enthusiast" and transcribed it as something else. Not a slur, not a crash, just a phonetically adjacent word that would have been pasted into whatever I had open at the time, at full confidence, with no indication anything had gone wrong.

My Claude Code session's reaction was immediate and accurate:

> *"The critical finding in clip 4: distil transcribed 'D\*\*k enthusiast' instead of 'Tech enthusiast'. That's a hard disqualifier for a dictation tool."*

It is. A dictation tool that occasionally replaces "Tech" with something a HR department would find interesting is not a dictation tool I can use at work. Distil-whisper eliminated itself from the race in one clip.

Whisper-medium, for the record, was actually fastest across all four clips and got everything right. I'm still evaluating.

## The Things That Actually Worked

### Keep the TCP Connection Alive

Every Claude call was paying a connection setup cost. Haiku responds fast, but if the TCP connection has been idle and the client needs to re-establish it, you add latency before the first token arrives.

The fix: configure the Anthropic client with a persistent httpx connection pool, `keepalive_expiry=300s`, and add an idle ping that fires every 3 minutes to keep the connection warm. Cost to add: a few lines. Effect: the "time to first token" column in the timing report dropped noticeably for calls after the first one.

### Silence Trim

Before sending audio to Whisper, trim the leading and trailing silence. The model charges (in time) for every second of audio it processes. If you released the key a moment after finishing your thought, you've handed it an extra half-second of silence to analyze. The trim makes the audio clip as small as it needs to be.

This also had a useful side effect: if the trim returns nearly nothing — less than 0.3 seconds of voiced audio — skip the whole pipeline. The user accidentally bumped the hotkey. Nothing goes to Whisper, nothing goes to Claude, nothing gets pasted. Clean abort.

### Technical Vocabulary Prompt

Whisper is a general-purpose speech model. It has opinions about what words are likely to follow other words, and those opinions do not always include "httpx" or "MLX" or "RAG" or the dozens of other technical terms I use constantly when dictating messages about code.

Whisper's `initial_prompt` parameter lets you bias the greedy decoder toward specific tokens. You give it a string of text that reads like a plausible preamble to your dictation, and the model's priors shift toward the vocabulary in that string.

Mine looks like this:

```
"Claude, Anthropic, API, SDK, httpx, mlx-whisper, Python, async, await,
endpoint, middleware, JSON, SQL, GitHub, PR, diff, repo, commit, branch,
TypeScript, JavaScript, React, Next.js, Vercel, npm, pip, venv,
LLM, GPT, tokens, embeddings, inference, fine-tuning, RAG,
function, class, method, decorator, iterator, generator,
HTTP, REST, GraphQL, WebSocket, OAuth, JWT,
PostgreSQL, Redis, S3, Docker, Kubernetes, CI/CD"
```

It's a comma-separated list of terms I use constantly and that Whisper would otherwise mangle or guess at. You can toggle it on and off in the menu to A/B test.

The effect is real. "httpx" now transcribes as "httpx" instead of "HTTP X" or "HTTPS" or whatever phonetically adjacent word the model decided was more likely. Worth noting: this costs nothing. It's just a string. No additional model calls, no latency, no money.

### Skip Claude for Short Clips

If the raw transcript is fewer than 5 words, there's nothing meaningful for Claude to polish. Just paste the raw output. The savings per call are small, but the right answer is the same every time: don't spend money on a problem that doesn't exist.

## Where It Landed

The pipeline that started at ~8 seconds perceived latency is now consistently in the 2-3 second range for a typical 1-3 sentence dictation. Whisper takes roughly 800ms. Claude Haiku takes 1-1.5s depending on length. The rest is noise.

That's fast enough that I've stopped noticing the latency. Which was the goal.

The total cost remains firmly under a cent for most days of use. I have checked this. I continue to check it. It continues to bring me joy that is disproportionate to the stakes involved.

## What I Actually Learned

**Measure before you touch anything.** The beam_size failure and the max_tokens failure both happened before I had instrumentation. Once I had the timing report, I made no bad optimization attempts. The data removes the temptation to guess.

**Thread safety is the kind of thing you learn the hard way.** GPU concurrency bugs don't throw clean exceptions. They throw SIGSEGV and then your menu bar icon disappears and you're reading crash logs wondering what happened. The lock is obvious in retrospect and invisible until the first crash.

**A model race is worth running.** Distil-whisper looked great on paper — faster, same architecture. It was eliminated in four clips by transcribing "Tech enthusiast" as something you cannot send to a colleague. Speed doesn't matter if the output requires a content warning. Run the race with real data before committing.

**Bias is free.** The initial_prompt fix for technical vocabulary cost nothing and made a real difference. There's a general version of this lesson: sometimes the cheapest fix is telling the model what you want instead of paying for a bigger model that already knows.

**Ten cents a month still works.** The commercial version has a nicer UI and probably handles edge cases I haven't encountered yet. But it also costs $10/month, which is $120/year, which is approximately 1,200 times what I'm paying. The gap between "works for me" and "works for everyone" is real, and I am firmly in the "works for me" camp, which turns out to be a very comfortable camp.

---

*MyWispr is a personal project and is not open source, mainly because it currently has my vocabulary hardcoded into it and I'm not sure "Claude, Anthropic, httpx, mlx-whisper" is a universally useful prior. If you're thinking about building something similar: the stack is mlx-whisper + Claude Haiku + rumps + pynput + pyobjc, and the hardest part is the GPU lock.*

**← Previously:** [My Tests Were Green. My Safety Checks Were Broken. Both Were True at the Same Time.](/posts/11-tests-that-lie/)

**Next up:** Latency was solved. Then I noticed I was still waiting — and remembered a trick from building CPU simulators at AMD. [I Used to Build CPU Simulators at AMD. Twenty Years Later, the Same Trick Made My Dictation App Feel Instant. →](/posts/13-mywispr-pipeline/)
