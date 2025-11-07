# Testing Distraction Detection

## How to Know if It's Working

### 1. Check Server Terminal

When you watch a video, you should see in server terminal:

```
[AI Classify] Request received: [Video Title]... (context: watch)
[AI Classify] Calling OpenAI API...
[AI Classify] ✅ OpenAI response: [title]... → [category] (distracting, confidence: 0.85)
```

**If you see:**
- `⚠️ OpenAI client not initialized` → OpenAI API key missing
- `Server unavailable` → Server not running
- `neutral` for everything → OpenAI not working (fallback)

### 2. Check Browser Console (F12)

When watching a video, you should see:

```
[FT] AI: Programming & Dev → distracting (85%) [video_id]
```

**If you see:**
- No AI logs → Server not running or not Pro plan
- Always "neutral" → OpenAI not working
- "Mismatch" warning → Video ID issue (can ignore)

### 3. Test with Known Distracting Video

Try watching:
- A Shorts video (should default to "distracting")
- Clickbait title ("You Won't Believe...", "I Tried...")
- Entertainment/vlog content

Should classify as "distracting" if OpenAI is working.

## Requirements

1. **Server must be running**: `cd server && npm run dev`
2. **OpenAI API key**: Must be in `server/.env` as `OPENAI_API_KEY=sk-...`
3. **Pro/Trial plan**: AI only works for Pro/Trial users
4. **User goals set**: AI uses goals to determine if content is distracting

## Quick Test

1. Set plan to "pro" in dev panel
2. Set a goal (e.g., "learn python")
3. Watch a distracting video (Shorts, entertainment)
4. Check server terminal for AI classification
5. After 1 minute, journal nudge should appear (if distracting)

