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

