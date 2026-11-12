import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@^1";

type Payload = {
  action?: "list" | "set_stage";
  academic_session_id?: string;
  term_id?: string;
  class_id?: string;
  student_id?: string;
  release_stage?: number;
};

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") return Response.json({ error: "Only POST requests are allowed." }, { status: 405 });
    try {
      const actorId = ctx.userClaims?.id;
      if (!actorId) return Response.json({ error: "Authentication required." }, { status: 401 });
      const { data: actor, error: actorError } = await ctx.supabaseAdmin.from("profiles")
        .select("id,school_id,role,is_active").eq("id", actorId).maybeSingle();
      if (actorError) throw actorError;
      if (!actor || actor.role !== "administrator" || actor.is_active !== true || !actor.school_id)
        return Response.json({ error: "Only an active School Administrator can manage result release." }, { status: 403 });
      const body: Payload = await req.json();

      if (body.action === "list") {
        let enrolmentsQuery = ctx.supabaseAdmin.from("student_enrolments")
          .select("student_id,class_id,academic_session_id,students!inner(admission_number,first_name,middle_name,last_name),classes!inner(class_name)")
          .eq("school_id", actor.school_id).is("archived_at", null);
        if (body.academic_session_id) enrolmentsQuery = enrolmentsQuery.eq("academic_session_id", body.academic_session_id);
        if (body.class_id) enrolmentsQuery = enrolmentsQuery.eq("class_id", body.class_id);
        const { data: enrolments, error: enrolmentError } = await enrolmentsQuery;
        if (enrolmentError) throw enrolmentError;
        const studentIds = [...new Set((enrolments || []).map((x: { student_id: string }) => x.student_id))];
        let stages: Record<string, unknown>[] = [];
        // Keep PostgREST URLs safely bounded for schools with large enrolments.
        // A single .in() containing thousands of UUIDs can exceed gateway URL limits.
        const idBatches: string[][] = [];
        for (let i = 0; i < studentIds.length; i += 100) idBatches.push(studentIds.slice(i, i + 100));
        if (idBatches.length) {
          const stageBatches = await Promise.all(idBatches.map(async (batch) => {
            let stageQuery = ctx.supabaseAdmin.from("student_result_release_stages")
              .select("student_id,academic_session_id,term_id,release_stage,updated_at")
              .eq("school_id", actor.school_id).in("student_id", batch);
            if (body.academic_session_id) stageQuery = stageQuery.eq("academic_session_id", body.academic_session_id);
            if (body.term_id) stageQuery = stageQuery.eq("term_id", body.term_id);
            const { data, error } = await stageQuery;
            if (error) throw error;
            return (data || []) as Record<string, unknown>[];
          }));
          stages = stageBatches.flat();
        }
        const stageMap = new Map(stages.map((x: Record<string, unknown>) =>
          [String(x.student_id) + ":" + String(x.academic_session_id) + ":" + String(x.term_id), x]));
        let eligibleCounts = new Map<string, number>();
        let publishedCounts = new Map<string, number>();
        if (studentIds.length && body.term_id) {
          const resultBatches = await Promise.all(idBatches.map(async (batch) => {
            const { data, error } = await ctx.supabaseAdmin.from("results")
              .select("student_id,status").eq("school_id", actor.school_id)
              .eq("academic_session_id", body.academic_session_id).eq("term_id", body.term_id)
              .in("status", ["approved","published"]).in("student_id", batch);
            if (error) throw error;
            return data || [];
          }));
          resultBatches.flat().forEach((row: { student_id: string; status: string }) => {
            eligibleCounts.set(row.student_id, (eligibleCounts.get(row.student_id) || 0) + 1);
            if (row.status === "published") publishedCounts.set(row.student_id, (publishedCounts.get(row.student_id) || 0) + 1);
          });
        }
        const output = (enrolments || []).map((e: Record<string, any>) => {
          const student = Array.isArray(e.students) ? e.students[0] : e.students;
          const cls = Array.isArray(e.classes) ? e.classes[0] : e.classes;
          return {
            student_id: e.student_id,
            class_id: e.class_id,
            class_name: cls?.class_name || "",
            academic_session_id: e.academic_session_id,
            admission_number: student?.admission_number || "",
            full_name: [student?.first_name, student?.middle_name, student?.last_name].filter(Boolean).join(" "),
            eligible_result_count: eligibleCounts.get(e.student_id) || 0,
            published_result_count: publishedCounts.get(e.student_id) || 0,
            stages: stages.filter((s) => s.student_id === e.student_id && s.academic_session_id === e.academic_session_id &&
              (!body.term_id || s.term_id === body.term_id))
          };
        });
        return Response.json({ success: true, students: output });
      }

      if (body.action === "set_stage") {
        const studentId = String(body.student_id || "");
        const sessionId = String(body.academic_session_id || "");
        const termId = String(body.term_id || "");
        const nextStage = Number(body.release_stage);
        if (!studentId || !sessionId || !termId || !Number.isInteger(nextStage) || nextStage < 0 || nextStage > 4)
          return Response.json({ error: "A student, session, term and release stage from 0 to 4 are required." }, { status: 400 });
        const { data: student, error: studentError } = await ctx.supabaseAdmin.from("students")
          .select("id").eq("id", studentId).eq("school_id", actor.school_id).maybeSingle();
        if (studentError) throw studentError;
        if (!student) return Response.json({ error: "Student not found in this school." }, { status: 404 });
        const { data: enrolment, error: enrolmentError } = await ctx.supabaseAdmin.from("student_enrolments")
          .select("id").eq("school_id", actor.school_id).eq("student_id", studentId)
          .eq("academic_session_id", sessionId).is("archived_at", null).maybeSingle();
        if (enrolmentError) throw enrolmentError;
        if (!enrolment) return Response.json({ error: "Student is not actively enrolled in this session." }, { status: 409 });
        const { data: term, error: termError } = await ctx.supabaseAdmin.from("terms")
          .select("id").eq("id", termId).eq("school_id", actor.school_id).maybeSingle();
        if (termError) throw termError;
        if (!term) return Response.json({ error: "Term does not belong to this school." }, { status: 400 });
        const { data: existing, error: existingError } = await ctx.supabaseAdmin.from("student_result_release_stages")
          .select("id,release_stage").eq("school_id", actor.school_id).eq("student_id", studentId)
          .eq("academic_session_id", sessionId).eq("term_id", termId).maybeSingle();
        if (existingError) throw existingError;
        const oldStage = existing?.release_stage || 0;
        if (nextStage !== 0 && nextStage !== oldStage + 1)
          return Response.json({ error: "Stages must be released in order, one at a time. You may also revoke all stages to 0." }, { status: 409 });
        if (nextStage > 0) {
          const { count, error: resultError } = await ctx.supabaseAdmin.from("results").select("id", { count: "exact", head: true })
            .eq("school_id", actor.school_id).eq("student_id", studentId)
            .eq("academic_session_id", sessionId).eq("term_id", termId)
            .in("status", nextStage === 4 ? ["published"] : ["approved","published"]);
          if (resultError) throw resultError;
          if (!count) return Response.json({ error: "No published subject results are available for this student, session and term." }, { status: 409 });
        }
        const { data: saved, error: saveError } = await ctx.supabaseAdmin.from("student_result_release_stages")
          .upsert({
            school_id: actor.school_id, student_id: studentId, academic_session_id: sessionId,
            term_id: termId, release_stage: nextStage, updated_by: actorId, updated_at: new Date().toISOString()
          }, { onConflict: "school_id,student_id,academic_session_id,term_id" })
          .select("release_stage,updated_at").single();
        if (saveError) throw saveError;
        return Response.json({ success: true, previous_stage: oldStage, ...saved });
      }
      return Response.json({ error: "Unsupported action." }, { status: 400 });
    } catch (error) {
      console.error("manage-student-result-release:", error);
      return Response.json({ error: error instanceof Error ? error.message : "Unable to manage result release." }, { status: 500 });
    }
  })
};
