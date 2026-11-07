
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type JsonObject = Record<string, unknown>;

function reply(data: JsonObject, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function fail(message: string, status = 400): Response {
  return reply({ success: false, error: message }, status);
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isValidEmail(email: string): boolean {
  return (
    email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  );
}

function logError(label: string, error: unknown): void {
  console.error(
    label,
    error instanceof Error ? error.message : String(error),
  );
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return fail("Only POST requests are allowed.", 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceKey) {
      console.error("Required Supabase environment variables are missing.");
      return fail("Server configuration error.", 500);
    }

    const authorization = req.headers.get("Authorization") ?? "";
    const tokenMatch = authorization.match(/^Bearer\s+(.+)$/i);

    if (!tokenMatch) {
      return fail("Authentication is required. Please log in.", 401);
    }

    const token = tokenMatch[1];

    const userClient = createClient(supabaseUrl, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
    });

    const {
      data: userData,
      error: authenticationError,
    } = await userClient.auth.getUser(token);

    if (authenticationError || !userData.user) {
      return fail(
        "Your session is invalid or expired. Please log in again.",
        401,
      );
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: administrator,
      error: administratorError,
    } = await admin
      .from("profiles")
      .select("id, school_id, role, is_active")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (administratorError) {
      logError("Administrator lookup failed:", administratorError);
      return fail("Unable to verify administrator access.", 500);
    }

    if (
      !administrator ||
      administrator.role !== "administrator" ||
      administrator.is_active !== true ||
      !administrator.school_id
    ) {
      return fail(
        "Only an active school administrator can manage Form Masters.",
        403,
      );
    }

    const schoolId = administrator.school_id;

    let body: JsonObject;

    try {
      const parsed: unknown = await req.json();

      if (
        parsed === null ||
        typeof parsed !== "object" ||
        Array.isArray(parsed)
      ) {
        return fail("The request body must be a JSON object.", 400);
      }

      body = parsed as JsonObject;
    } catch {
      return fail("A valid JSON request body is required.", 400);
    }

    const action = cleanString(body.action);

    // ---------------------------------------------------------
    // LIST ASSIGNMENTS
    // ---------------------------------------------------------
    if (action === "list_assignments") {
      const {
        data: sessions,
        error: sessionError,
      } = await admin
        .from("academic_sessions")
        .select("id, name")
        .eq("school_id", schoolId)
        .eq("is_current", true);

      if (sessionError) {
        logError("Current session lookup failed:", sessionError);
        return fail("Unable to load the current academic session.", 500);
      }

      if (!sessions?.length) {
        return reply({ success: true, assignments: [] });
      }

      const sessionIds = sessions.map((session) => session.id);

      const {
        data: assignments,
        error: assignmentError,
      } = await admin
        .from("form_master_assignments")
        .select(
          "id, school_id, teacher_id, class_id, academic_session_id",
        )
        .eq("school_id", schoolId)
        .in("academic_session_id", sessionIds);

      if (assignmentError) {
        logError("Assignment lookup failed:", assignmentError);
        return fail("Unable to load Form Master assignments.", 500);
      }

      if (!assignments?.length) {
        return reply({ success: true, assignments: [] });
      }

      const teacherIds = [
        ...new Set(assignments.map((item) => item.teacher_id)),
      ];

      const classIds = [
        ...new Set(assignments.map((item) => item.class_id)),
      ];

      const [
        { data: profiles, error: profilesError },
        { data: classes, error: classesError },
      ] = await Promise.all([
        admin
          .from("profiles")
          .select(
            "id, full_name, email, gender, role, is_active, school_id",
          )
          .eq("school_id", schoolId)
          .in("id", teacherIds),
        admin
          .from("classes")
          .select("id, class_name, school_id")
          .eq("school_id", schoolId)
          .in("id", classIds),
      ]);

      if (profilesError || classesError) {
        if (profilesError) {
          logError("Teacher profile lookup failed:", profilesError);
        }

        if (classesError) {
          logError("Class lookup failed:", classesError);
        }

        return fail("Unable to load teacher and class details.", 500);
      }

      const profileMap = new Map(
        (profiles ?? []).map((profile) => [profile.id, profile]),
      );

      const classMap = new Map(
        (classes ?? []).map((schoolClass) => [
          schoolClass.id,
          schoolClass,
        ]),
      );

      const sessionMap = new Map(
        sessions.map((session) => [session.id, session.name]),
      );

      const result = assignments.map((assignment) => {
        const profile = profileMap.get(assignment.teacher_id);
        const schoolClass = classMap.get(assignment.class_id);

        return {
          id: assignment.id,
          assignment_id: assignment.id,
          school_id: assignment.school_id,
          teacher_id: assignment.teacher_id,
          class_id: assignment.class_id,
          academic_session_id: assignment.academic_session_id,
          full_name: profile?.full_name ?? null,
          email: profile?.email ?? null,
          gender: profile?.gender ?? null,
          role: profile?.role ?? null,
          is_active: profile?.is_active ?? false,
          class_name: schoolClass?.class_name ?? null,
          academic_session:
            sessionMap.get(assignment.academic_session_id) ?? null,
        };
      });

      return reply({
        success: true,
        assignments: result,
      });
    }

    // ---------------------------------------------------------
    // UPDATE TEACHER DETAILS AND CLASS ASSIGNMENT
    // ---------------------------------------------------------
    if (action === "update_assignment") {
      const assignmentId = cleanString(body.assignment_id);
      const teacherId = cleanString(body.teacher_id);
      const academicSessionId = cleanString(body.academic_session_id);
      const classId = cleanString(body.class_id);
      const fullName = cleanString(body.full_name);
      const email = cleanString(body.email).toLowerCase();
      const gender = cleanString(body.gender);

      if (
        !assignmentId ||
        !teacherId ||
        !academicSessionId ||
        !classId ||
        !fullName ||
        fullName.length > 150 ||
        !isValidEmail(email) ||
        !["Male", "Female"].includes(gender)
      ) {
        return fail(
          "Provide a valid assignment, teacher, current session, class, full name, email and gender.",
          400,
        );
      }

      const {
        data: assignment,
        error: assignmentLookupError,
      } = await admin
        .from("form_master_assignments")
        .select(
          "id, school_id, teacher_id, class_id, academic_session_id",
        )
        .eq("id", assignmentId)
        .eq("school_id", schoolId)
        .eq("teacher_id", teacherId)
        .eq("academic_session_id", academicSessionId)
        .maybeSingle();

      if (assignmentLookupError) {
        logError("Assignment verification failed:", assignmentLookupError);
        return fail("Unable to verify the assignment.", 500);
      }

      if (!assignment) {
        return fail("Assignment not found in your school.", 404);
      }

      const {
        data: session,
        error: sessionError,
      } = await admin
        .from("academic_sessions")
        .select("id")
        .eq("id", academicSessionId)
        .eq("school_id", schoolId)
        .eq("is_current", true)
        .maybeSingle();

      if (sessionError) {
        logError("Session validation failed:", sessionError);
        return fail("Unable to verify the academic session.", 500);
      }

      if (!session) {
        return fail(
          "The selected academic session is not the current session for your school.",
          400,
        );
      }

      const {
        data: targetClass,
        error: classError,
      } = await admin
        .from("classes")
        .select("id")
        .eq("id", classId)
        .eq("school_id", schoolId)
        .maybeSingle();

      if (classError) {
        logError("Class validation failed:", classError);
        return fail("Unable to verify the selected class.", 500);
      }

      if (!targetClass) {
        return fail("The selected class does not belong to your school.", 400);
      }

      const {
        data: teacher,
        error: teacherError,
      } = await admin
        .from("profiles")
        .select(
          "id, school_id, full_name, username, phone, email, gender, role, is_active",
        )
        .eq("id", teacherId)
        .eq("school_id", schoolId)
        .maybeSingle();

      if (teacherError) {
        logError("Teacher lookup failed:", teacherError);
        return fail("Unable to verify the teacher profile.", 500);
      }

      if (
        !teacher ||
        teacher.role !== "form_master" ||
        teacher.is_active !== true
      ) {
        return fail(
          "The teacher is unavailable or is not an active Form Master.",
          400,
        );
      }

      // Prevent another assignment from occupying the target class.
      const {
        data: occupied,
        error: occupiedError,
      } = await admin
        .from("form_master_assignments")
        .select("id")
        .eq("school_id", schoolId)
        .eq("class_id", classId)
        .eq("academic_session_id", academicSessionId)
        .neq("id", assignmentId)
        .limit(1)
        .maybeSingle();

      if (occupiedError) {
        logError("Class occupancy check failed:", occupiedError);
        return fail("Unable to validate class availability.", 500);
      }

      if (occupied) {
        return fail(
          "That class already has a Form Master for this session.",
          409,
        );
      }

      const newEmail = email;
      const oldEmail = cleanString(teacher.email).toLowerCase();

      // Ensure that no other profile uses this email.
      const {
        data: existingEmailProfiles,
        error: emailCheckError,
      } = await admin
        .from("profiles")
        .select("id")
        .ilike("email", newEmail)
        .neq("id", teacherId)
        .limit(1);

      if (emailCheckError) {
        logError("Email uniqueness check failed:", emailCheckError);
        return fail("Unable to validate the email address.", 500);
      }

      if (existingEmailProfiles?.length) {
        return fail(
          "That email address is already used by another profile.",
          409,
        );
      }

      // Load the existing Auth user before changing anything.
      const {
        data: authLookup,
        error: authLookupError,
      } = await admin.auth.admin.getUserById(teacherId);

      if (authLookupError || !authLookup.user) {
        if (authLookupError) {
          logError("Auth user lookup failed:", authLookupError);
        }

        return fail(
          "The teacher's authentication account could not be verified.",
          500,
        );
      }

      const authUser = authLookup.user;
      const previousClassId = assignment.class_id;

      const previousProfile = {
        full_name: teacher.full_name,
        email: teacher.email,
        gender: teacher.gender,
      };

      // Save profile fields and confirm that exactly one profile changed.
      const {
        data: updatedProfiles,
        error: profileUpdateError,
      } = await admin
        .from("profiles")
        .update({
          full_name: fullName,
          email: newEmail,
          gender,
        })
        .eq("id", teacherId)
        .eq("school_id", schoolId)
        .eq("role", "form_master")
        .select("id, full_name, email, gender");

      if (profileUpdateError) {
        logError("Profile update failed:", profileUpdateError);
        return fail("Unable to save the teacher's profile.", 500);
      }

      if (!updatedProfiles || updatedProfiles.length !== 1) {
        return fail(
          "The teacher profile update could not be confirmed.",
          500,
        );
      }

      // Update the assignment if the class has changed.
      if (classId !== previousClassId) {
        const {
          data: updatedAssignments,
          error: assignmentUpdateError,
        } = await admin
          .from("form_master_assignments")
          .update({ class_id: classId })
          .eq("id", assignmentId)
          .eq("school_id", schoolId)
          .eq("teacher_id", teacherId)
          .eq("academic_session_id", academicSessionId)
          .select("id");

        if (
          assignmentUpdateError ||
          !updatedAssignments ||
          updatedAssignments.length !== 1
        ) {
          if (assignmentUpdateError) {
            logError(
              "Assignment update failed:",
              assignmentUpdateError,
            );
          }

          // Restore the old profile values if the assignment update fails.
          const { error: rollbackError } = await admin
            .from("profiles")
            .update(previousProfile)
            .eq("id", teacherId)
            .eq("school_id", schoolId)
            .eq("role", "form_master");

          if (rollbackError) {
            logError("Profile rollback failed:", rollbackError);
          }

          return fail(
            "The class assignment could not be saved. The previous profile values were restored where possible; refresh and verify the records.",
            500,
          );
        }
      }

      // Keep Auth email and metadata aligned with the saved profile.
      const previousMetadata = authUser.user_metadata ?? {};
      const updatedMetadata = {
        ...previousMetadata,
        full_name: fullName,
        gender,
        role: "form_master",
        school_id: schoolId,
        must_change_password:
          previousMetadata.must_change_password === true,
      };

      const {
        error: authUpdateError,
      } = await admin.auth.admin.updateUserById(teacherId, {
        email: newEmail,
        email_confirm: true,
        user_metadata: updatedMetadata,
      });

      if (authUpdateError) {
        logError("Auth user update failed:", authUpdateError);

        // Best-effort rollback of the database changes.
        const { error: profileRollbackError } = await admin
          .from("profiles")
          .update(previousProfile)
          .eq("id", teacherId)
          .eq("school_id", schoolId)
          .eq("role", "form_master");

        if (profileRollbackError) {
          logError("Profile rollback failed:", profileRollbackError);
        }

        if (classId !== previousClassId) {
          const { error: assignmentRollbackError } = await admin
            .from("form_master_assignments")
            .update({ class_id: previousClassId })
            .eq("id", assignmentId)
            .eq("school_id", schoolId)
            .eq("teacher_id", teacherId)
            .eq("academic_session_id", academicSessionId);

          if (assignmentRollbackError) {
            logError(
              "Assignment rollback failed:",
              assignmentRollbackError,
            );
          }
        }

        return fail(
          "The authentication account could not be updated. The function attempted to restore the previous database values; verify the teacher record before retrying.",
          500,
        );
      }

      return reply({
        success: true,
        message: "Form Master details and assignment updated successfully.",
        form_master: {
          id: teacherId,
          full_name: fullName,
          email: newEmail,
          gender,
          role: "form_master",
          is_active: true,
          class_id: classId,
          academic_session_id: academicSessionId,
          assignment_id: assignmentId,
        },
      });
    }

    // ---------------------------------------------------------
    // REMOVE ONLY THE SELECTED CLASS ASSIGNMENT
    // ---------------------------------------------------------
    if (action === "remove_assignment") {
      const assignmentId = cleanString(body.assignment_id);
      const teacherId = cleanString(body.teacher_id);
      const academicSessionId = cleanString(body.academic_session_id);

      if (!assignmentId || !teacherId || !academicSessionId) {
        return fail(
          "Assignment ID, teacher ID and academic session are required.",
          400,
        );
      }

      const {
        data: assignment,
        error: lookupError,
      } = await admin
        .from("form_master_assignments")
        .select("id")
        .eq("id", assignmentId)
        .eq("school_id", schoolId)
        .eq("teacher_id", teacherId)
        .eq("academic_session_id", academicSessionId)
        .maybeSingle();

      if (lookupError) {
        logError("Assignment verification failed:", lookupError);
        return fail("Unable to verify the assignment.", 500);
      }

      if (!assignment) {
        return fail("Assignment not found in your school.", 404);
      }

      const {
        data: deletedAssignments,
        error: deleteError,
      } = await admin
        .from("form_master_assignments")
        .delete()
        .eq("id", assignmentId)
        .eq("school_id", schoolId)
        .eq("teacher_id", teacherId)
        .eq("academic_session_id", academicSessionId)
        .select("id");

      if (deleteError) {
        logError("Assignment removal failed:", deleteError);
        return fail("Unable to remove the class assignment.", 500);
      }

      if (!deletedAssignments || deletedAssignments.length !== 1) {
        return fail(
          "Assignment removal could not be confirmed. Refresh and verify the assignment list.",
          409,
        );
      }

      // Intentionally preserve the teacher's Auth account, profile,
      // role, results, and any other class assignments.
      return reply({
        success: true,
        message:
          "Class assignment removed. The teacher account, profile, role, results and other assignments were preserved.",
        assignment_id: assignmentId,
      });
    }

    return fail("Unsupported action.", 400);
  } catch (error) {
    logError("manage-form-master unexpected error:", error);
    return fail("An unexpected server error occurred.", 500);
  }
});
