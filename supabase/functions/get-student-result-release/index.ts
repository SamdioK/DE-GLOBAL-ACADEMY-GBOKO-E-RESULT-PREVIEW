import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@^1";

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") return Response.json({ error: "Only POST requests are allowed." }, { status: 405 });
    try {
      const studentProfileId = ctx.userClaims?.id;
      if (!studentProfileId) return Response.json({ error: "Authentication required." }, { status: 401 });
      const { data: profile, error: profileError } = await ctx.supabaseAdmin.from("profiles")
        .select("id,school_id,role,is_active").eq("id", studentProfileId).maybeSingle();
      if (profileError) throw profileError;
      if (!profile || profile.role !== "student" || profile.is_active !== true || !profile.school_id)
        return Response.json({ error: "An active Student account is required." }, { status: 403 });
      const { data: student, error: studentError } = await ctx.supabaseAdmin.from("students")
        .select("id,admission_number,first_name,middle_name,last_name,school_id")
        .eq("profile_id", studentProfileId).eq("school_id", profile.school_id).maybeSingle();
      if (studentError) throw studentError;
      if (!student) return Response.json({ error: "No official student record is linked to this account." }, { status: 404 });

      const body = await req.json().catch(() => ({}));
      const sessionId = String(body.academic_session_id || "");
      const termId = String(body.term_id || "");
      let stageQuery = ctx.supabaseAdmin.from("student_result_release_stages")
        .select("release_stage").eq("school_id", profile.school_id).eq("student_id", student.id);
      if (sessionId) stageQuery = stageQuery.eq("academic_session_id", sessionId);
      if (termId) stageQuery = stageQuery.eq("term_id", termId);
      const { data: stages, error: stageError } = await stageQuery;
      if (stageError) throw stageError;
      const allowedStages = new Map<string, number>();
      (stages || []).forEach((x: any) => allowedStages.set(x.academic_session_id + ":" + x.term_id, x.release_stage));

      let resultQuery = ctx.supabaseAdmin.from("results")
        .select("id,academic_session_id,term_id,subject_id,ca1,ca2,ca3,examination,total,grade,remark,status,subjects(name),academic_sessions(name),terms(name)")
        .eq("school_id", profile.school_id).eq("student_id", student.id)
        .in("status", ["approved","published"]);
      if (sessionId) resultQuery = resultQuery.eq("academic_session_id", sessionId);
      if (termId) resultQuery = resultQuery.eq("term_id", termId);
      const { data: resultRows, error: resultError } = await resultQuery;
      if (resultError) throw resultError;

      const rows = (resultRows || []).flatMap((r: any) => {
        const key = r.academic_session_id + ":" + r.term_id;
        const stage = allowedStages.get(key) || 0;
        if (stage < 1) return [];
        if (stage === 4 && r.status !== "published") return [];
        const row: Record<string, unknown> = {
          subject: r.subjects?.name || "Subject",
          session: r.academic_sessions?.name || "",
          term: r.terms?.name || "",
          academic_session_id: r.academic_session_id,
          term_id: r.term_id,
          ca1: r.ca1
        };
        if (stage >= 2) row.ca2 = r.ca2;
        if (stage >= 3) row.ca3 = r.ca3;
        if (stage >= 4) {
          row.examination = r.examination;
          row.total = r.total;
          row.grade = r.grade;
          row.remark = r.remark;
        }
        return [{ stage, row }];
      });
      return Response.json({
        success: true,
        student: { admission_number: student.admission_number, full_name: [student.first_name,student.middle_name,student.last_name].filter(Boolean).join(" ") },
        results: rows
      });
    } catch (error) {
      console.error("get-student-result-release error:", error);
      return Response.json({ error: error instanceof Error ? error.message : "Unable to retrieve released results." }, { status: 500 });
    }
  })
};
