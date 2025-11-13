// server/src/supabase.ts
// Supabase client for database operations

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn("⚠️  Supabase credentials not set - database operations will fail");
  console.warn("   Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env file");
}

// Create Supabase client with service role key (admin access)
// This allows us to read/write user data without auth
export const supabase = createClient(
  supabaseUrl || "",
  supabaseServiceKey || "",
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/**
 * Get user plan and trial info from Supabase
 * @param email - User email
 * @returns User plan ("free" | "pro" | "trial") and trial_expires_at, or null if user not found
 */
export interface UserPlanInfo {
  plan: string;
  trial_expires_at: string | null;
}

/**
 * Get user UUID from email
 * @param email - User email
 * @returns User UUID (id from users table) or null if user not found
 */
export async function getUserIdFromEmail(email: string): Promise<string | null> {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      console.warn("[Supabase] Credentials not set, cannot look up user ID");
      return null;
    }

    const { data, error } = await supabase
      .from("users")
      .select("id")
      .eq("email", email.toLowerCase().trim())
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // User not found
        return null;
      }
      console.error("[Supabase] Error getting user ID:", error);
      return null;
    }

    return data?.id || null;
  } catch (error) {
    console.error("[Supabase] Exception getting user ID:", error);
    return null;
  }
}

export async function getUserPlanInfo(email: string): Promise<UserPlanInfo | null> {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      console.warn("[Supabase] Credentials not set, returning default plan");
      return { plan: "free", trial_expires_at: null };
    }

    // Try to get plan and trial_expires_at
    let { data, error } = await supabase
      .from("users")
      .select("plan, trial_expires_at")
      .eq("email", email)
      .single();

    // If column doesn't exist (error code 42703), retry with just plan
    if (error && error.code === "42703") {
      console.warn("[Supabase] trial_expires_at column doesn't exist, querying plan only");
      const { data: planData, error: planError } = await supabase
        .from("users")
        .select("plan")
        .eq("email", email)
        .single();
      
      if (planError) {
        if (planError.code === "PGRST116") {
          // User not found
          return null;
        }
        console.error("[Supabase] Error getting user plan:", planError);
        return null;
      }
      
      // Normalize plan to lowercase
      const plan = planData?.plan;
      const normalizedPlan = typeof plan === "string" ? plan.toLowerCase() : "free";
      
      return {
        plan: normalizedPlan,
        trial_expires_at: null, // Column doesn't exist yet
      };
    }

    if (error) {
      if (error.code === "PGRST116") {
        // User not found
        return null;
      }
      console.error("[Supabase] Error getting user plan:", error);
      return null;
    }

    // Normalize plan to lowercase (Supabase might return "Pro", "PRO", etc.)
    const plan = data?.plan;
    const normalizedPlan = typeof plan === "string" ? plan.toLowerCase() : "free";

    return {
      plan: normalizedPlan,
      trial_expires_at: data?.trial_expires_at || null,
    };
  } catch (error) {
    console.error("[Supabase] Exception getting user plan:", error);
    return null;
  }
}

/**
 * Get user plan from Supabase (backward compatibility)
 * @param email - User email
 * @returns User plan ("free" | "pro") or null if user not found
 */
export async function getUserPlan(email: string): Promise<string | null> {
  const info = await getUserPlanInfo(email);
  return info?.plan || null;
}

/**
 * Update user plan in Supabase
 * @param email - User email
 * @param plan - New plan ("free" | "pro")
 * @returns true if updated successfully, false otherwise
 */
export async function updateUserPlan(
  email: string,
  plan: string,
  trial_expires_at?: string | null
): Promise<boolean> {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      console.warn("[Supabase] Credentials not set, cannot update plan");
      return false;
    }

    // Check if user exists
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .single();

    const updateData: any = {
      plan,
      updated_at: new Date().toISOString()
    };

    // Add trial_expires_at if provided
    if (trial_expires_at) {
      updateData.trial_expires_at = trial_expires_at;
    } else if (plan !== "trial") {
      // Clear trial_expires_at if not on trial
      updateData.trial_expires_at = null;
    }

    if (existingUser) {
      // User exists - update plan
      const { error } = await supabase
        .from("users")
        .update(updateData)
        .eq("email", email);

      if (error) {
        console.error("[Supabase] Error updating user plan:", error);
        return false;
      }

      console.log(`[Supabase] Updated plan for ${email} to ${plan}`);
      return true;
    } else {
      // User doesn't exist - create new user
      const { error } = await supabase.from("users").insert({
        email,
        ...updateData,
        created_at: new Date().toISOString(),
      });

      if (error) {
        console.error("[Supabase] Error creating user:", error);
        return false;
      }

      console.log(`[Supabase] Created new user ${email} with plan ${plan}`);
      return true;
    }
  } catch (error) {
    console.error("[Supabase] Exception updating user plan:", error);
    return false;
  }
}

export interface VideoClassificationPayload {
  user_id: string;
  video_id: string;
  video_title?: string | null;
  channel_name?: string | null;
  video_category?: string | null;
  distraction_level?: string | null;
  category_primary?: string | null;
  confidence_distraction?: number | null;
}

/**
 * Upsert video classification metadata for analytics tracking
 */
