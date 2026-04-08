---
title: "I Used to Work on Designing Microprocessors at AMD. A Decade Later, the Same Trick Made My Dictation App Feel Instant."
date: 2026-04-08T02:00:00-07:00
category: "geek"
draft: false
---

![A banana engineer in a hard hat, pointing at a factory assembly line with three stations: RECORD, WHISPER, CLAUDE](/images/banana-pipeline.png)

There's a concept in computer architecture called throughput. It's different from latency, and the distinction matters more than most people realize until they've sat with a slow pipeline long enough to get annoyed.

Latency is how long one thing takes. Throughput is how much work you can push through in a given window of time. These are related but not the same, and optimizing for one does not automatically improve the other. I spent a decent chunk of my career at AMD understanding this distinction in the context of cycle-accurate CPU modeling and designing microprocessors — building simulators that could track every instruction through every pipeline stage, identifying where stalls happened and why.

That was a while ago. Before the current AI moment. Before LLMs, before Apple Silicon, before any of this.

Today, the same mental model I used on CPUs made my dictation app feel seamless.

## What Was Slow and Why

By the time I finished the previous round of optimizations on MyWispr, the per-clip numbers looked like this:

- Whisper (whisper-medium): ~1.5–3s
- Claude Haiku polish: ~800ms
- Paste injection: ~15ms
- Total: ~2.5–4s end-to-end

That's pretty good. For a local, private, runs-on-your-machine dictation tool that costs a fraction of a cent per clip, that's actually excellent.

But there was a hidden cost I hadn't measured.

Every time I released the hotkey, the app set a `processing` flag to `True`. While that flag was set, pressing the hotkey again did nothing. You couldn't record the next clip until the current clip had gone through Whisper, through Claude, through paste — the full chain. Then the flag dropped, and only then could you speak again.

The dead zone was 3–4 seconds after every clip. Not painful for a single sentence. Genuinely irritating for a back-and-forth conversation, or when you're dictating a multi-part thought and you want to keep going.

I had optimized latency to its practical floor. The problem was no longer latency. It was throughput.

## The CPU Insight

In a CPU pipeline, individual instructions don't speed up just because you add pipeline stages. A `div` instruction still takes N cycles. What changes is that you can have multiple instructions in-flight simultaneously — one in fetch, one in decode, one in execute — so the *throughput* of the processor improves even though per-instruction *latency* is identical.

MyWispr had three natural stages:
1. **Record** — capture audio while hotkey is held
2. **Transcribe** — Whisper converts audio to text
3. **Polish + Paste** — Claude cleans it up, Quartz injects it

These stages are data-dependent within a single clip. Clip N has to finish recording before Whisper can start, has to finish Whisper before Claude can start. The latency of any individual clip doesn't change.

But clips are independent. There is no reason clip N+1 can't be recording while clip N is in Whisper. There is no reason clip N+1 can't be transcribing while clip N is being polished.

The before and after look like this:

```
Before:
Clip 1:  [record]──[whisper]──[claude]──[paste]
Clip 2:                                          [record]──[whisper]──[claude]──[paste]

After:
Clip 1:  [record]──[whisper]──[claude]──[paste]
Clip 2:          [record]──[whisper]──[claude]──[paste]
Clip 3:                  [record]──[whisper]──[claude]──[paste]
```

You release the key. Clip 1 goes into the Whisper stage. You're already recording clip 2. By the time Whisper finishes clip 1, you've probably finished speaking clip 2 and it's already queued. The paste for clip 1 arrives, then clip 2's paste arrives. Seamless.

## The Implementation

Two persistent worker threads, two queues:

