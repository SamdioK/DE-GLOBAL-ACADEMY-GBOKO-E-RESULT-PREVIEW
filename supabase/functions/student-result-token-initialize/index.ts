import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") || "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

function respond(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return respond({ error: "Method not allowed." }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY");
    const appOrigin = Deno.env.get("APP_ORIGIN");
    if (!supabaseUrl || !anonKey || !serviceKey || !paystackSecret || !appOrigin) {
      return respond({ error: "Payment service is not fully configured. Contact the School Administrator." }, 500);
    }

    const authHeader = req.headers.get("Authorization") || "";
    const bearer = authHeader.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!bearer) return respond({ error: "Student sign-in is required." }, 401);

    const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authError } = await authClient.auth.getUser(bearer);
    if (authError || !authData.user) return respond({ error: "Your student session is invalid. Sign in again." }, 401);

    const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: profile, error: profileError } = await db.from("profiles")
      .select("id,school_id,role,is_active,email")
      .eq("id", authData.user.id).maybeSingle();
    if (profileError) throw profileError;
    if (!profile || profile.role !== "student" || profile.is_active !== true || !profile.school_id) {
      return respond({ error: "An active student account is required." }, 403);
    }

    const { data: student, error: studentError } = await db.from("students")
      .select("id,school_id,profile_id,status,admission_number")
      .eq("profile_id", profile.id).eq("school_id", profile.school_id).maybeSingle();
    if (studentError) throw studentError;
    if (!student || student.status !== "active") return respond({ error: "Your active student record could not be found." }, 404);

    const body = await req.json().catch(() => null);
    const sessionId = typeof body?.academic_session_id === "string" ? body.academic_session_id : "";
    const termId = typeof body?.term_id === "string" ? body.term_id : "";
    if (!sessionId || !termId) return respond({ error: "Select an academic session and term." }, 400);

    const { data: release, error: releaseError } = await db.from("student_result_release_stages")
      .select("id,release_stage").eq("school_id", profile.school_id).eq("student_id", student.id)
      .eq("academic_session_id", sessionId).eq("term_id", termId).gt("release_stage", 0).maybeSingle();
    if (releaseError) throw releaseError;
    if (!release) return respond({ error: "This result has not been released for online checking." }, 409);

    const { data: priorBalance, error: balanceError } = await db.from("student_result_token_balances")
      .select("remaining_uses").eq("school_id", profile.school_id).eq("student_id", student.id)
      .eq("academic_session_id", sessionId).eq("term_id", termId).maybeSingle();
    if (balanceError) throw balanceError;
    const { data: existing, error: pendingError } = await db.from("student_result_token_purchases")
      .select("reference,payment_status").eq("school_id", profile.school_id).eq("student_id", student.id)
      .eq("academic_session_id", sessionId).eq("term_id", termId).eq("payment_status", "pending")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (pendingError) throw pendingError;

    const email = authData.user.email || profile.email || "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return respond({ error: "A valid email address is required on your student account. Contact the School Administrator." }, 400);

    const callbackCandidate = typeof body?.callback_url === "string" ? body.callback_url : "";
    let callbackUrl: string;
    try {
      const candidate = new URL(callbackCandidate);
      const allowed = new URL(appOrigin);
      if (candidate.origin !== allowed.origin || candidate.protocol !== "https:") throw new Error("Invalid callback origin.");
      callbackUrl = candidate.toString();
    } catch {
      return respond({ error: "The payment return address is not configured correctly. Contact the School Administrator." }, 400);
    }

    const reference = "dgresult_" + crypto.randomUUID().replaceAll("-", "");
    const { error: insertError } = await db.from("student_result_token_purchases").insert({
      school_id: profile.school_id, student_id: student.id, profile_id: profile.id,
      academic_session_id: sessionId, term_id: termId, reference,
      amount_kobo: 65199, currency: "NGN", token_uses: 5, payment_status: "pending",
    });
    if (insertError) throw insertError;

    const gatewayResponse = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: "Bearer " + paystackSecret, "Content-Type": "application/json" },
      body: JSON.stringify({
        email, amount: 65199, currency: "NGN", reference, callback_url: callbackUrl,
        metadata: {
          service: "student_result_token", student_id: student.id,
          academic_session_id: sessionId, term_id: termId, token_uses: 5,
        },
      }),
      signal: AbortSignal.timeout(20000),
    });
    const gateway = await gatewayResponse.json().catch(() => ({}));
    if (!gatewayResponse.ok || gateway.status !== true || !gateway.data?.authorization_url) {
      await db.from("student_result_token_purchases").update({ payment_status: "failed", gateway_response: String(gateway.message || "Paystack initialization failed").slice(0, 500), updated_at: new Date().toISOString() }).eq("reference", reference);
      return respond({ error: "Paystack could not start the payment. Please try again." }, 502);
    }

    return respond({
      success: true, authorization_url: gateway.data.authorization_url, reference,
      amount_kobo: 65199, currency: "NGN", token_uses: 5,
      remaining_uses: Number(priorBalance?.remaining_uses || 0),
      pending_reference: existing?.reference || null,
    });
  } catch (error) {
    console.error("student-result-token-initialize:", error);
    return respond({ error: "Unable to initialize the result-token payment." }, 500);
  }
});
