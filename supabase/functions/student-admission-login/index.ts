import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function respond(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
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
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ??
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return respond({ error: "Required server configuration is missing." }, 500);
  }

  let body: { admission_number?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return respond({ error: "Invalid request." }, 400);
  }

  if (
    typeof body.admission_number !== "string" ||
    typeof body.password !== "string" ||
    body.admission_number.trim().length < 1 ||
    body.admission_number.trim().length > 100 ||
    body.password.length < 1 ||
    body.password.length > 128
  ) {
    return respond({ error: "Enter your admission number and password." }, 400);
  }

  const admissionNumber = body.admission_number.trim();
  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    // Login is limited to active student records with an account provisioned by an administrator.
    const { data: student, error: studentError } = await adminClient
      .from("students")
      .select("id, school_id, profile_id, admission_number, status, login_status")
      .eq("admission_number", admissionNumber)
      .maybeSingle();

    if (
      studentError ||
      !student ||
      student.status !== "active" ||
      student.login_status !== "created" ||
      !student.profile_id ||
      !student.school_id
    ) {
      return respond({ error: "Invalid admission number or password." }, 401);
    }

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id, school_id, email, role, is_active, must_change_password")
      .eq("id", student.profile_id)
      .eq("school_id", student.school_id)
      .maybeSingle();

    if (
      profileError ||
      !profile ||
      profile.role !== "student" ||
      profile.is_active !== true ||
      !profile.email
    ) {
      return respond({ error: "Invalid admission number or password." }, 401);
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authError } =
      await authClient.auth.signInWithPassword({
        email: profile.email,
        password: body.password,
      });

    if (
      authError ||
      !authData.user ||
      !authData.session ||
      authData.user.id !== student.profile_id
    ) {
      return respond({ error: "Invalid admission number or password." }, 401);
    }

    return respond({
      success: true,
      access_token: authData.session.access_token,
      refresh_token: authData.session.refresh_token,
      token_type: authData.session.token_type,
      expires_in: authData.session.expires_in,
      student: {
        admission_number: student.admission_number,
        must_change_password: profile.must_change_password === true,
      },
      message: profile.must_change_password === true
        ? "Sign-in successful. Complete the required password change."
        : "Sign-in successful.",
    });
  } catch (_error) {
    return respond({ error: "Sign-in could not be completed. Please try again." }, 500);
  }
});
