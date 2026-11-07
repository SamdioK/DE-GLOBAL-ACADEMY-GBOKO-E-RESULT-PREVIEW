
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return respond({ error: "Method not allowed." }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return respond({
        error: "Required Supabase environment variables are missing.",
      }, 500);
    }

    const authorization = req.headers.get("Authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return respond({
        error: "Your session has expired. Please sign in again.",
      }, 401);
    }

    const token = authorization.slice(7);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: userData, error: userError } =
      await userClient.auth.getUser();

    if (userError || !userData.user) {
      return respond({
        error: "Invalid or expired session. Please sign in again.",
      }, 401);
    }

    const user = userData.user;

    let body: {
      new_password?: string;
      password?: string;
      confirm_password?: string;
    };

    try {
      body = await req.json();
    } catch {
      return respond({ error: "Invalid request body." }, 400);
    }

    const newPassword = body.new_password ?? body.password;

    if (typeof newPassword !== "string" || newPassword.length < 8) {
      return respond({
        error: "Your new password must contain at least 8 characters.",
      }, 400);
    }

    if (newPassword.length > 128) {
      return respond({
        error: "Your new password is too long.",
      }, 400);
    }

    if (
      body.confirm_password !== undefined &&
      body.confirm_password !== newPassword
    ) {
      return respond({
        error: "The new password and confirmation do not match.",
      }, 400);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id, school_id, role, is_active, must_change_password")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Profile lookup failed:", profileError.message);
      return respond({ error: "Could not verify your account." }, 500);
    }

    if (
      !profile ||
      profile.role !== "form_master" ||
      profile.is_active !== true
    ) {
      return respond({
        error: "Only an active Form Master can use this password-change function.",
      }, 403);
    }

    // Update the password using the authenticated user's own session.
    // No administrator password or service-role key is exposed to the user.
    const updatedMetadata = {
      ...(user.user_metadata ?? {}),
      must_change_password: false,
    };

    const { error: passwordError } =
  await adminClient.auth.admin.updateUserById(user.id, {
    password: newPassword,
    user_metadata: updatedMetadata,
  });

    if (passwordError) {
      console.error("Password update failed:", passwordError.message);
      return respond({
        error: "Password update failed. Please check your new password and try again.",
      }, 400);
    }

    // Clear the profile flag only after Supabase confirms the password update.
    const { error: flagError } = await adminClient
      .from("profiles")
      .update({ must_change_password: false })
      .eq("id", user.id)
      .eq("role", "form_master")
      .eq("is_active", true);

    if (flagError) {
      console.error(
        "Password changed, but profile flag update failed:",
        flagError.message,
      );

      return respond({
        success: false,
        password_changed: true,
        error:
          "Your password was changed, but the account setup could not be completed. Please contact the school administrator.",
      }, 500);
    }

    return respond({
      success: true,
      message: "Your password has been changed successfully.",
      must_change_password: false,
    });
  } catch (error) {
    console.error(
      "Unexpected password-change error:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return respond({
      error: "An unexpected error occurred. Please try again.",
    }, 500);
  }
});
