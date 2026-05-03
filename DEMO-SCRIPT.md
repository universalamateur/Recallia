# Recallia Demo Script

Status: recording script for the current OpenAI demo.

Target length: under 4 minutes. Use short sentences. Show only the required points.

## Script

### 0:00 - Setup

This is Recallia.

It turns uncertain memories into a timeline.

This demo uses synthetic data only.

### 0:20 - Login

I log in as the local demo user.

This is not production auth.

It is demo gating only.

### 0:40 - Timeline

The timeline has seeded life events.

Homes, cars, work, and learning periods overlap.

### 1:00 - Add Memory

I add one uncertain memory.

I met Frank in Frankfurt.

I think it was around the time I had the beige Golf.

### 1:30 - Ask AI

Now I ask Recallia AI.

This first suggestion uses real Codex SDK mode on the server.

Show the AI trace.

It must say `adapterMode: "codex"`.

It must not show a fallback reason.

### 2:10 - Safety

The AI only suggests.

It cannot change the timeline by itself.

The user must confirm first.

### 2:30 - Suggestion

Codex suggests 1995 to 1999.

That matches living in Frankfurt and owning the beige Golf.

### 2:55 - Refine

I select evening school.

I also select logistics work.

The app narrows the overlap to 1997 to 1998.

### 3:25 - Accept

I accept the suggestion.

Now the memory becomes a normal saved timeline card.

### 3:45 - Close

Reload keeps the result.

The AI trace is stored for review.

The sidebar returns to a clean Add Memory state.

## Stop Condition

If the first AI trace shows `mock`, a timeout, or any fallback reason, stop recording and rerun the real-mode demo.
