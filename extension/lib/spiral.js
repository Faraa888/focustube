// lib/spiral.js
// Spiral detection logic extracted from background.js
// Detects when a user is watching too much of a single channel.

import {
    SPIRAL_THRESHOLD_WEEK,
    SPIRAL_THRESHOLD_WEEK_TIME,
    SPIRAL_HISTORY_DAYS,
    SPIRAL_DISMISSAL_COOLDOWN_MS
  } from "./constants.js";
  import { getLocal, setLocal, saveExtensionDataToServer } from "./state.js";
  
  const DEBUG = false;
  function LOG(...a) {
    if (!DEBUG) return;
    console.log("[FocusTube Spiral]", ...a);
  }
  
  /**
   * Detect spiral patterns in channel watch history.
   * @param {string} channelName
   * @param {number} durationSeconds
   * @param {string} distractionLevel - "productive" | "neutral" | "distracting"
   * @param {string} videoId
   * @param {string} finishedAtIso
   * @param {string} startedAtIso
   * @param {string|null} videoTitle
   * @param {string|null} categoryPrimary
   * @param {number|null} confidenceDistraction
   * @returns {Promise<Object|null>} spiralDetected object or null
   */
  export async function detectSpiral(
    channelName,
    durationSeconds,
    distractionLevel,
    videoId,
    finishedAtIso,
    startedAtIso,
    videoTitle = null,
    categoryPrimary = null,
    confidenceDistraction = null
  ) {
    const { ft_watch_history = [] } = await getLocal(["ft_watch_history"]);
    const history = Array.isArray(ft_watch_history) ? ft_watch_history : [];
  
    const watchHistoryEntry = {
      channel_name: channelName.trim(),
      video_id: videoId,
      video_title: videoTitle,
      watched_at: finishedAtIso,
      started_at: startedAtIso,
      watch_seconds: durationSeconds,
      distraction_level: distractionLevel || "neutral",
      category_primary: categoryPrimary || "Other",
      confidence_distraction: confidenceDistraction,
    };
    history.push(watchHistoryEntry);
  
    const thirtyDaysAgo = Date.now() - (SPIRAL_HISTORY_DAYS * 24 * 60 * 60 * 1000);
    const recentHistory = history.filter(item => {
      const itemTime = new Date(item.watched_at).getTime();
      return itemTime > thirtyDaysAgo;
    });
  
    const today = new Date().toDateString();
    const todayHistory = recentHistory.filter(item =>
      new Date(item.watched_at).toDateString() === today
    );
  
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const weekHistory = recentHistory.filter(item => {
      const itemTime = new Date(item.watched_at).getTime();
      return itemTime > sevenDaysAgo;
    });
  
    const todayCounts = {};
    const todayTime = {};
    const weekCounts = {};
    const weekTime = {};
  
    todayHistory.forEach(item => {
      const ch = (item.channel_name || "Unknown").trim();
      todayCounts[ch] = (todayCounts[ch] || 0) + 1;
      todayTime[ch] = (todayTime[ch] || 0) + (item.watch_seconds || 0);
    });
  
    weekHistory.forEach(item => {
      const ch = (item.channel_name || "Unknown").trim();
      weekCounts[ch] = (weekCounts[ch] || 0) + 1;
      weekTime[ch] = (weekTime[ch] || 0) + (item.watch_seconds || 0);
    });
  
    const { ft_channel_spiral_count = {} } = await getLocal(["ft_channel_spiral_count"]);
    const spiralCounts = { ...ft_channel_spiral_count };
  
    const now = Date.now();
    for (const [ch, data] of Object.entries(spiralCounts)) {
      if (data && data.last_watched && data.this_week > 0) {
        const lastWatched = new Date(data.last_watched).getTime();
        const hoursSinceLastWatch = (now - lastWatched) / (60 * 60 * 1000);
        const decayIntervals = Math.floor(hoursSinceLastWatch / 24);
        if (decayIntervals > 0) {
          const newWeekCount = Math.max(0, data.this_week - decayIntervals);
          if (newWeekCount !== data.this_week) {
            LOG(`[Spiral Decay] ${ch}: ${data.this_week} → ${newWeekCount} (${decayIntervals} intervals)`);
            spiralCounts[ch].this_week = newWeekCount;
          }
        }
      }
    }
  
    const channelKey = channelName.trim();
    let consecutiveCount = 1;
    const CONSECUTIVE_WINDOW_MS = 60 * 60 * 1000;
    const currentTime = new Date(finishedAtIso).getTime();
  
    for (let i = recentHistory.length - 1; i >= 0; i--) {
      const item = recentHistory[i];
      if (item.channel_name && item.channel_name.trim() === channelKey && item.watched_at) {
        const itemTime = new Date(item.watched_at).getTime();
        const timeDiff = currentTime - itemTime;
        if (timeDiff > 0 && timeDiff <= CONSECUTIVE_WINDOW_MS) {
          consecutiveCount++;
        } else if (timeDiff > CONSECUTIVE_WINDOW_MS) {
          break;
        }
      }
    }
  
    const lastClassification = recentHistory
      .filter(item => item.channel_name && item.channel_name.trim() === channelKey)
      .sort((a, b) => new Date(b.watched_at) - new Date(a.watched_at))[0];
  
    const isDistractingChannel = lastClassification &&
      lastClassification.distraction_level === "distracting" &&
      (lastClassification.confidence_distraction || 0) > 0.7;
  
    let todayWeight = 1.0;
    let weekWeight = 1.0;
    if (isDistractingChannel && consecutiveCount > 1) {
      if (consecutiveCount === 2) {
        todayWeight = 1.5;
        weekWeight = 1.5;
      } else if (consecutiveCount >= 3) {
        todayWeight = 2.0;
        weekWeight = 2.0;
      }
      LOG(`[Spiral Weight] ${channelKey}: ${consecutiveCount} consecutive, weights: today=${todayWeight}, week=${weekWeight}`);
    }
  
    const baseTodayCount = todayCounts[channelKey] || 0;
    const baseWeekCount = weekCounts[channelKey] || 0;
    const baseWeekTime = weekTime[channelKey] || 0;
  
    const todayExtra = (todayWeight > 1.0) ? (todayWeight - 1.0) : 0;
    const weekExtra = (weekWeight > 1.0) ? (weekWeight - 1.0) : 0;
  
    const weightedToday = baseTodayCount + todayExtra;
    const weightedWeek = baseWeekCount + weekExtra;
    const updatedWeekTime = baseWeekTime + durationSeconds;
  
    spiralCounts[channelKey] = {
      today: Math.round(weightedToday * 10) / 10,
      this_week: Math.round(weightedWeek * 10) / 10,
      time_this_week: updatedWeekTime,
      last_watched: new Date().toISOString()
    };
  
    const currentChannelCount = spiralCounts[channelKey];
    let spiralDetected = null;
  
    const { ft_spiral_dismissed_channels = {} } = await getLocal(["ft_spiral_dismissed_channels"]);
    const dismissedData = ft_spiral_dismissed_channels[channelKey];
    const isOnCooldown = dismissedData &&
      (Date.now() - dismissedData.last_shown) < SPIRAL_DISMISSAL_COOLDOWN_MS;
  
    if (isOnCooldown) {
      const cooldownRemaining = Math.ceil(
        (SPIRAL_DISMISSAL_COOLDOWN_MS - (Date.now() - dismissedData.last_shown)) / (24 * 60 * 60 * 1000)
      );
      console.log("[FT] 🚨 SPIRAL COOLDOWN: Active", { channel: channelKey, daysRemaining: cooldownRemaining });
    }
  
    const weekCount = currentChannelCount.this_week || 0;
    const weekTimeSeconds = currentChannelCount.time_this_week || 0;
    const weekTimeMinutes = weekTimeSeconds / 60;
  
    if (!isOnCooldown && (weekCount >= SPIRAL_THRESHOLD_WEEK || weekTimeSeconds >= SPIRAL_THRESHOLD_WEEK_TIME)) {
      console.log("[FT] 🚨 SPIRAL DETECTED:", {
        channel: channelKey,
        count: weekCount,
        timeMinutes: Math.round(weekTimeMinutes * 10) / 10,
        threshold: weekCount >= SPIRAL_THRESHOLD_WEEK ? "count" : "time"
      });
      spiralDetected = {
        channel: channelKey,
        count: weekCount,
        time_minutes: Math.round(weekTimeMinutes * 10) / 10,
        type: "week",
        message: "You've watched a lot of this channel this week. Are you still able to progress towards your goals?",
        detected_at: Date.now()
      };
      LOG("⚠️ Spiral detected (week):", spiralDetected);
    } else if (isOnCooldown) {
      LOG(`[Spiral] Channel ${channelKey} is on cooldown`);
    }
  
    const { ft_channel_lifetime_stats = {} } = await getLocal(["ft_channel_lifetime_stats"]);
    const lifetimeStats = { ...ft_channel_lifetime_stats };
  
    if (!lifetimeStats[channelKey]) {
      lifetimeStats[channelKey] = {
        total_videos: 0,
        total_seconds: 0,
        first_watched: new Date().toISOString(),
        last_watched: new Date().toISOString()
      };
    }
  
    lifetimeStats[channelKey].total_videos += 1;
    lifetimeStats[channelKey].total_seconds += durationSeconds;
    lifetimeStats[channelKey].last_watched = new Date().toISOString();
  
    let spiralEvents = [];
    const { ft_spiral_events = [] } = await getLocal(["ft_spiral_events"]);
    const events = Array.isArray(ft_spiral_events) ? ft_spiral_events : [];
  
    if (spiralDetected) {
      events.push({
        channel: spiralDetected.channel,
        count: spiralDetected.count,
        type: spiralDetected.type,
        detected_at: new Date().toISOString(),
        message: spiralDetected.message
      });
      LOG("Spiral event added to history:", { totalEvents: events.length });
    }
  
    const thirtyDaysAgoMs = Date.now() - (30 * 24 * 60 * 60 * 1000);
    spiralEvents = events.filter(e => new Date(e.detected_at).getTime() > thirtyDaysAgoMs);
  
    await setLocal({
      ft_watch_history: recentHistory,
      ft_channel_spiral_count: spiralCounts,
      ft_channel_lifetime_stats: lifetimeStats,
      ft_spiral_events: spiralEvents,
      ...(spiralDetected ? { ft_spiral_detected: spiralDetected } : {})
    });
  
    saveExtensionDataToServer(null).catch((err) => {
      console.warn("[FT] Failed to sync watch history after video (non-blocking):", err?.message || err);
    });
  
    if (spiralDetected) {
      LOG("Spiral flag set, will trigger nudge on next video from this channel");
    }
  
    return spiralDetected;
  }