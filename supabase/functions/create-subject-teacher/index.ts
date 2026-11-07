import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@^1";

interface SubjectTeacherPayload {
  school_id: string;

  // Common fields
  full_name?: string;
  username?: string;
  email?: string;
  phone?: string;

  // Required only when creating a NEW staff account
  password?: string;

  // Set this when assigning an EXISTING staff member
  existing_profile_id?: string;

  class_id: string;
  subject_id: string;
  academic_session_id: string;
}

console.info("create-subject-teacher function started");

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    let createdUserId: string | null = null;
    let createdProfileId: string | null = null;
    let createdAssignmentId: string | null = null;
    let addedExistingRole = false;

    try {
      if (req.method !== "POST") {
        return Response.json(
          { error: "Only POST requests are allowed." },
          { status: 405 }
        );
      }

      const callerId = ctx.userClaims?.id;

      if (!callerId) {
        return Response.json(
          { error: "Authenticated user could not be identified." },
          { status: 401 }
        );
      }

      /*
       * ---------------------------------------------------------
       * 1. VERIFY CALLER
       * ---------------------------------------------------------
       */

      const { data: administrator, error: administratorError } =
        await ctx.supabaseAdmin
          .from("profiles")
          .select("id, school_id, role, is_active")
          .eq("id", callerId)
          .maybeSingle();

      if (administratorError) {
        throw administratorError;
      }

      if (
        !administrator ||
        administrator.role !== "administrator" ||
        administrator.is_active !== true
      ) {
        return Response.json(
          {
            error:
              "Only an active School Administrator can create or assign a Subject Teacher."
          },
          { status: 403 }
        );
      }

      /*
       * ---------------------------------------------------------
       * 2. READ REQUEST
       * ---------------------------------------------------------
       */

      const body: SubjectTeacherPayload = await req.json();

      const schoolId = String(body.school_id || "").trim();

      const fullName = String(body.full_name || "").trim();

      const username = String(body.username || "").trim();

      const email = String(body.email || "")
        .trim()
        .toLowerCase();

      const phone = String(body.phone || "").trim();

      const password = String(body.password || "");

      const existingProfileId = String(
        body.existing_profile_id || ""
      ).trim();

      const classId = String(body.class_id || "").trim();

      const subjectId = String(body.subject_id || "").trim();

      const academicSessionId = String(
        body.academic_session_id || ""
      ).trim();

      /*
       * ---------------------------------------------------------
       * 3. BASIC VALIDATION
       * ---------------------------------------------------------
       */

      if (
        !schoolId ||
        !classId ||
        !subjectId ||
        !academicSessionId
      ) {
        return Response.json(
          {
            error:
              "School, class, subject and academic session are required."
          },
          { status: 400 }
        );
      }

      if (administrator.school_id !== schoolId) {
        return Response.json(
          {
            error:
              "You are not authorised to create or assign a Subject Teacher for this school."
          },
          { status: 403 }
        );
      }

      const assigningExistingStaff = Boolean(existingProfileId);

      /*
       * ---------------------------------------------------------
       * 4. VERIFY SCHOOL
       * ---------------------------------------------------------
       */

      const { data: school, error: schoolError } =
        await ctx.supabaseAdmin
          .from("schools")
          .select("id")
          .eq("id", schoolId)
          .maybeSingle();

      if (schoolError) {
        throw schoolError;
      }

      if (!school) {
        return Response.json(
          {
            error: "The selected school does not exist."
          },
          { status: 404 }
        );
      }

      /*
       * ---------------------------------------------------------
       * 5. VERIFY CLASS
       * ---------------------------------------------------------
       */

      const { data: classRecord, error: classError } =
        await ctx.supabaseAdmin
          .from("classes")
          .select("id, school_id, class_name")
          .eq("id", classId)
          .maybeSingle();

      if (classError) {
        throw classError;
      }

      if (!classRecord) {
        return Response.json(
          {
            error: "The selected class does not exist."
          },
          { status: 404 }
        );
      }

      if (classRecord.school_id !== schoolId) {
        return Response.json(
          {
            error:
              "The selected class does not belong to the selected school."
          },
          { status: 403 }
        );
      }

      /*
       * ---------------------------------------------------------
       * 6. VERIFY SUBJECT
       * ---------------------------------------------------------
       */

      const { data: subjectRecord, error: subjectError } =
        await ctx.supabaseAdmin
          .from("subjects")
          .select("id, school_id, name")
          .eq("id", subjectId)
          .maybeSingle();

      if (subjectError) {
        throw subjectError;
      }

      if (!subjectRecord) {
        return Response.json(
          {
            error: "The selected subject does not exist."
          },
          { status: 404 }
        );
      }

      if (subjectRecord.school_id !== schoolId) {
        return Response.json(
          {
            error:
              "The selected subject does not belong to the selected school."
          },
          { status: 403 }
        );
      }

      /*
       * ---------------------------------------------------------
       * 7. VERIFY ACADEMIC SESSION
       * ---------------------------------------------------------
       */

      const { data: session, error: sessionError } =
        await ctx.supabaseAdmin
          .from("academic_sessions")
          .select("id, school_id")
          .eq("id", academicSessionId)
          .maybeSingle();

      if (sessionError) {
        throw sessionError;
      }

      if (!session) {
        return Response.json(
          {
            error:
              "The selected academic session does not exist."
          },
          { status: 404 }
        );
      }

      if (session.school_id !== schoolId) {
        return Response.json(
          {
            error:
              "The selected academic session does not belong to the selected school."
          },
          { status: 403 }
        );
      }

      /*
       * =========================================================
       * EXISTING STAFF MEMBER
       * =========================================================
       */

      if (assigningExistingStaff) {
        /*
         * -------------------------------------------------------
         * 8A. FIND EXISTING PROFILE
         * -------------------------------------------------------
         */

        const { data: existingProfile, error: existingProfileError } =
          await ctx.supabaseAdmin
            .from("profiles")
            .select(
              "id, school_id, full_name, username, email, phone, role, is_active"
            )
            .eq("id", existingProfileId)
            .maybeSingle();

        if (existingProfileError) {
          throw existingProfileError;
        }

        if (!existingProfile) {
          return Response.json(
            {
              error:
                "The selected existing staff member could not be found."
            },
            { status: 404 }
          );
        }

        /*
         * -------------------------------------------------------
         * 8B. VERIFY SAME SCHOOL
         * -------------------------------------------------------
         */

        if (existingProfile.school_id !== schoolId) {
          return Response.json(
            {
              error:
                "The selected staff member does not belong to this school."
            },
            { status: 403 }
          );
        }

        /*
         * -------------------------------------------------------
         * 8C. VERIFY ACTIVE STAFF
         * -------------------------------------------------------
         */

        if (existingProfile.is_active !== true) {
          return Response.json(
            {
              error:
                "The selected staff member is currently inactive."
            },
            { status: 400 }
          );
        }

        /*
         * Students should not be converted into staff
         * responsibilities through this function.
         */

        if (existingProfile.role === "student") {
          return Response.json(
            {
              error:
                "A student account cannot be assigned as a Subject Teacher."
            },
            { status: 400 }
          );
        }

        /*
         * -------------------------------------------------------
         * 8D. CHECK EXISTING TEACHER ASSIGNMENT
         * -------------------------------------------------------
         */

        const { data: existingAssignment, error: existingAssignmentError } =
          await ctx.supabaseAdmin
            .from("teacher_assignments")
            .select("id")
            .eq("school_id", schoolId)
            .eq("teacher_id", existingProfile.id)
            .eq("class_id", classId)
            .eq("subject_id", subjectId)
            .eq("academic_session_id", academicSessionId)
            .maybeSingle();

        if (existingAssignmentError) {
          throw existingAssignmentError;
        }

        if (existingAssignment) {
          return Response.json(
            {
              error:
                "This staff member is already assigned to teach this subject in this class for the selected academic session.",
              assignment_id: existingAssignment.id
            },
            { status: 409 }
          );
        }

        /*
         * -------------------------------------------------------
         * 8E. ADD SUBJECT TEACHER RESPONSIBILITY
         * -------------------------------------------------------
         *
         * IMPORTANT:
         * We DO NOT change profiles.role.
         *
         * Example:
         *
         * profiles.role = form_master
         *
         * profile_roles:
         *   form_master
         *   subject_teacher
         *
         * Therefore the same account can perform both duties.
         */

        const { data: existingRole, error: existingRoleError } =
          await ctx.supabaseAdmin
            .from("profile_roles")
            .select("id, is_active")
            .eq("profile_id", existingProfile.id)
            .eq("role", "subject_teacher")
            .maybeSingle();

        if (existingRoleError) {
          throw existingRoleError;
        }

        if (existingRole) {
          if (!existingRole.is_active) {
            const { error: activateRoleError } =
              await ctx.supabaseAdmin
                .from("profile_roles")
                .update({
                  is_active: true
                })
                .eq("id", existingRole.id);

            if (activateRoleError) {
              throw activateRoleError;
            }
          }
        } else {
          const { error: roleInsertError } =
            await ctx.supabaseAdmin
              .from("profile_roles")
              .insert({
                profile_id: existingProfile.id,
                role: "subject_teacher",
                is_active: true
              });

          if (roleInsertError) {
            throw roleInsertError;
          }

          addedExistingRole = true;
        }

        /*
         * -------------------------------------------------------
         * 8F. CREATE TEACHER ASSIGNMENT
         * -------------------------------------------------------
         */

        const { data: assignment, error: assignmentError } =
          await ctx.supabaseAdmin
            .from("teacher_assignments")
            .insert({
              school_id: schoolId,
              teacher_id: existingProfile.id,
              class_id: classId,
              subject_id: subjectId,
              academic_session_id: academicSessionId
            })
            .select("id")
            .single();

        if (assignmentError) {
          /*
           * If the role was added just now and assignment failed,
           * remove the newly-added responsibility.
           */
          if (addedExistingRole) {
            await ctx.supabaseAdmin
              .from("profile_roles")
              .delete()
              .eq("profile_id", existingProfile.id)
              .eq("role", "subject_teacher");
          }

          if (assignmentError.code === "23505") {
            return Response.json(
              {
                error:
                  "This staff member is already assigned to this subject and class for the selected academic session."
              },
              { status: 409 }
            );
          }

          throw assignmentError;
        }

        createdAssignmentId = assignment.id;

        /*
         * -------------------------------------------------------
         * 8G. SUCCESS — EXISTING STAFF
         * -------------------------------------------------------
         */

        return Response.json(
          {
            success: true,
            mode: "existing_staff",
            message:
              "Existing staff member successfully assigned as Subject Teacher.",
            subject_teacher: {
              id: existingProfile.id,
              school_id: schoolId,
              full_name: existingProfile.full_name,
              username: existingProfile.username,
              email: existingProfile.email,
              primary_role: existingProfile.role,
              assigned_role: "subject_teacher",
              is_active: existingProfile.is_active,
              class_id: classId,
              subject_id: subjectId,
              subject_name: subjectRecord.name,
              academic_session_id: academicSessionId,
              assignment_id: createdAssignmentId
            }
          },
          { status: 200 }
        );
      }

      /*
       * =========================================================
       * NEW STAFF MEMBER
       * =========================================================
       */

      /*
       * ---------------------------------------------------------
       * 9. REQUIRED NEW STAFF DETAILS
       * ---------------------------------------------------------
       */

      if (!fullName || !username || !email || !password) {
        return Response.json(
          {
            error:
              "For a new Subject Teacher, full name, username, email and password are required."
          },
          { status: 400 }
        );
      }

      if (password.length < 8) {
        return Response.json(
          {
            error:
              "Subject Teacher password must contain at least 8 characters."
          },
          { status: 400 }
        );
      }

      /*
       * ---------------------------------------------------------
       * 10. CHECK USERNAME
       * ---------------------------------------------------------
       */

      const { data: existingUsername, error: usernameError } =
        await ctx.supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("school_id", schoolId)
          .eq("username", username)
          .maybeSingle();

      if (usernameError) {
        throw usernameError;
      }

      if (existingUsername) {
        return Response.json(
          {
            error:
              "That username is already in use for this school. If this is an existing staff member, select the existing staff option instead."
          },
          { status: 409 }
        );
      }

      /*
       * ---------------------------------------------------------
       * 11. CHECK EMAIL
       * ---------------------------------------------------------
       */

      const { data: existingEmail, error: emailCheckError } =
        await ctx.supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("email", email)
          .maybeSingle();

      if (emailCheckError) {
        throw emailCheckError;
      }

      if (existingEmail) {
        return Response.json(
          {
            error:
              "That email address is already registered. If this is an existing staff member, select the existing staff option instead."
          },
          { status: 409 }
        );
      }

      /*
       * ---------------------------------------------------------
       * 12. CREATE AUTH USER
       * ---------------------------------------------------------
       */

      const { data: authData, error: authError } =
        await ctx.supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            full_name: fullName,
            username,
            phone: phone || null,
            role: "subject_teacher",
            school_id: schoolId
          }
        });

      if (authError) {
        return Response.json(
          {
            error: authError.message
          },
          { status: 400 }
        );
      }

      if (!authData.user) {
        throw new Error(
          "Supabase did not return the newly created Subject Teacher user."
        );
      }

      createdUserId = authData.user.id;
      createdProfileId = createdUserId;

      /*
       * ---------------------------------------------------------
       * 13. CREATE PROFILE
       * ---------------------------------------------------------
       */

      const { error: profileError } =
        await ctx.supabaseAdmin
          .from("profiles")
          .insert({
            id: createdUserId,
            school_id: schoolId,
            full_name: fullName,
            username,
            phone: phone || null,
            email,
            role: "subject_teacher",
            is_active: true
          });

      if (profileError) {
        throw profileError;
      }

      /*
       * ---------------------------------------------------------
       * 14. CREATE PRIMARY SUBJECT TEACHER ROLE
       * ---------------------------------------------------------
       */

      const { error: roleError } =
        await ctx.supabaseAdmin
          .from("profile_roles")
          .insert({
            profile_id: createdUserId,
            role: "subject_teacher",
            is_active: true
          });

      if (roleError) {
        throw roleError;
      }

      /*
       * ---------------------------------------------------------
       * 15. CREATE TEACHER ASSIGNMENT
       * ---------------------------------------------------------
       */

      const { data: assignment, error: assignmentError } =
        await ctx.supabaseAdmin
          .from("teacher_assignments")
          .insert({
            school_id: schoolId,
            teacher_id: createdUserId,
            class_id: classId,
            subject_id: subjectId,
            academic_session_id: academicSessionId
          })
          .select("id")
          .single();

      if (assignmentError) {
        if (assignmentError.code === "23505") {
          return Response.json(
            {
              error:
                "This Subject Teacher assignment already exists."
            },
            { status: 409 }
          );
        }

        throw assignmentError;
      }

      createdAssignmentId = assignment.id;

      /*
       * ---------------------------------------------------------
       * 16. SUCCESS — NEW STAFF
       * ---------------------------------------------------------
       */

      return Response.json(
        {
          success: true,
          mode: "new_staff",
          message:
            "New Subject Teacher created and assigned successfully.",
          subject_teacher: {
            id: createdUserId,
            school_id: schoolId,
            full_name: fullName,
            username,
            email,
            primary_role: "subject_teacher",
            assigned_role: "subject_teacher",
            is_active: true,
            class_id: classId,
            subject_id: subjectId,
            subject_name: subjectRecord.name,
            academic_session_id: academicSessionId,
            assignment_id: createdAssignmentId
          }
        },
        { status: 201 }
      );
    } catch (error) {
      console.error(
        "create-subject-teacher error:",
        error
      );

      /*
       * ---------------------------------------------------------
       * CLEAN UP NEW STAFF IF SOMETHING FAILED
       * ---------------------------------------------------------
       */

      if (createdUserId) {
        try {
          if (createdAssignmentId) {
            await ctx.supabaseAdmin
              .from("teacher_assignments")
              .delete()
              .eq("id", createdAssignmentId);
          }

          await ctx.supabaseAdmin
            .from("profile_roles")
            .delete()
            .eq("profile_id", createdUserId);

          await ctx.supabaseAdmin
            .from("profiles")
            .delete()
            .eq("id", createdUserId);

          await ctx.supabaseAdmin.auth.admin.deleteUser(
            createdUserId
          );
        } catch (cleanupError) {
          console.error(
            "Failed to clean up newly created Subject Teacher:",
            cleanupError
          );
        }
      }

      return Response.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Unable to create or assign Subject Teacher."
        },
        { status: 500 }
      );
    }
  })
};