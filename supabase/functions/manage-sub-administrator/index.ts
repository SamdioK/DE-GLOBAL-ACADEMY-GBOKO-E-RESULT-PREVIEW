import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@^1";

type Payload = {
  action?: "list" | "create" | "set_active" | "reset_password";
  profile_id?: string; is_active?: boolean; full_name?: string; username?: string;
  email?: string; phone?: string; staff_id?: string; designation?: string; responsibilities?: string;
};
function temporaryPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*?";
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return Array.from(bytes, b => alphabet[b % alphabet.length]).join("");
}
export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") return Response.json({ error: "Only POST requests are allowed." }, { status: 405 });
    let createdId: string | null = null;
    try {
      const actorId = ctx.userClaims?.id;
      if (!actorId) return Response.json({ error: "Authentication required." }, { status: 401 });
      const { data: actor, error: actorError } = await ctx.supabaseAdmin.from("profiles")
        .select("id,school_id,role,is_active").eq("id", actorId).maybeSingle();
      if (actorError) throw actorError;
      if (!actor || actor.role !== "administrator" || actor.is_active !== true || !actor.school_id)
        return Response.json({ error: "Only an active School Administrator can manage Sub Administrators." }, { status: 403 });
      const body: Payload = await req.json();
      if (body.action === "list") {
        const { data: profiles, error } = await ctx.supabaseAdmin.from("profiles")
          .select("id,full_name,username,email,phone,is_active,must_change_password,created_at")
          .eq("school_id", actor.school_id).eq("role", "sub_administrator").order("created_at", { ascending: false });
        if (error) throw error;
        const ids = (profiles || []).map((x: { id: string }) => x.id);
        const { data: details, error: detailError } = ids.length
          ? await ctx.supabaseAdmin.from("sub_administrator_details").select("profile_id,staff_id,designation,responsibilities").in("profile_id", ids)
          : { data: [], error: null };
        if (detailError) throw detailError;
        const byId = new Map((details || []).map((x: { profile_id: string }) => [x.profile_id, x]));
        return Response.json({ success: true, accounts: (profiles || []).map((x: { id: string }) => ({ ...x, details: byId.get(x.id) || null })) });
      }
      if (body.action === "create") {
        const fullName = String(body.full_name || "").trim();
        const username = String(body.username || "").trim();
        const email = String(body.email || "").trim().toLowerCase();
        const phone = String(body.phone || "").trim();
        if (!fullName || !username || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
          return Response.json({ error: "Enter a full name, username and valid email address." }, { status: 400 });
        if (fullName.length > 150 || username.length > 80 || email.length > 254)
          return Response.json({ error: "One or more account fields exceed the allowed length." }, { status: 400 });
        const { data: duplicate, error: duplicateError } = await ctx.supabaseAdmin.from("profiles")
          .select("id").eq("school_id", actor.school_id).ilike("username", username).maybeSingle();
        if (duplicateError) throw duplicateError;
        if (duplicate) return Response.json({ error: "That username is already in use in this school." }, { status: 409 });
        const password = temporaryPassword();
        const { data: authData, error: authError } = await ctx.supabaseAdmin.auth.admin.createUser({
          email, password, email_confirm: true,
          user_metadata: { full_name: fullName, username, role: "sub_administrator", school_id: actor.school_id, must_change_password: true }
        });
        if (authError) return Response.json({ error: authError.message }, { status: 409 });
        if (!authData.user) throw new Error("Supabase Auth did not return the new account.");
        createdId = authData.user.id;
        const { error: profileError } = await ctx.supabaseAdmin.from("profiles").insert({
          id: createdId, school_id: actor.school_id, full_name: fullName, username,
          email, phone: phone || null, role: "sub_administrator", is_active: true, must_change_password: true
        });
        if (profileError) throw profileError;
        const { error: detailsError } = await ctx.supabaseAdmin.from("sub_administrator_details").insert({
          profile_id: createdId, school_id: actor.school_id,
          staff_id: String(body.staff_id || "").trim() || null,
          designation: String(body.designation || "").trim() || null,
          responsibilities: String(body.responsibilities || "").trim() || null,
          created_by: actorId
        });
        if (detailsError) throw detailsError;
        return Response.json({
          success: true, account: { id: createdId, full_name: fullName, username, email, is_active: true, must_change_password: true },
          temporary_password: password
        }, { status: 201 });
      }
      const targetId = String(body.profile_id || "").trim();
      if (!targetId) return Response.json({ error: "A Sub Administrator profile is required." }, { status: 400 });
      const { data: target, error: targetError } = await ctx.supabaseAdmin.from("profiles")
        .select("id").eq("id", targetId).eq("school_id", actor.school_id)
        .eq("role", "sub_administrator").maybeSingle();
      if (targetError) throw targetError;
      if (!target) return Response.json({ error: "Sub Administrator account not found in this school." }, { status: 404 });
      if (body.action === "set_active") {
        if (typeof body.is_active !== "boolean") return Response.json({ error: "A valid account status is required." }, { status: 400 });
        const { error } = await ctx.supabaseAdmin.from("profiles")
          .update({ is_active: body.is_active, updated_at: new Date().toISOString() }).eq("id", targetId);
        if (error) throw error;
        return Response.json({ success: true, is_active: body.is_active });
      }
      if (body.action === "reset_password") {
        const password = temporaryPassword();
        const { error } = await ctx.supabaseAdmin.auth.admin.updateUserById(targetId, { password });
        if (error) throw error;
        const { error: profileError } = await ctx.supabaseAdmin.from("profiles")
          .update({ must_change_password: true, updated_at: new Date().toISOString() }).eq("id", targetId);
        if (profileError) throw profileError;
        return Response.json({ success: true, temporary_password: password, must_change_password: true });
      }
      return Response.json({ error: "Unsupported action." }, { status: 400 });
    } catch (error) {
      if (createdId) {
        await ctx.supabaseAdmin.from("sub_administrator_details").delete().eq("profile_id", createdId);
        await ctx.supabaseAdmin.from("profiles").delete().eq("id", createdId);
        await ctx.supabaseAdmin.auth.admin.deleteUser(createdId);
      }
      console.error("manage-sub-administrator error:", error);
      return Response.json({ error: error instanceof Error ? error.message : "Unable to manage Sub Administrator." }, { status: 500 });
    }
  })
};
