import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@^1";

type Payload = {
  action?: "list" | "submit" | "review";
  class_id?: string | null;
  subject_id?: string;
  academic_session_id?: string;
  term_id?: string;
  assessment_stage?: number;
  submission_id?: string;
  decision?: "approve" | "return";
  comment?: string | null;
};

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") return Response.json({ error: "Only POST requests are allowed." }, { status: 405 });
    try {
      const actorId = ctx.userClaims?.id;
      if (!actorId) return Response.json({ error: "Authentication required." }, { status: 401 });
      const body: Payload = await req.json();
      let data: unknown;
      let error: { message: string } | null = null;

      if (body.action === "list") {
        const result = await ctx.supabase.rpc("list_result_assessment_submissions", {
          p_class_id: body.class_id || null,
          p_academic_session_id: body.academic_session_id || null,
          p_term_id: body.term_id || null,
          p_stage: body.assessment_stage == null ? null : body.assessment_stage
        });
        data = result.data; error = result.error;
      } else if (body.action === "submit") {
        if (!body.class_id || !body.subject_id || !body.academic_session_id || !body.term_id ||
            !Number.isInteger(body.assessment_stage) || Number(body.assessment_stage) < 1 || Number(body.assessment_stage) > 4) {
          return Response.json({ error: "Class arm, subject, session, term and assessment stage (1–4) are required." }, { status: 400 });
        }
        const result = await ctx.supabase.rpc("submit_result_assessment_stage", {
          p_class_id: body.class_id,
          p_subject_id: body.subject_id,
          p_academic_session_id: body.academic_session_id,
          p_term_id: body.term_id,
          p_assessment_stage: body.assessment_stage
        });
        data = result.data; error = result.error;
      } else if (body.action === "review") {
        if (!body.submission_id || !["approve", "return"].includes(String(body.decision))) {
          return Response.json({ error: "Submission and review decision are required." }, { status: 400 });
        }
        const result = await ctx.supabase.rpc("review_result_assessment_submission", {
          p_submission_id: body.submission_id,
          p_decision: body.decision,
          p_comment: body.comment || null
        });
        data = result.data; error = result.error;
      } else {
        return Response.json({ error: "Unsupported action. Use list, submit or review." }, { status: 400 });
      }

      if (error) throw new Error(error.message);
      return Response.json({ success: true, data });
    } catch (error) {
      console.error("manage-result-assessment-submissions:", error);
      return Response.json({ error: error instanceof Error ? error.message : "Unable to process assessment submission." }, { status: 400 });
    }
  })
};
