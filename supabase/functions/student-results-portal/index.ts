import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@^1";

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    try {
      const userId = ctx.userClaims?.id;
      if (!userId) return Response.json({ error: "Authentication required." }, { status: 401 });
      const { data: profile, error: profileError } = await ctx.supabaseAdmin.from("profiles")
        .select("id,school_id,role,is_active").eq("id", userId).maybeSingle();
      if (profileError) throw profileError;
      if (!profile || profile.role !== "student" || profile.is_active !== true || !profile.school_id)
        return Response.json({ error: "An active student account is required." }, { status: 403 });

      const { data: student, error: studentError } = await ctx.supabaseAdmin.from("students")
        .select("id,school_id,admission_number,first_name,middle_name,last_name,status")
        .eq("profile_id", userId).eq("school_id", profile.school_id).maybeSingle();
      if (studentError) throw studentError;
      if (!student || student.status !== "active")
        return Response.json({ error: "No active student record is linked to this account." }, { status: 404 });

      const body = await req.json().catch(() => ({}));
      const mode = body?.mode === "check" ? "check" : "list";
      const { data: stages, error: stageError } = await ctx.supabaseAdmin.from("student_result_release_stages")
        .select("academic_session_id,term_id,release_stage,updated_at")
        .eq("school_id", profile.school_id).eq("student_id", student.id).gt("release_stage", 0);
      if (stageError) throw stageError;
      const studentSummary = {
        admission_number: student.admission_number,
        full_name: [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(" ")
      };
      if (!stages?.length) return Response.json({ success: true, student: studentSummary, available: [], results: [] });

      const sessionIds = [...new Set(stages.map((x: { academic_session_id: string }) => x.academic_session_id))];
      const termIds = [...new Set(stages.map((x: { term_id: string }) => x.term_id))];
      const [sessionsResult, termsResult, balancesResult] = await Promise.all([
        ctx.supabaseAdmin.from("academic_sessions").select("id,name").in("id", sessionIds),
        ctx.supabaseAdmin.from("terms").select("id,name,term_number").in("id", termIds),
        ctx.supabaseAdmin.from("student_result_token_balances")
          .select("academic_session_id,term_id,remaining_uses")
          .eq("school_id", profile.school_id).eq("student_id", student.id)
          .in("academic_session_id", sessionIds).in("term_id", termIds)
      ]);
      if (sessionsResult.error) throw sessionsResult.error;
      if (termsResult.error) throw termsResult.error;
      if (balancesResult.error) throw balancesResult.error;
      const sessionMap = new Map((sessionsResult.data || []).map((x: {id:string;name:string}) => [x.id,x.name]));
      const termMap = new Map((termsResult.data || []).map((x: {id:string;name:string;term_number:number}) => [x.id,x]));
      const balanceMap = new Map((balancesResult.data || []).map((x: {academic_session_id:string;term_id:string;remaining_uses:number}) => [x.academic_session_id + ":" + x.term_id, Number(x.remaining_uses || 0)]));
      const available = stages.map((stage: {academic_session_id:string;term_id:string;release_stage:number;updated_at:string}) => {
        const term = termMap.get(stage.term_id);
        const key = stage.academic_session_id + ":" + stage.term_id;
        return {
          academic_session_id: stage.academic_session_id,
          session: sessionMap.get(stage.academic_session_id) || "",
          term_id: stage.term_id,
          term: term?.name || (term?.term_number ? "Term " + term.term_number : ""),
          release_stage: stage.release_stage,
          remaining_uses: balanceMap.get(key) || 0,
          token_price_kobo: 65199,
          token_uses: 5,
          token_expires: false
        };
      }).sort((a,b) => String(b.session).localeCompare(String(a.session)) || String(a.term).localeCompare(String(b.term)));

      if (mode === "list") return Response.json({ success: true, student: studentSummary, available, results: [] });

      const sessionId = typeof body?.academic_session_id === "string" ? body.academic_session_id : "";
      const termId = typeof body?.term_id === "string" ? body.term_id : "";
      const requestKey = typeof body?.request_key === "string" ? body.request_key : "";
      if (!sessionId || !termId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestKey))
        return Response.json({ error: "Select a result session and term and retry the check." }, { status: 400 });

      const stage = stages.find((x: {academic_session_id:string;term_id:string}) =>
        x.academic_session_id === sessionId && x.term_id === termId);
      if (!stage) return Response.json({ error: "This result has not been released for online checking." }, { status: 409 });

      const { data: rows, error: resultError } = await ctx.supabaseAdmin.from("results")
        .select("id,school_id,student_id,class_id,subject_id,academic_session_id,term_id,ca1,ca2,ca3,examination,total,grade,remark,status")
        .eq("school_id", profile.school_id).eq("student_id", student.id)
        .eq("academic_session_id", sessionId).eq("term_id", termId)
        .in("status", ["approved","published"]);
      if (resultError) throw resultError;
      const stageNumber = Math.max(0, Math.min(4, Number(stage.release_stage || 0)));
      const visibleRows = (rows || []).filter((row: {status:string}) => stageNumber !== 4 || row.status === "published");
      if (!visibleRows.length) return Response.json({ success: false, error: "No approved result records are available for this session and term yet." }, { status: 404 });



      const classIds = [...new Set(visibleRows.map((x: {class_id:string}) => x.class_id))];
      const subjectIds = [...new Set(visibleRows.map((x: {subject_id:string}) => x.subject_id))];
      const [classesResult, subjectsResult] = await Promise.all([
        classIds.length ? ctx.supabaseAdmin.from("classes").select("id,class_name").in("id", classIds) : Promise.resolve({data:[],error:null}),
        subjectIds.length ? ctx.supabaseAdmin.from("subjects").select("id,name").in("id", subjectIds) : Promise.resolve({data:[],error:null})
      ]);
      if (classesResult.error) throw classesResult.error;
      if (subjectsResult.error) throw subjectsResult.error;

      const { data: debit, error: debitError } = await ctx.supabaseAdmin.rpc("consume_student_result_token", {
        p_school_id: profile.school_id, p_student_id: student.id,
        p_academic_session_id: sessionId, p_term_id: termId, p_request_key: requestKey
      });
      if (debitError) throw debitError;
      const debitRow = Array.isArray(debit) ? debit[0] : debit;
      if (!debitRow?.consumed) {
        return Response.json({
          success: false, payment_required: true, remaining_uses: 0,
          token_price_kobo: 65199, token_uses: 5,
          academic_session_id: sessionId, term_id: termId,
          error: "No result checks remain for this academic session and term. Purchase its five-use token to continue."
        }, { status: 200 });
      }      const classMap = new Map((classesResult.data || []).map((x: {id:string;class_name:string}) => [x.id,x.class_name]));
      const subjectMap = new Map((subjectsResult.data || []).map((x: {id:string;name:string}) => [x.id,x.name]));
      const term = termMap.get(termId);
      const group = {
        academic_session_id: sessionId,
        session: sessionMap.get(sessionId) || "",
        term_id: termId,
        term: term?.name || (term?.term_number ? "Term " + term.term_number : ""),
        class_name: classMap.get(visibleRows[0].class_id) || "",
        release_stage: stageNumber,
        remaining_uses: Number(debitRow.remaining_uses || 0),
        token_expires: false,
        subjects: visibleRows.map((row: Record<string, unknown>) => {
          const item: Record<string, unknown> = {
            subject: subjectMap.get(String(row.subject_id)) || "Subject",
            ca1: row.ca1
          };
          if (stageNumber >= 2) item.ca2 = row.ca2;
          if (stageNumber >= 3) item.ca3 = row.ca3;
          if (stageNumber >= 4) {
            item.examination = row.examination; item.total = row.total;
            item.grade = row.grade; item.remark = row.remark;
          }
          return item;
        })
      };
      return Response.json({
        success: true, student: studentSummary, results: [group],
        token: { remaining_uses: group.remaining_uses, academic_session_id: sessionId, term_id: termId, expires: false },
        request_already_processed: Boolean(debitRow.already_processed)
      });
    } catch (error) {
      console.error("student-results-portal:", error);
      return Response.json({ error: error instanceof Error ? error.message : "Unable to load student results." }, { status: 500 });
    }
  })
};
