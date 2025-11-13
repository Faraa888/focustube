## FocusTube Watch Session Schema

Use this canonical shape for every long-form watch session that flows between the extension, backend, and Supabase tables:

```json
{
  "video_id": "string",
  "video_title": "string",
  "channel_name": "string",
  "watch_seconds": 123,
  "started_at": "ISO timestamp",     // optional but recommended
  "watched_at": "ISO timestamp",     // when playback ended
  "distraction_level": "productive | neutral | distracting",
  "category_primary": "string",
  "confidence_distraction": 0.73     // optional number
}
```

### Extension
- `background/background.js` captures this object in `ft_watch_history` and queues it in `ft_watch_event_queue`.
- `lib/state.js` syncs the same shape via `/extension/save-data`.

### Backend
- `/events/watch` should accept `{ user_id, events: WatchSession[] }` and persist to `video_sessions`.
- `/dashboard/stats` reads `video_sessions` + `video_classifications` (joined on `user_id`, `video_id`) using the same field names.
- `/extension/save-data` stores a JSON blob that mirrors the schema for redundancy.

### Supabase Tables
- `video_sessions`: columns `video_id`, `video_title`, `channel_name`, `watch_seconds`, `watched_at`, `distraction_level`, `category_primary`, `confidence_distraction`, `user_id`, `created_at`.
- `video_classifications`: same naming (plus model metadata) so joins don’t require renaming.

Keep metadata such as description or tags optional—omit them unless they’re reliably available. Shorts (<45s) and aborted watches never enter this pipeline.