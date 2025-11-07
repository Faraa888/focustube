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
 * Get user plan from Supabase
 * @param email - User email
 * @returns User plan ("free" | "pro") or null if user not found
 */
export async function getUserPlan(email: string): Promise<string | null> {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      console.warn("[Supabase] Credentials not set, returning default plan");
      return "free";
    }

    const { data, error } = await supabase
      .from("users")
      .select("plan")
      .eq("email", email)
      .single();

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
    if (typeof plan === "string") {
      return plan.toLowerCase();
    }

    return "free";
  } catch (error) {
    console.error("[Supabase] Exception getting user plan:", error);
    return null;
  }
}

/**
 * Update user plan in Supabase
 * @param email - User email
 * @param plan - New plan ("free" | "pro")
 * @returns true if updated successfully, false otherwise
 */
export async function updateUserPlan(
  email: string,
  plan: string
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

    if (existingUser) {
      // User exists - update plan
      const { error } = await supabase
        .from("users")
        .update({ plan, updated_at: new Date().toISOString() })
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
        plan,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
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

