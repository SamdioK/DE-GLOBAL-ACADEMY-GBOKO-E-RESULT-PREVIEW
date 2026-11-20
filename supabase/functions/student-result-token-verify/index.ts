import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") || "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};
function respond(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return respond({ error: "Method not allowed." }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const secret = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!url || !anon || !service || !secret) return respond({ error: "Payment service configuration is incomplete." }, 500);

    const bearer = (req.headers.get("Authorization") || "").match(/^Bearer\s+(.+)$/i)?.[1];
    if (!bearer) return respond({ error: "Student sign-in is required." }, 401);
    const auth = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authError } = await auth.auth.getUser(bearer);
    if (authError || !authData.user) return respond({ error: "Your student session is invalid." }, 401);

    const body = await req.json().catch(() => null);
    const reference = typeof body?.reference === "string" ? body.reference.trim() : "";
    if (!/^dgresult_[a-f0-9]{32}$/.test(reference)) return respond({ error: "A valid result-token payment reference is required." }, 400);

    const db = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: profile, error: profileError } = await db.from("profiles").select("id,school_id,role,is_active")
      .eq("id", authData.user.id).maybeSingle();
    if (profileError) throw profileError;
    if (!profile || profile.role !== "student" || profile.is_active !== true) return respond({ error: "An active student account is required." }, 403);

    const { data: purchase, error: purchaseError } = await db.from("student_result_token_purchases")
      .select("id,school_id,student_id,profile_id,academic_session_id,term_id,reference,amount_kobo,currency,token_uses,payment_status,credited_at")
      .eq("reference", reference).eq("profile_id", profile.id).eq("school_id", profile.school_id).maybeSingle();
    if (purchaseError) throw purchaseError;
    if (!purchase) return respond({ error: "This payment reference does not belong to your student account." }, 404);

    const verifyResponse = await fetch("https://api.paystack.co/transaction/verify/" + encodeURIComponent(reference), {
      headers: { Authorization: "Bearer " + secret, Accept: "application/json" },
      signal: AbortSignal.timeout(20000),
    });
    const verification = await verifyResponse.json().catch(() => ({}));
    const tx = verification?.data;
    if (!verifyResponse.ok || verification.status !== true || !tx) return respond({ error: "Paystack could not verify this payment yet. Please retry shortly." }, 502);

    const matches = tx.reference === purchase.reference &&
      Number(tx.amount) === Number(purchase.amount_kobo) &&
      tx.currency === purchase.currency;
    const status = matches && typeof tx.status === "string" ? tx.status.toLowerCase() : "unknown";
    if (!matches) {
      await db.from("student_result_token_purchases").update({ payment_status: "unknown", gateway_response: "Paystack transaction details did not match the expected amount, currency or reference.", updated_at: new Date().toISOString() }).eq("id", purchase.id);
      return respond({ success: false, payment_status: "unknown", error: "The payment details could not be matched. No token was credited." }, 409);
    }
    if (status !== "success") {
      const safeStatus = ["failed","abandoned","reversed","pending"].includes(status) ? status : "unknown";
      await db.from("student_result_token_purchases").update({ payment_status: safeStatus, gateway_response: String(tx.gateway_response || status).slice(0, 500), updated_at: new Date().toISOString() }).eq("id", purchase.id);
      return respond({ success: false, payment_status: safeStatus, error: "Paystack has not confirmed a successful payment. No token was credited." }, 409);
    }

    const { error: updateError } = await db.from("student_result_token_purchases").update({
      payment_status: "success",
      paystack_transaction_id: tx.id == null ? null : String(tx.id),
      gateway_response: String(tx.gateway_response || "success").slice(0, 500),
      paid_at: tx.paid_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", purchase.id);
    if (updateError) throw updateError;

    const { data: credited, error: creditError } = await db.rpc("credit_student_result_token_purchase", { p_reference: reference });
    if (creditError) throw creditError;
    const balance = Array.isArray(credited) ? credited[0] : credited;
    return respond({
      success: true, payment_status: "success", reference,
      amount_kobo: 65199, currency: "NGN", token_uses: 5,
      remaining_uses: Number(balance?.remaining_uses || 0),
      credited_now: Boolean(balance?.credited),
      message: "Payment verified. Five result checks are available for the selected academic session and term. The token does not expire.",
    });
  } catch (error) {
    console.error("student-result-token-verify:", error);
    return respond({ error: "Payment verification could not be completed. No unverified token will be issued." }, 500);
  }
});
