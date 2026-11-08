import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@^1";

type Payload = {
  action?: "set_active" | "remove_assignment";
  assignment_id?: string;
  is_active?: boolean;
};

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") {
      return Response.json({ error: "Only POST requests are allowed." }, { status: 405 });
    }

    try {
      const callerId = ctx.userClaims?.id;
      if (!callerId) {
        return Response.json({ error: "Authenticated user could not be identified." }, { status: 401 });
      }

      const { data: administrator, error: administratorError } = await ctx.supabaseAdmin
        .from("profiles")
        .select("id,school_id,role,is_active")
        .eq("id", callerId)
        .maybeSingle();

      if (administratorError) throw administratorError;
      if (!administrator || administrator.role !== "administrator" || administrator.is_active !== true || !administrator.school_id) {
        return Response.json({ error: "Only an active School Administrator can manage Subject Teacher assignments." }, { status: 403 });
      }

      const body: Payload = await req.json();
      const action = body.action;
      const assignmentId = String(body.assignment_id || "").trim();
      if (!assignmentId) {
        return Response.json({ error: "A valid assignment identifier is required." }, { status: 400 });
      }
      if (action !== "set_active" && action !== "remove_assignment") {
        return Response.json({ error: "Unsupported Subject Teacher assignment action." }, { status: 400 });
      }

      const { data: assignment, error: assignmentError } = await ctx.supabaseAdmin
        .from("teacher_assignments")
        .select("id,school_id,teacher_id,class_id,subject_id,academic_session_id,is_active")
        .eq("id", assignmentId)
        .eq("school_id", administrator.school_id)
        .maybeSingle();

      if (assignmentError) throw assignmentError;
      if (!assignment) {
        return Response.json({ error: "The assignment was not found in your school." }, { status: 404 });
      }

      if (action === "set_active") {
        if (typeof body.is_active !== "boolean") {
          return Response.json({ error: "The requested activation status must be true or false." }, { status: 400 });
        }

        const { data: updated, error: updateError } = await ctx.supabaseAdmin
          .from("teacher_assignments")
          .update({ is_active: body.is_active })
          .eq("id", assignment.id)
          .eq("school_id", administrator.school_id)
          .select("id,is_active")
          .single();

        if (updateError) throw updateError;
        return Response.json({ success: true, action, assignment: updated }, { status: 200 });
      }

      const { data: deleted, error: deleteError } = await ctx.supabaseAdmin
        .from("teacher_assignments")
        .delete()
        .eq("id", assignment.id)
        .eq("school_id", administrator.school_id)
        .select("id")
        .maybeSingle();

      if (deleteError) throw deleteError;
      if (!deleted) {
        return Response.json({ error: "The assignment could not be confirmed as removed." }, { status: 409 });
      }

      // Deliberately retain the staff profile and role. A teacher may hold
      // other assignments or responsibilities, and removing one slot must
      // never delete or disable the account.
      return Response.json({ success: true, action, assignment_id: deleted.id }, { status: 200 });
    } catch (error) {
      console.error("manage-subject-teacher error:", error);
      return Response.json({ error: error instanceof Error ? error.message : "Unable to manage Subject Teacher assignment." }, { status: 500 });
    }
  })
};