```python
_audio_queue: queue.Queue = queue.Queue()  # (audio, TimingSession)
_text_queue:  queue.Queue = queue.Queue()  # (text, TimingSession)

def whisper_worker():
    """Stage 2: audio → transcription → text queue"""
    while True:
        audio, ts = _audio_queue.get()
        raw = transcribe(audio, ts)
        if raw:
            _text_queue.put((raw, ts))
        ...

def polish_paste_worker():
    """Stage 3: text → Claude → paste"""
    while True:
        text, ts = _text_queue.get()
        final = polish(text, ts)
        paste_text(final, ts)
        ...
```

And `on_release` — instead of spawning a thread and setting a blocking flag, it just enqueues:

```python
def on_release(key):
    audio = stop_recording()
    ts = TimingSession()
    _audio_queue.put((audio, ts))   # non-blocking, returns immediately
    # next clip can be recorded instantly
```

The `processing` flag still exists, but now it tracks whether *any* clip is anywhere in the pipeline — so the menu bar shows the spinner whenever work is in flight. It drops to idle only when all queues are drained.

One correctness issue that needed handling: Whisper's variance means clip N+1 could theoretically finish transcription before clip N, causing out-of-order pastes. The fix is that `polish_paste_worker` is a single thread — it processes text serially in arrival order, so even if Whisper finishes clips out of order, the paste sequence is always FIFO.

## What It Feels Like

The timing numbers didn't change. Each clip still takes 2–3 seconds through the full chain.

But the *experience* changed completely.

You speak, release the key, and can immediately speak again. The previous clip processes silently in the background. The text appears — first clip's paste, then the next — and you're already done with a third thought before the second one has landed.

It's the difference between standing in line at a coffee shop where they make one drink at a time, and one where there's a barista on espresso, one on milk steaming, and one on handoff. Same time per drink. Different throughput. Different experience.

My Claude Code session's initial take was skeptical — "worth being precise about what it actually buys... the gain is narrow." And for most use patterns, that's accurate. If you pause for 5 seconds between dictations, you'll never hit the queue.

But when you're in a flow state, thinking out loud, speaking in chunks? The 3-second dead zone was the friction. Now it's gone.

## The AMD Connection

I worked on cycle-accurate models before any of this AI wave existed. The work was unglamorous and deeply technical: write software that simulates a CPU at the clock cycle level, make sure every instruction follows the right path through every pipeline stage, identify where stalls happen, figure out whether it's a cache miss or a branch misprediction or a structural hazard. Okay, it was not unglamarous. I worked on branch prediction, decode, instruction cache sections in Ryzen/Zen 1st gen microprocessor and it was truly exciting stuff to make a transformation!

The core insight from that work is that latency and throughput are separate problems. You optimize them with different tools. Latency is about making individual things faster. Throughput is about keeping more things in flight simultaneously.

Most developers — especially in software, where we don't usually think in terms of pipeline stages and structural hazards — stop after optimizing latency. I almost did. The timing report was good. The numbers looked fine. I had squeezed Whisper from 4.6s average down to 1.7s. I was done.

Then I noticed I was waiting.

Not during transcription. Between clips. The dead zone. Four seconds of nothing, every time, before I could speak again.

That's a throughput problem. And the solution was the same one I learned before I ever touched an LLM.

## What's Next

The pipeline currently has no back-pressure — if you dictate faster than Whisper can process, the audio queue grows and pastes pile up. For now that's fine; Whisper-medium is fast enough that you'd have to be speaking continuously for minutes to outpace it. But it's a known gap.

The other open question is ordering guarantees under load. The single-threaded `polish_paste_worker` ensures serial output, but if Whisper ever becomes multi-threaded (it isn't now, because of `_mlx_lock`), that assumption breaks. For a personal tool running on one machine, that's a theoretical concern. I'm logging it and moving on.

The tool is now, genuinely, seamless. You speak. Text appears. You speak again. The latency didn't change. The experience did.

Sometimes the most useful thing you can remember is something you learned a long time ago in a completely different context.

---

*← Previously: [I Built a Dictation App to Avoid Paying $10/Month. Then I Spent a Week Making It Not Terrible.](/posts/12-mywispr-tuning/)*
