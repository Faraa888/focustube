# 🔒 Distraction Control System — Complete Spec

**Status:** Planning  
**Priority:** HIGH - Core feature of FocusTube  
**Estimated Time:** MVP ~5-7 hours | Full System ~11-15 hours

---

## Original Product Design Spec

### 1. Hard Channel Blocks (User-Defined)

- Users can manually block any channel they find distracting
- Blocked channels are hidden entirely (no recommendations, search results, or homepage presence)
  - If not possible to hide from recommendations: hard overlay within 1 second when clicked
- Unblock limit: Max of 1 unblock per month to prevent cycling
- Confirmations required to unblock, ideally with a small time delay or reason field (optional)

---

### 2. AI-Driven Spiral Detection

Triggers a nudge when one or more of the following happens:

- 3+ videos watched from the same channel in a row / same day
- 15+ minutes of continuous watch time on content marked neutral or partially aligned
- 2+ "distracting" videos in a row
- Watching a previously marked distracting channel again within 72h (requires expanding cache / storing time of watching channel)

---

### 3. Spiral Nudge System

When spiral detected, show an overlay nudge:

**Message:** "It looks like you might be spiralling away from your goals. Want to keep going, pause, or block this channel?"

**Design:** Good place for journal / maybe make them wait 1 min to decide (showing a nice circular graphic timer)

**User options:**
- ✅ Keep watching
- 🔒 Block channel
- ⏸ Pause (suggest a break or reflect)

These can be dismissed but are tracked for analytics and future insights.

---

### 4. Automatic Block Suggestions

If a user spirals repeatedly on a specific channel:

- Suggest adding that channel to the block list - weekly report or on screen
- Threshold: 2 spiral triggers on the same channel within a week (adjustable)

---

### 5. Entertainment Limits (Optional Pro Feature)

- Users can choose 1 entertainment session per month (basically can watch anything within the window that day)
- Doesn't carry over between months
- System tracks category (e.g., "Entertainment", "Lifestyle/Vlogs") and blocks content exceeding the chosen limit
- Post-limit, suggestions and access are hidden unless reset window occurs

---

### 6. Smart Context Tagging

- Channel history and goal alignment inform future recommendations
- Example: Jeff Nippard = ✅ aligned with "Fitness" → but watching 3+ in a row = 🚨 trigger spiral alert
- Eddie Hall would be not aligned as more entertainment (this comes from the AI prompt)

---

## Feasibility Analysis

### ✅ What Already Exists (Good Foundation)

- Channel name extraction from video metadata ✅
- Watch time tracking per video ✅
- Watch event queue with channel info ✅
- AI classification (distracting/neutral/productive) ✅
- Blocking logic framework in `rules.js` ✅
- Overlay system for nudges ✅
- Storage system (`chrome.storage.local`) ✅

### 🔨 What Needs to Be Built

1. **Channel blocklist storage** (chrome.storage + Supabase)
2. **Channel history tracking** (which channels watched, when)
3. **Spiral detection logic** (3+ same channel, 15+ min neutral, 2+ distracting in row, etc.)
4. **Spiral nudge overlay** with timer
5. **Unblock limit tracking** (1 per month)
6. **Automatic block suggestions**
7. **Entertainment limits** (Pro feature)
8. **Context tagging system**

---

## MVP vs Post-MVP Breakdown

### 🎯 MVP Features (~5-7 hours) - MUST HAVE

#### 1. Hard Channel Blocks (1-2 hours)
- **Core feature** - this is the main value prop
- Manual block/unblock
- Hard redirect when blocked
- **MVP Scope:** Basic blocklist, no unblock limit yet

#### 2. Basic Spiral Detection (2-3 hours)
- **MVP:** 3+ same channel in a row
- **MVP:** 2+ distracting videos in a row
- **Post-MVP:** 15+ min neutral, 72h cache

#### 3. Spiral Nudge (1-2 hours)
- **MVP:** Simple overlay with 3 options
- **Post-MVP:** Timer, journal integration

#### 4. Phase 2 Data Sync (3 hours)
- Needed for persistence

**MVP Total: ~7-10 hours**

---

### 📦 Post-MVP Features (~4-5 hours) - NICE TO HAVE

1. **Unblock limit (1 per month)** - ~30 min
   - Can add later, not blocking

2. **Automatic block suggestions** - ~1 hour
   - Weekly reports can wait

