# FocusTube — MVP Summary

## Overview
FocusTube is a Chrome Extension that promotes focused YouTube use by blocking Shorts and limiting distracting searches.  
It works across content, background, and rules scripts with synchronized state tracking in Chrome storage.

## Architecture
| Component | Purpose |
|------------|----------|
| **manifest.json** | Registers extension config, permissions, and scripts. |
| **background.js** | Core logic hub — handles state rotation, counts activity, and requests block decisions. |
| **content.js** | Injected on YouTube pages — detects navigation, applies overlays, and communicates with background. |
| **state.js** | Data layer — manages persistent counters, resets, plans (Free/Pro/Test), and temporary unlocks. |
| **rules.js** | Decision engine — pure logic that determines if the user should be blocked and why. |

## Current Capabilities
- Detects Shorts, Search, and Watch pages.  
- Tracks daily/weekly counters (auto-reset).  
- Enforces Shorts, Search, and Global blocking via overlays.  
- Temporary unlocks supported (for charity feature).  
- Future-proofed with plan tiers and AI-ready hooks.

## Developer Notes
- All async storage operations use Promises via `getLocal` / `setLocal`.  
- Blocking logic is deterministic: `background → rules → content`.  
- `MutationObserver` in `content.js` ensures SPA reactivity.  
- Easy to extend via plan configs or new rule checks.

---