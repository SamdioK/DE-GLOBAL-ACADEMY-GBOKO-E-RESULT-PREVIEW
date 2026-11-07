
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

function generateTemporaryPassword(): string {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);

  let password = "";
  for (const byte of bytes) {
    password += alphabet[byte % alphabet.length];
  }
  return password;
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
    return respond({ error: "Sign in as an administrator first." }, 401);
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

  let studentId = "";
  let schoolId = "";
  let claimed = false;
  let newUserId = "";

  try {
    const { data: authResult, error: authError } =
      await userClient.auth.getUser();

    if (authError || !authResult.user) {
      return respond(
        { error: "Your login session is invalid or expired." },
        401,
      );
    }

    const callerId = authResult.user.id;

    const { data: administrator, error: profileError } = await adminClient
      .from("profiles")
      .select("id, school_id, role, is_active")
      .eq("id", callerId)
      .maybeSingle();

    if (
      profileError ||
      !administrator ||
      administrator.role !== "administrator" ||
      administrator.is_active !== true ||
      !administrator.school_id
    ) {
      return respond(
        {
          error:
            "Only an active school administrator can create student accounts.",
        },
        403,
      );
    }

    schoolId = administrator.school_id;

    let body: { student_id?: unknown };
    try {
      body = await req.json();
    } catch {
      return respond({ error: "The request body must be valid JSON." }, 400);
    }

    if (
      typeof body.student_id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        .test(body.student_id)
    ) {
      return respond({ error: "Provide a valid student_id UUID." }, 400);
    }

    studentId = body.student_id;

    const { data: student, error: studentError } = await adminClient
      .from("students")
      .select(
        "id, school_id, profile_id, admission_number, first_name, middle_name, last_name, status, login_status",
      )
      .eq("id", studentId)
      .eq("school_id", schoolId)
      .maybeSingle();

    if (studentError || !student) {
      return respond({ error: "Student not found in your school." }, 404);
    }

    if (
      student.status !== "active" ||
      !student.admission_number ||
      student.admission_number.startsWith("PENDING-")
    ) {
      return respond(
        {
          error:
            "The student must be active and have a valid admission number.",
        },
        409,
      );
    }

    if (student.profile_id || student.login_status === "created") {
      return respond(
        { error: "This student already has a login account." },
        409,
      );
    }

    if (student.login_status === "pending") {
      return respond(
        {
          error:
            "Account creation is already in progress for this student.",
        },
        409,
      );
    }

    const { data: enrolment, error: enrolmentError } = await adminClient
      .from("student_enrolments")
      .select("id")
      .eq("student_id", studentId)
      .eq("school_id", schoolId)
      .limit(1)
      .maybeSingle();

    if (enrolmentError || !enrolment) {
      return respond(
        {
          error:
            "The student must have an official enrolment before account creation.",
        },
        409,
      );
    }

    // Reserve the student record to prevent ordinary repeat requests.
    const { data: claimedRows, error: claimError } = await adminClient
      .from("students")
      .update({
        login_status: "pending",
        login_error: null,
      })
      .eq("id", studentId)
      .eq("school_id", schoolId)
      .in("login_status", ["not_created", "failed"])
      .is("profile_id", null)
      .select("id");

    if (claimError) {
      throw new Error("Could not reserve the student account record.");
    }

    if (!claimedRows || claimedRows.length !== 1) {
      return respond(
        {
          error:
            "The account is already being processed or has already been created.",
        },
        409,
      );
    }

    claimed = true;

    // Internal email; admission-number login must resolve this securely.
    const internalEmail =
      "student-" + studentId + "@students.deglobalacademy.invalid";

    const temporaryPassword = generateTemporaryPassword();

    const { data: authData, error: createAuthError } =
      await adminClient.auth.admin.createUser({
        email: internalEmail,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: {
          account_type: "student",
          student_id: studentId,
          school_id: schoolId,
        },
      });

    if (createAuthError || !authData.user) {
      throw new Error("Supabase Auth could not create the account.");
    }

    newUserId = authData.user.id;

    const fullName = [
      student.first_name,
      student.middle_name,
      student.last_name,
    ]
      .filter(
        (part) => typeof part === "string" && part.trim() !== "",
      )
      .join(" ");

    const username =
      "stu_" + studentId.replaceAll("-", "").slice(0, 16);

    // Create the student profile and require a password change at first login.
    const { error: insertProfileError } = await adminClient
      .from("profiles")
      .insert({
        id: newUserId,
        school_id: schoolId,
        full_name: fullName,
        username: username,
        email: internalEmail,
        role: "student",
        is_active: true,
        must_change_password: true,
      });

    if (insertProfileError) {
      throw new Error("Could not create the student's profile.");
    }

    const { error: insertRoleError } = await adminClient
      .from("profile_roles")
      .insert({
        profile_id: newUserId,
        role: "student",
        is_active: true,
      });

    if (insertRoleError) {
      throw new Error("Could not assign the student role.");
    }

    const { data: linkedRows, error: linkError } = await adminClient
      .from("students")
      .update({
        profile_id: newUserId,
        login_status: "created",
        login_created_at: new Date().toISOString(),
        login_error: null,
      })
      .eq("id", studentId)
      .eq("school_id", schoolId)
      .is("profile_id", null)
      .select("id");

    if (linkError || !linkedRows || linkedRows.length !== 1) {
      throw new Error("Could not link the login account to the student.");
    }

    claimed = false;

    // Return the temporary password once to the authenticated administrator.
    // Never store it in the database or write it to logs.
    return respond({
      success: true,
      admission_number: student.admission_number,
      temporary_password: temporaryPassword,
      message:
        "Account created. The student profile is marked as requiring a password change. Complete and test the secure first-login flow before using student accounts.",
    });
  } catch (_error) {
    // Remove a partially created account if provisioning did not complete.
    if (newUserId) {
      await adminClient.auth.admin.deleteUser(newUserId);
    }

    if (claimed && studentId && schoolId) {
      await adminClient
        .from("students")
        .update({
          login_status: "failed",
          login_error: "Account creation failed. Please retry.",
        })
        .eq("id", studentId)
        .eq("school_id", schoolId)
        .is("profile_id", null);
    }

    return respond(
      { error: "Account creation failed. Check the Edge Function logs." },
      500,
    );
  }
});