3. **Entertainment limits (Pro feature)** - ~1-2 hours
   - Advanced feature, not core

4. **Smart context tagging** - ~2-3 hours
   - Complex, polish feature

5. **Advanced spiral detection** - ~1 hour
   - 15+ min neutral, 72h cache

**Post-MVP Total: ~4-5 hours**

---

## Implementation Details

### Data Structures Needed

```javascript
// Channel blocklist
ft_blocked_channels: ["Eddie Hall", "Channel Name 2"]

// Channel watch history (last 7 days)
ft_channel_watch_history: [
  {channel: "Jeff Nippard", timestamp: 1234567890, category: "productive"},
  {channel: "Eddie Hall", timestamp: 1234567891, category: "distracting"}
]

// Recent videos (for spiral detection)
ft_recent_videos: [
  {channel: "Channel 1", category: "distracting", timestamp: 1234567890},
  {channel: "Channel 1", category: "distracting", timestamp: 1234567891}
]

// Spiral triggers per channel
ft_channel_spiral_count: {
  "Eddie Hall": 2,
  "Channel 2": 1
}

// Unblock tracking
ft_unblocks_this_month: 0
ft_last_unblock_date: "2025-01-15"
```

### Integration Points

1. **rules.js** - Add channel block check before allowing video
2. **background.js** - Track watch history, detect spirals
3. **content.js** - Show spiral nudge overlay
4. **state.js** - Add new storage keys
5. **Supabase** - Sync blocklist and history (after Phase 2)

---

## Major Pitfalls & Solutions

### 1. ⚠️ Data Structure Performance
**Problem:** Checking history on every video can be slow  
**Solution:** Use Map/Set for O(1) lookups, limit history size, use indexes

### 2. ⚠️ Channel Name Inconsistency
**Problem:** "Jeff Nippard" vs "Jeff Nippard Fitness" vs channel ID changes  
**Solution:** Normalize channel names, store channel IDs when possible, fuzzy matching

### 3. ⚠️ False Positive Spirals
**Problem:** User intentionally binges good channel (3+ educational videos)  
**Solution:** Only trigger on "neutral" or "distracting", not "productive"

### 4. ⚠️ Storage Bloat
**Problem:** History grows indefinitely  
**Solution:** Keep last 7 days, prune old data, use Supabase for long-term

### 5. ⚠️ 72-Hour Cache Complexity
**Problem:** "Previously marked distracting channel within 72h" requires time-based storage  
**Solution:** Store `{channel, last_watched, category}` with timestamps, clean up expired

### 6. ⚠️ Unblock Limit Tracking
**Problem:** "1 unblock per month" needs monthly reset logic  
**Solution:** Use same daily reset system, add `ft_unblocks_this_month: 0` counter

### 7. ⚠️ Integration with Phase 2
**Problem:** Needs Supabase sync for channel blocklist persistence  
**Solution:** Do Phase 2 first, or build local-only first and sync later

---

## Recommended Implementation Order

1. **Phase 2** (3 hours) - Get data sync working ✅
2. **Hard Channel Blocks** (1-2 hours) - Simplest, highest impact
3. **Spiral Detection** (2-3 hours) - Core feature
4. **Spiral Nudge** (1-2 hours) - UX layer
5. **Auto Suggestions** (1 hour) - Nice to have
6. **Entertainment Limits** (1-2 hours) - Pro feature
7. **Context Tagging** (2-3 hours) - Polish

**Total: ~11-15 hours (including Phase 2)**

---

## Updated Plan Totals

### Current Status
- **Original Plan:** 34 hours
- **Time Spent:** ~7 hours
- **Time Remaining:** ~27 hours

### With Distraction Control System
- **Phase 2:** 3 hours (already planned)
- **Distraction Control MVP:** ~5-7 hours
- **New Total:** ~39-41 hours
- **New Remaining:** ~32-34 hours

### Post-MVP Additions
- **Additional Features:** ~4-5 hours (can add after launch)

---

## Next Steps

1. ✅ Complete Phase 2: Data Storage & Schema
2. 🔨 Implement Hard Channel Blocks (MVP)
3. 🔨 Implement Basic Spiral Detection (MVP)
4. 🔨 Implement Spiral Nudge (MVP)
5. 📦 Add Post-MVP features after launch

---

*Last Updated: 2025-01-16*  
*Status: Planning - Ready for Implementation*

