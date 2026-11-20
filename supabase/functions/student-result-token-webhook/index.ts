import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-paystack-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};
function respond(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...headers, "Content-Type": "application/json" } });
}
function toHex(bytes: Uint8Array) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function signature(secret: string, body: Uint8Array) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  return toHex(new Uint8Array(await crypto.subtle.sign("HMAC", key, body)));
}
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return respond({ error: "Method not allowed." }, 405);
  try {
    const secret = Deno.env.get("PAYSTACK_SECRET_KEY");
    const url = Deno.env.get("SUPABASE_URL");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!secret || !url || !service) return respond({ error: "Webhook service configuration is incomplete." }, 500);

    const raw = new Uint8Array(await req.arrayBuffer());
    const supplied = (req.headers.get("x-paystack-signature") || "").toLowerCase();
    const expected = await signature(secret, raw);
    if (!safeEqual(supplied, expected)) return respond({ error: "Invalid Paystack signature." }, 401);

    const event = JSON.parse(new TextDecoder().decode(raw));
    if (event.event !== "charge.success" || !event.data?.reference) return respond({ received: true, ignored: true });

    const reference = String(event.data.reference);
    if (!/^dgresult_[a-f0-9]{32}$/.test(reference)) return respond({ received: true, ignored: true });

    const db = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: purchase, error: lookupError } = await db.from("student_result_token_purchases")
      .select("id,reference,amount_kobo,currency,payment_status")
      .eq("reference", reference).maybeSingle();
    if (lookupError) throw lookupError;
    if (!purchase) return respond({ received: true, ignored: true });

    // Never trust the webhook payload alone. Re-verify directly with Paystack.
    const verifyResponse = await fetch("https://api.paystack.co/transaction/verify/" + encodeURIComponent(reference), {
      headers: { Authorization: "Bearer " + secret, Accept: "application/json" },
      signal: AbortSignal.timeout(20000),
    });
    const verification = await verifyResponse.json().catch(() => ({}));
    const tx = verification?.data;
    const valid = verifyResponse.ok && verification.status === true &&
      tx?.status === "success" && tx.reference === purchase.reference &&
      Number(tx.amount) === Number(purchase.amount_kobo) && tx.currency === purchase.currency;

    if (!valid) return respond({ received: true, verified: false });

    const { error: updateError } = await db.from("student_result_token_purchases").update({
      payment_status: "success",
      paystack_transaction_id: tx.id == null ? null : String(tx.id),
      gateway_response: String(tx.gateway_response || "success").slice(0, 500),
      paid_at: tx.paid_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", purchase.id);
    if (updateError) throw updateError;

    const { error: creditError } = await db.rpc("credit_student_result_token_purchase", { p_reference: reference });
    if (creditError) throw creditError;
    return respond({ received: true, verified: true, credited: true });
  } catch (error) {
    console.error("student-result-token-webhook:", error);
    return respond({ error: "Webhook processing failed; Paystack may retry." }, 500);
  }
});
