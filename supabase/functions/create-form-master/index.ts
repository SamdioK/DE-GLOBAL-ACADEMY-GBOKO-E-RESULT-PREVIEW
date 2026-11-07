
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@^1";

interface FormMasterPayload {
  school_id: string;
  full_name: string;
  username: string;
  email: string;
  phone?: string;
  gender: string;
  class_id: string;
  academic_session_id: string;
}

console.info("create-form-master function started");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(
  data: Record<string, unknown>,
  status = 200,
) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function generateTemporaryPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const special = "!@#$%*?";
  const all = upper + lower + digits + special;

  // Guarantee every required character category.
  const chars = [
    upper[crypto.getRandomValues(new Uint32Array(1))[0] % upper.length],
    lower[crypto.getRandomValues(new Uint32Array(1))[0] % lower.length],
    digits[crypto.getRandomValues(new Uint32Array(1))[0] % digits.length],
    special[crypto.getRandomValues(new Uint32Array(1))[0] % special.length],
  ];

  // Generate a 16-character password.
  const randomValues = new Uint32Array(12);
  crypto.getRandomValues(randomValues);

  for (const value of randomValues) {
    chars.push(all[value % all.length]);
  }

  // Cryptographically random Fisher-Yates shuffle.
  const shuffleValues = new Uint32Array(chars.length);
  crypto.getRandomValues(shuffleValues);

  for (let i = chars.length - 1; i > 0; i--) {
    const j = shuffleValues[i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    let createdUserId: string | null = null;
    let profileCreated = false;
    let assignmentCreated = false;

    try {
      if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
      }

      if (req.method !== "POST") {
        return jsonResponse(
          { success: false, error: "Only POST requests are allowed." },
          405,
        );
      }

      const callerId = ctx.userClaims?.id;

      if (!callerId) {
        return jsonResponse(
          { success: false, error: "Authentication is required." },
          401,
        );
      }

      const { data: administrator, error: adminError } =
        await ctx.supabaseAdmin
          .from("profiles")
          .select("id, school_id, role, is_active")
          .eq("id", callerId)
          .maybeSingle();

      if (adminError) throw adminError;

      if (
        !administrator ||
        administrator.role !== "administrator" ||
        administrator.is_active !== true
      ) {
        return jsonResponse(
          {
            success: false,
            error:
              "Only an active School Administrator can create a Form Master.",
          },
          403,
        );
      }

      let body: FormMasterPayload;

      try {
        body = await req.json();
      } catch {
        return jsonResponse(
          { success: false, error: "A valid JSON request body is required." },
          400,
        );
      }

      const schoolId = String(body.school_id || "").trim();
      const fullName = String(body.full_name || "").trim();
      const username = String(body.username || "").trim();
      const email = String(body.email || "").trim().toLowerCase();
      const phone = String(body.phone || "").trim();
      const gender = String(body.gender || "").trim();
      const classId = String(body.class_id || "").trim();
      const academicSessionId =
        String(body.academic_session_id || "").trim();

      // The frontend does not supply a password.
      // The server generates it securely.
      if (
        !schoolId ||
        !fullName ||
        !username ||
        !email ||
        !classId ||
        !academicSessionId ||
        !gender
      ) {
        return jsonResponse(
          {
            success: false,
            error:
              "School, full name, username, email, gender, class and academic session are required.",
          },
          400,
        );
      }

      if (!["Male", "Female"].includes(gender)) {
        return jsonResponse(
          { success: false, error: "Select a valid gender." },
          400,
        );
      }

      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        email.length > 254
      ) {
        return jsonResponse(
          { success: false, error: "Enter a valid email address." },
          400,
        );
      }

      if (fullName.length > 150 || username.length > 150) {
        return jsonResponse(
          { success: false, error: "Name or username is too long." },
          400,
        );
      }

      if (administrator.school_id !== schoolId) {
        return jsonResponse(
          {
            success: false,
            error:
              "You are not authorised to create a Form Master for this school.",
          },
          403,
        );
      }

      // Confirm that the school exists.
      const { data: school, error: schoolError } =
        await ctx.supabaseAdmin
          .from("schools")
          .select("id")
          .eq("id", schoolId)
          .maybeSingle();

      if (schoolError) throw schoolError;

      if (!school) {
        return jsonResponse(
          { success: false, error: "The selected school was not found." },
          400,
        );
      }

      // Confirm that the class belongs to this school.
      const { data: schoolClass, error: classError } =
        await ctx.supabaseAdmin
          .from("classes")
          .select("id")
          .eq("id", classId)
          .eq("school_id", schoolId)
          .maybeSingle();

      if (classError) throw classError;

      if (!schoolClass) {
        return jsonResponse(
          {
            success: false,
            error: "The selected class does not belong to this school.",
          },
          400,
        );
      }

      // Confirm that the academic session belongs to this school.
      const { data: session, error: sessionError } =
        await ctx.supabaseAdmin
          .from("academic_sessions")
          .select("id")
          .eq("id", academicSessionId)
          .eq("school_id", schoolId)
          .maybeSingle();

      if (sessionError) throw sessionError;

      if (!session) {
        return jsonResponse(
          {
            success: false,
            error:
              "The selected academic session does not belong to this school.",
          },
          400,
        );
      }

      // Prevent duplicate class/session assignments.
      const { data: existingAssignment, error: assignmentCheckError } =
        await ctx.supabaseAdmin
          .from("form_master_assignments")
          .select("id")
          .eq("school_id", schoolId)
          .eq("class_id", classId)
          .eq("academic_session_id", academicSessionId)
          .limit(1);

      if (assignmentCheckError) throw assignmentCheckError;

      if (existingAssignment && existingAssignment.length > 0) {
        return jsonResponse(
          {
            success: false,
            error:
              "A Form Master is already assigned to this class for the selected academic session.",
          },
          409,
        );
      }

      // Prevent duplicate usernames within the school.
      const { data: existingUsername, error: usernameCheckError } =
        await ctx.supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("school_id", schoolId)
          .eq("username", username)
          .limit(1);

      if (usernameCheckError) throw usernameCheckError;

      if (existingUsername && existingUsername.length > 0) {
        return jsonResponse(
          {
            success: false,
            error: "This username is already in use at this school.",
          },
          409,
        );
      }

      const temporaryPassword = generateTemporaryPassword();

      // Create the authentication account.
      const { data: authData, error: authError } =
        await ctx.supabaseAdmin.auth.admin.createUser({
          email,
          password: temporaryPassword,
          email_confirm: true,
          user_metadata: {
            full_name: fullName,
            username,
            phone: phone || null,
            gender,
            role: "form_master",
            school_id: schoolId,
            must_change_password: true,
          },
        });

      if (authError) {
        if (
          /already been registered|already exists|duplicate/i.test(
            authError.message,
          )
        ) {
          return jsonResponse(
            {
              success: false,
              error:
                "This email address is already registered. Use the correct existing account or another authorised email address.",
            },
            409,
          );
        }

        throw authError;
      }

      if (!authData.user) {
        throw new Error(
          "Supabase did not return the newly created user account.",
        );
      }

      createdUserId = authData.user.id;

      // Create the application profile.
      const { error: profileError } =
        await ctx.supabaseAdmin.from("profiles").insert({
          id: createdUserId,
          school_id: schoolId,
          full_name: fullName,
          username,
          phone: phone || null,
          email,
          gender,
          role: "form_master",
          is_active: true,
          must_change_password: true,
        });

      if (profileError) throw profileError;
      profileCreated = true;

      // Assign the Form Master to the selected class and session.
      const { data: assignment, error: assignmentError } =
        await ctx.supabaseAdmin
          .from("form_master_assignments")
          .insert({
            school_id: schoolId,
            teacher_id: createdUserId,
            class_id: classId,
            academic_session_id: academicSessionId,
          })
          .select("id")
          .single();

      if (assignmentError) throw assignmentError;
      assignmentCreated = true;

      // Return the temporary password only after all steps succeed.
      return jsonResponse(
        {
          success: true,
          message:
            "Form Master account created and assigned successfully. The teacher must change the temporary password at first login.",
          form_master: {
            id: createdUserId,
            school_id: schoolId,
            full_name: fullName,
            username,
            email,
            gender,
            role: "form_master",
            is_active: true,
            must_change_password: true,
            class_id: classId,
            academic_session_id: academicSessionId,
            assignment_id: assignment.id,
          },
          email,
          temporary_password: temporaryPassword,
        },
        201,
      );
    } catch (error) {
      console.error(
        "create-form-master failed:",
        error instanceof Error ? error.message : "Unknown error",
      );

      // Best-effort cleanup if a later step failed.
      if (createdUserId) {
        try {
          if (assignmentCreated) {
            await ctx.supabaseAdmin
              .from("form_master_assignments")
              .delete()
              .eq("teacher_id", createdUserId);
          }

          if (profileCreated) {
            await ctx.supabaseAdmin
              .from("profiles")
              .delete()
              .eq("id", createdUserId);
          }

          await ctx.supabaseAdmin.auth.admin.deleteUser(createdUserId);
        } catch (cleanupError) {
          console.error(
            "create-form-master cleanup failed:",
            cleanupError instanceof Error
              ? cleanupError.message
              : "Unknown cleanup error",
          );
        }
      }

      return jsonResponse(
        {
          success: false,
          error:
            "The Form Master account could not be completed. Check the Edge Function logs for the underlying database or authentication error.",
        },
        500,
      );
    }
  }),
};
