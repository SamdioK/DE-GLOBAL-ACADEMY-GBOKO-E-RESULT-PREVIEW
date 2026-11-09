import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@^1";

export default {
  fetch: withSupabase({ auth: "user" }, async (_req, ctx) => {
    try {
      const userId = ctx.userClaims?.id;
      if (!userId) return Response.json({ error: "Authentication required." }, { status: 401 });
      const { data: profile, error: profileError } = await ctx.supabaseAdmin.from("profiles")
        .select("id,school_id,role,is_active").eq("id", userId).maybeSingle();
      if (profileError) throw profileError;
      if (!profile || profile.role !== "student" || profile.is_active !== true || !profile.school_id)
        return Response.json({ error: "An active student account is required." }, { status: 403 });

      const { data: student, error: studentError } = await ctx.supabaseAdmin.from("students")
        .select("id,school_id,admission_number,first_name,middle_name,last_name")
        .eq("profile_id", userId).eq("school_id", profile.school_id).maybeSingle();
      if (studentError) throw studentError;
      if (!student) return Response.json({ error: "No student record is linked to this account." }, { status: 404 });

      const { data: stages, error: stageError } = await ctx.supabaseAdmin.from("student_result_release_stages")
        .select("academic_session_id,term_id,release_stage,updated_at")
        .eq("school_id", profile.school_id).eq("student_id", student.id).gt("release_stage", 0);
      if (stageError) throw stageError;
      if (!stages?.length) return Response.json({ success: true, student, results: [] });

      const sessionIds = [...new Set(stages.map((x: { academic_session_id: string }) => x.academic_session_id))];
      const termIds = [...new Set(stages.map((x: { term_id: string }) => x.term_id))];
      const { data: rows, error: resultError } = await ctx.supabaseAdmin.from("results")
        .select("id,school_id,student_id,class_id,subject_id,academic_session_id,term_id,ca1,ca2,ca3,examination,total,grade,remark,status")
        .eq("school_id", profile.school_id).eq("student_id", student.id).eq("status", "published")
        .in("academic_session_id", sessionIds).in("term_id", termIds);
      if (resultError) throw resultError;

      const classIds = [...new Set((rows || []).map((x: { class_id: string }) => x.class_id))];
      const subjectIds = [...new Set((rows || []).map((x: { subject_id: string }) => x.subject_id))];
      const { data: classes, error: classError } = classIds.length
        ? await ctx.supabaseAdmin.from("classes").select("id,class_name").in("id", classIds)
        : { data: [], error: null };
      if (classError) throw classError;
      const { data: subjects, error: subjectError } = subjectIds.length
        ? await ctx.supabaseAdmin.from("subjects").select("id,name").in("id", subjectIds)
        : { data: [], error: null };
      if (subjectError) throw subjectError;
      const { data: sessions, error: sessionError } = await ctx.supabaseAdmin.from("academic_sessions")
        .select("id,name").in("id", sessionIds);
      if (sessionError) throw sessionError;
      const { data: terms, error: termError } = await ctx.supabaseAdmin.from("terms")
        .select("id,name,term_number").in("id", termIds);
      if (termError) throw termError;

      const classMap = new Map((classes || []).map((x: { id: string; class_name: string }) => [x.id, x.class_name]));
      const subjectMap = new Map((subjects || []).map((x: { id: string; name: string }) => [x.id, x.name]));
      const sessionMap = new Map((sessions || []).map((x: { id: string; name: string }) => [x.id, x.name]));
      const termMap = new Map((terms || []).map((x: { id: string; name: string; term_number: number }) => [x.id, x]));
      const stageMap = new Map(stages.map((x: { academic_session_id: string; term_id: string; release_stage: number }) =>
        [x.academic_session_id + ":" + x.term_id, x.release_stage]));
      const grouped = new Map<string, Record<string, unknown>>();
      for (const row of rows || []) {
        const stage = stageMap.get(row.academic_session_id + ":" + row.term_id) || 0;
        if (stage < 1) continue;
        const key = row.academic_session_id + ":" + row.term_id;
        if (!grouped.has(key)) {
          const term = termMap.get(row.term_id);
          grouped.set(key, {
            academic_session_id: row.academic_session_id,
            session: sessionMap.get(row.academic_session_id) || "",
            term_id: row.term_id,
            term: term?.name || (term?.term_number ? "Term " + term.term_number : ""),
            release_stage: stage,
            class_name: classMap.get(row.class_id) || "",
            subjects: []
          });
        }
        const item: Record<string, unknown> = {
          subject: subjectMap.get(row.subject_id) || "Subject",
          ca1: row.ca1
        };
        if (stage >= 2) item.ca2 = row.ca2;
        if (stage >= 3) item.ca3 = row.ca3;
        if (stage >= 4) {
          item.examination = row.examination;
          item.total = row.total;
          item.grade = row.grade;
          item.remark = row.remark;
        }
        (grouped.get(key)!.subjects as Record<string, unknown>[]).push(item);
      }
      return Response.json({
        success: true,
        student: {
          admission_number: student.admission_number,
          full_name: [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(" ")
        },
        results: [...grouped.values()]
      });
    } catch (error) {
      console.error("student-results-portal:", error);
      return Response.json({ error: error instanceof Error ? error.message : "Unable to load student results." }, { status: 500 });
    }
  })
};
