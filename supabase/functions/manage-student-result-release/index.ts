import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@^1";

type Payload = {
  action?: "list" | "set_stage";
  academic_session_id?: string;
  term_id?: string;
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
        return Response.json({ error: "Only an active School Administrator can manage result release stages." }, { status: 403 });

      const body: Payload = await req.json();
      const sessionId = String(body.academic_session_id || "");
      const termId = String(body.term_id || "");
      if (!sessionId || !termId) return Response.json({ error: "Academic session and term are required." }, { status: 400 });

      const [{ data: session, error: sessionError }, { data: term, error: termError }] = await Promise.all([
        ctx.supabaseAdmin.from("academic_sessions").select("id").eq("id", sessionId).eq("school_id", actor.school_id).maybeSingle(),
        ctx.supabaseAdmin.from("terms").select("id").eq("id", termId).eq("school_id", actor.school_id).maybeSingle()
      ]);
      if (sessionError) throw sessionError;
      if (termError) throw termError;
      if (!session || !term) return Response.json({ error: "The selected session or term does not belong to this school." }, { status: 404 });

      if (body.action === "list") {
        const { data: enrolments, error: enrolError } = await ctx.supabaseAdmin.from("student_enrolments")
          .select("student_id,class_id,students!inner(admission_number,first_name,middle_name,last_name),classes!inner(class_name)")
          .eq("school_id", actor.school_id).eq("academic_session_id", sessionId).is("archived_at", null);
        if (enrolError) throw enrolError;
        const studentIds = [...new Set((enrolments || []).map((x: any) => x.student_id))];
        const [{ data: stages, error: stageError }, { data: resultRows, error: resultError }] = studentIds.length ? await Promise.all([
          ctx.supabaseAdmin.from("student_result_release_stages").select("student_id,release_stage")
            .eq("school_id", actor.school_id).eq("academic_session_id", sessionId).eq("term_id", termId).in("student_id", studentIds),
          ctx.supabaseAdmin.from("results").select("student_id,status")
            .eq("school_id", actor.school_id).eq("academic_session_id", sessionId).eq("term_id", termId)
            .in("student_id", studentIds).in("status", ["approved","published"])
        ]) : [{ data: [], error: null }, { data: [], error: null }];
        if (stageError) throw stageError;
        if (resultError) throw resultError;
        const stageMap = new Map<string, number>((stages || []).map((x: any) => [x.student_id, x.release_stage]));
        const eligibleMap = new Map<string, number>();
        (resultRows || []).forEach((x: any) => eligibleMap.set(x.student_id, (eligibleMap.get(x.student_id) || 0) + 1));
        return Response.json({ success: true, students: (enrolments || []).map((x: any) => ({
          student_id: x.student_id, admission_number: x.students?.admission_number,
          full_name: [x.students?.first_name,x.students?.middle_name,x.students?.last_name].filter(Boolean).join(" "),
          class_id: x.class_id, class_name: x.classes?.class_name,
          release_stage: stageMap.get(x.student_id) || 0, eligible_result_rows: eligibleMap.get(x.student_id) || 0
        })) });
      }

      if (body.action === "set_stage") {
        const studentId = String(body.student_id || "");
        const nextStage = Number(body.release_stage);
        if (!studentId || !Number.isInteger(nextStage) || nextStage < 0 || nextStage > 4)
          return Response.json({ error: "A valid student and release stage from 0 to 4 are required." }, { status: 400 });
        const { data: enrolment, error: enrolError } = await ctx.supabaseAdmin.from("student_enrolments")
          .select("student_id").eq("school_id", actor.school_id).eq("student_id", studentId)
          .eq("academic_session_id", sessionId).is("archived_at", null).maybeSingle();
        if (enrolError) throw enrolError;
        if (!enrolment) return Response.json({ error: "The student is not actively enrolled in this session." }, { status: 404 });
        const { data: current, error: currentError } = await ctx.supabaseAdmin.from("student_result_release_stages")
          .select("release_stage").eq("school_id", actor.school_id).eq("student_id", studentId)
          .eq("academic_session_id", sessionId).eq("term_id", termId).maybeSingle();
        if (currentError) throw currentError;
        const currentStage = current?.release_stage ?? 0;
        if (nextStage > currentStage + 1)
          return Response.json({ error: "Stages must be released one at a time." }, { status: 409 });
        if (nextStage === currentStage) return Response.json({ success: true, release_stage: currentStage, unchanged: true });
        if (nextStage > 0) {
          const requiredStatuses = nextStage === 4 ? ["published"] : ["approved","published"];
          const { count, error: countError } = await ctx.supabaseAdmin.from("results").select("id", { count: "exact", head: true })
            .eq("school_id", actor.school_id).eq("student_id", studentId).eq("academic_session_id", sessionId)
            .eq("term_id", termId).in("status", requiredStatuses);
          if (countError) throw countError;
          if (!count || count < 1)
            return Response.json({ error: nextStage === 4 ? "Final release requires at least one published subject result." : "Release requires at least one administrator-approved subject result." }, { status: 409 });
        }
        const payload = { school_id: actor.school_id, student_id: studentId, academic_session_id: sessionId,
          term_id: termId, release_stage: nextStage, updated_by: actorId, created_by: actorId };
        const { error: saveError } = await ctx.supabaseAdmin.from("student_result_release_stages")
          .upsert(payload, { onConflict: "school_id,student_id,academic_session_id,term_id" });
        if (saveError) throw saveError;
        return Response.json({ success: true, previous_stage: currentStage, release_stage: nextStage });
      }
      return Response.json({ error: "Unsupported action." }, { status: 400 });
    } catch (error) {
      console.error("manage-student-result-release error:", error);
      return Response.json({ error: error instanceof Error ? error.message : "Unable to manage result release." }, { status: 500 });
    }
  })
};
