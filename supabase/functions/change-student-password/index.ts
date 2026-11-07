
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function respond(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
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
    return respond({ error: "Use POST for this function." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey =
    Deno.env.get("SUPABASE_ANON_KEY") ??
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = req.headers.get("Authorization");

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return respond({ error: "Required server configuration is missing." }, 500);
  }

  if (!authorization || !authorization.startsWith("Bearer ")) {
    return respond({ error: "Please sign in first." }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: {
      headers: { Authorization: authorization },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  try {
    // Verify the caller's actual Supabase Auth session.
    const { data: authResult, error: authError } =
      await userClient.auth.getUser();

    if (authError || !authResult.user) {
      return respond({ error: "Your session is invalid or expired." }, 401);
    }

    const user = authResult.user;

    // Only an active student profile linked to a student record is allowed.
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id, school_id, role, is_active, must_change_password")
      .eq("id", user.id)
      .maybeSingle();

    if (
      profileError ||
      !profile ||
      profile.role !== "student" ||
      profile.is_active !== true ||
      !profile.school_id
    ) {
      return respond(
        { error: "An active student account is required." },
        403,
      );
    }

    const { data: student, error: studentError } = await adminClient
      .from("students")
      .select("id, school_id, profile_id, status")
      .eq("profile_id", user.id)
      .eq("school_id", profile.school_id)
      .maybeSingle();

    if (
      studentError ||
      !student ||
      student.status !== "active"
    ) {
      return respond(
        { error: "Your active student record could not be verified." },
        403,
      );
    }

    let body: { new_password?: unknown };

    try {
      body = await req.json();
    } catch {
      return respond({ error: "The request body must be valid JSON." }, 400);
    }

    if (typeof body.new_password !== "string") {
      return respond({ error: "Provide a new password." }, 400);
    }

    const newPassword = body.new_password;

    // Require at least 12 characters, including uppercase, lowercase,
    // a number and a symbol.
    if (
      newPassword.length < 12 ||
      newPassword.length > 128 ||
      !/[A-Z]/.test(newPassword) ||
      !/[a-z]/.test(newPassword) ||
      !/[0-9]/.test(newPassword) ||
      !/[^A-Za-z0-9]/.test(newPassword)
    ) {
      return respond(
        {
          error:
            "Use 12–128 characters, including uppercase and lowercase letters, a number and a symbol.",
        },
        400,
      );
    }

    // Prevent an unnecessary password reset if the first-login flag is off.
    if (profile.must_change_password !== true) {
      return respond(
        { error: "A first-login password change is not currently required." },
        409,
      );
    }

    // Update the password for this authenticated user only.
    const { error: passwordError } =
      await adminClient.auth.admin.updateUserById(user.id, {
        password: newPassword,
      });

    if (passwordError) {
      return respond(
        { error: "The new password could not be saved. Please try again." },
        500,
      );
    }

    // Clear the flag only after the password update succeeds.
    const { data: updatedProfile, error: flagError } = await adminClient
      .from("profiles")
      .update({ must_change_password: false })
      .eq("id", user.id)
      .eq("school_id", profile.school_id)
      .eq("role", "student")
      .eq("is_active", true)
      .select("id")
      .maybeSingle();

    if (flagError || !updatedProfile) {
      // Do not grant dashboard access: the flag remains uncleared if this
      // update fails. The password may have changed, so the student should
      // retry the password-change flow rather than access the dashboard.
      return respond(
        {
          error:
            "The password was updated, but the security status could not be confirmed. Please contact the school administrator.",
        },
        500,
      );
    }

    return respond({
      success: true,
      message:
        "Password changed successfully. Sign in again using your new password.",
      sign_in_again: true,
    });
  } catch (_error) {
    return respond(
      { error: "Password change failed. Please try again or contact the administrator." },
      500,
    );
  }
});
