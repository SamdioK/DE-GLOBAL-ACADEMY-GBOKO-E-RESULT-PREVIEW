
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function makeTemporaryPassword(): string {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const random = new Uint32Array(24);
  crypto.getRandomValues(random);

  return Array.from(random, (n) => alphabet[n % alphabet.length]).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return jsonResponse({
        error: "Required Supabase environment variables are missing.",
      }, 500);
    }

    const authorization = req.headers.get("Authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Administrator authentication required." }, 401);
    }

    const token = authorization.slice(7);

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: authData, error: authError } =
      await authClient.auth.getUser(token);

    if (authError || !authData.user) {
      return jsonResponse({ error: "Invalid or expired administrator session." }, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const administratorId = authData.user.id;

    const { data: administrator, error: administratorError } =
      await adminClient
        .from("profiles")
        .select("id, school_id, role, is_active")
        .eq("id", administratorId)
        .maybeSingle();

    if (
      administratorError ||
      !administrator ||
      administrator.is_active !== true ||
      administrator.role !== "administrator" ||
      !administrator.school_id
    ) {
      return jsonResponse({
        error: "Only an active school administrator can reset Form Master passwords.",
      }, 403);
    }

    let body: { teacher_id?: string };

    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid request body." }, 400);
    }

    const teacherId = body.teacher_id;

    if (
      typeof teacherId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        teacherId,
      )
    ) {
      return jsonResponse({ error: "A valid teacher_id is required." }, 400);
    }

    const { data: teacher, error: teacherError } = await adminClient
      .from("profiles")
      .select("id, school_id, full_name, email, role, is_active, must_change_password")
      .eq("id", teacherId)
      .maybeSingle();

    if (teacherError || !teacher) {
      return jsonResponse({ error: "Form Master account was not found." }, 404);
    }

    if (
      teacher.school_id !== administrator.school_id ||
      teacher.role !== "form_master" ||
      teacher.is_active !== true
    ) {
      return jsonResponse({
        error: "The selected account is not an active Form Master in your school.",
      }, 403);
    }

    const { data: assignment, error: assignmentError } = await adminClient
      .from("form_master_assignments")
      .select("id")
      .eq("teacher_id", teacherId)
      .eq("school_id", administrator.school_id)
      .limit(1)
      .maybeSingle();

    if (assignmentError) {
      return jsonResponse({
        error: "Could not verify the Form Master assignment.",
      }, 500);
    }

    if (!assignment) {
      return jsonResponse({
        error: "This Form Master has no assignment in your school.",
      }, 404);
    }

    const { data: authUserData, error: authUserError } =
      await adminClient.auth.admin.getUserById(teacherId);

    if (authUserError || !authUserData.user) {
      return jsonResponse({
        error: "The Form Master's authentication account could not be found.",
      }, 404);
    }

    const temporaryPassword = makeTemporaryPassword();
    const previousMustChange = teacher.must_change_password;

    const { error: profileUpdateError } = await adminClient
      .from("profiles")
      .update({ must_change_password: true })
      .eq("id", teacherId)
      .eq("school_id", administrator.school_id)
      .eq("role", "form_master");

    if (profileUpdateError) {
      return jsonResponse({
        error: "Could not prepare the account for a password change.",
      }, 500);
    }

    const oldMetadata = authUserData.user.user_metadata ?? {};

    const { error: passwordUpdateError } =
      await adminClient.auth.admin.updateUserById(teacherId, {
        password: temporaryPassword,
        user_metadata: {
          ...oldMetadata,
          must_change_password: true,
        },
      });

    if (passwordUpdateError) {
      const { error: rollbackError } = await adminClient
        .from("profiles")
        .update({ must_change_password: previousMustChange })
        .eq("id", teacherId)
        .eq("school_id", administrator.school_id);

      console.error("Form Master password reset failed.", {
        passwordUpdateError: passwordUpdateError.message,
        rollbackFailed: Boolean(rollbackError),
      });

      return jsonResponse({
        error: rollbackError
          ? "Password reset failed and account state needs administrator review."
          : "Password reset failed. The existing password should remain unchanged.",
      }, 500);
    }

    console.log("Form Master password reset completed.", {
      teacherId,
      administratorId,
      schoolId: administrator.school_id,
    });

    return jsonResponse({
      success: true,
      message: "Form Master password reset successfully.",
      teacher_id: teacherId,
      full_name: teacher.full_name,
      email: teacher.email,
      temporary_password: temporaryPassword,
      password: temporaryPassword,
      must_change_password: true,
    });
  } catch (error) {
    console.error(
      "Unexpected Form Master password reset error:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return jsonResponse({
      error: "An unexpected error occurred while resetting the password.",
    }, 500);
  }
});
