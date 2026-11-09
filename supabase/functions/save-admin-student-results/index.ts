import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@^1";
type Payload = {
  student_id?: string; class_id?: string; academic_session_id?: string; term_id?: string;
  scores?: { subject_name?: string; ca1?: number; ca2?: number; ca3?: number; examination?: number }[];
  form_assessment?: Record<string, unknown>;
};
export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") return Response.json({ error: "Only POST requests are allowed." }, { status: 405 });
    try {
      const actorId = ctx.userClaims?.id;
      if (!actorId) return Response.json({ error: "Authentication required." }, { status: 401 });
      const body: Payload = await req.json();
      if (!body.student_id || !body.class_id || !body.academic_session_id || !body.term_id || !Array.isArray(body.scores))
        return Response.json({ error: "Official student, class, session, term and subject scores are required." }, { status: 400 });
      const { data, error } = await ctx.supabaseAdmin.rpc("save_admin_student_result_batch", {
        p_actor_id: actorId, p_student_id: body.student_id, p_class_id: body.class_id,
        p_academic_session_id: body.academic_session_id, p_term_id: body.term_id,
        p_scores: body.scores, p_form_assessment: body.form_assessment || null
      });
      if (error) throw error;
      return Response.json(data);
    } catch (error) {
      console.error("save-admin-student-results error:", error);
      return Response.json({ error: error instanceof Error ? error.message : "Unable to save student results." }, { status: 400 });
    }
  })
};