export async function upsertVideoClassification(
  payload: VideoClassificationPayload
): Promise<boolean> {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      console.warn("[Supabase] Credentials not set, cannot store video classification");
      return false;
    }

    const { user_id, video_id } = payload;
    if (!user_id || !video_id) {
      console.warn("[Supabase] Missing user_id or video_id for classification upsert");
      return false;
    }

    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from("video_classifications")
      .upsert(
        {
          user_id,
          video_id,
          video_title: payload.video_title || null,
          channel_name: payload.channel_name || null,
          video_category: payload.video_category || null,
          distraction_level: payload.distraction_level || null,
          category_primary: payload.category_primary || null,
          confidence_distraction: payload.confidence_distraction ?? null,
          updated_at: nowIso,
          created_at: nowIso,
        },
        {
          onConflict: "user_id,video_id",
          ignoreDuplicates: false,
        }
      );

    if (error) {
      console.error("[Supabase] Error upserting video classification:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[Supabase] Exception upserting video classification:", error);
    return false;
  }
}

/**
 * Update watch time for a video classification row
 */
export async function updateVideoWatchTime(
  user_id: string,
  video_id: string,
  watch_seconds: number
): Promise<boolean> {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      console.warn("[Supabase] Credentials not set, cannot update watch time");
      return false;
    }

    if (!user_id || !video_id) {
      console.warn("[Supabase] Missing user_id or video_id for watch time update");
      return false;
    }

    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from("video_classifications")
      .update({
        watch_seconds,
        updated_at: nowIso,
      })
      .eq("user_id", user_id)
      .eq("video_id", video_id)
      .select("video_id");

    if (error) {
      console.error("[Supabase] Error updating watch time:", error);
      return false;
    }

    // If no row existed (classification maybe missing), create minimal row
    if (!data || data.length === 0) {
      const fallback = await supabase
        .from("video_classifications")
        .insert({
          user_id,
          video_id,
          watch_seconds,
          updated_at: nowIso,
          created_at: nowIso,
        });

      if (fallback.error) {
        console.error("[Supabase] Error inserting watch time fallback:", fallback.error);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error("[Supabase] Exception updating watch time:", error);
    return false;
  }
}

/**
 * Insert batched watch sessions into video_sessions table
 * @param events - Array of watch event objects: { video_id, title, channel, seconds, started_at, finished_at }
 * @param userId - User ID (email for now)
 * @returns true if successful, false otherwise
 */
export async function insertVideoSessions(
  events: Array<{
    video_id: string;
    video_title?: string | null;
    channel_name?: string | null;
    watch_seconds: number;
    watched_at: string;
    distraction_level?: string | null;
    category_primary?: string | null;
    confidence_distraction?: number | null;
  }>,
  userId: string
): Promise<boolean> {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      console.warn("[Supabase] Credentials not set, cannot insert video sessions");
      return false;
    }

    if (!events || events.length === 0) {
      return true; // Nothing to insert
    }

    if (!userId) {
      console.warn("[Supabase] Missing user_id for video sessions insert");
      return false;
    }

    const nowIso = new Date().toISOString();
    const rows = events.map((event) => ({
      user_id: userId,
      video_id: event.video_id,
      video_title: event.video_title || null,
      channel_name: event.channel_name || null,
      watch_seconds: event.watch_seconds,
      watched_at: event.watched_at || nowIso,
      distraction_level: event.distraction_level || null,
      category_primary: event.category_primary || null,
      confidence_distraction: event.confidence_distraction ?? null,
      created_at: nowIso,
    }));

    // Insert batch
    const { error } = await supabase.from("video_sessions").insert(rows);

    if (error) {
      console.error("[Supabase] Error inserting video sessions:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[Supabase] Exception inserting video sessions:", error);
    return false;
  }
}

export async function pruneVideoData(days: number, userId?: string): Promise<boolean> {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      console.warn("[Supabase] Credentials not set, cannot prune video data");
      return false;
    }

    if (!days || days <= 0) {
      return true;
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffIso = cutoff.toISOString();

    const sessionQuery = supabase
      .from("video_sessions")
      .delete()
      .lt("watched_at", cutoffIso);

    if (userId) {
      sessionQuery.eq("user_id", userId);
    }

    const classificationQuery = supabase
      .from("video_classifications")
      .delete()
      .lt("updated_at", cutoffIso);

    if (userId) {
      classificationQuery.eq("user_id", userId);
    }

    const [{ error: sessionError }, { error: classificationError }] = await Promise.all([
      sessionQuery,
      classificationQuery,
    ]);

    if (sessionError) {
      console.error("[Supabase] Error pruning video_sessions:", sessionError);
      return false;
    }
    if (classificationError) {
      console.error("[Supabase] Error pruning video_classifications:", classificationError);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[Supabase] Exception pruning video data:", error);
    return false;
  }
}

/**
 * Insert journal entry into journal_entries table
 * @param payload - Journal entry data: { user_id, note, context }
 * @returns true if successful, false otherwise
 */
export async function insertJournalEntry(payload: {
  user_id: string;
  note: string;
  context?: {
    url?: string;
    title?: string;
    channel?: string;
    source?: string;
  };
}): Promise<boolean> {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      console.warn("[Supabase] Credentials not set, cannot insert journal entry");
      return false;
    }

    const { user_id, note, context } = payload;

    if (!user_id || !note || note.trim() === "") {
      console.warn("[Supabase] Missing user_id or note for journal entry");
      return false;
    }

    const nowIso = new Date().toISOString();
    const { error } = await supabase.from("journal_entries").insert({
      user_id,
      note: note.trim(),
      context_url: context?.url || null,
      context_title: context?.title || null,
      context_channel: context?.channel || null,
      context_source: context?.source || null,
      created_at: nowIso,
    });

    if (error) {
      console.error("[Supabase] Error inserting journal entry:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[Supabase] Exception inserting journal entry:", error);
    return false;
  }
}

