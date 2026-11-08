import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@^1";

type Payload = { action?: "my_permissions" | "list" | "grant" | "revoke"; profile_id?: string; permission_key?: string };
const DELEGABLE = new Set([
  "view_results", "enter_results", "edit_results", "submit_results",
  "view_reports", "manage_comments", "manage_fees", "manage_students",
  "manage_classes", "manage_subjects", "manage_teachers"
]);

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") return Response.json({ error: "Only POST requests are allowed." }, { status: 405 });
    try {
      const actorId = ctx.userClaims?.id;
      if (!actorId) return Response.json({ error: "Authentication required." }, { status: 401 });
      const { data: actor, error: actorError } = await ctx.supabaseAdmin.from("profiles")
        .select("id,school_id,role,is_active").eq("id", actorId).maybeSingle();
      if (actorError) throw actorError;
      if (!actor || actor.is_active !== true || !actor.school_id)
        return Response.json({ error: "An active school profile is required." }, { status: 403 });

      const body: Payload = await req.json();

      if (body.action === "my_permissions") {
        if (actor.role !== "sub_administrator")
          return Response.json({ error: "This action is only available to Sub Administrators." }, { status: 403 });
        const { data: grants, error: grantsError } = await ctx.supabaseAdmin.from("profile_permission_grants")
          .select("permission_id,is_active").eq("school_id", actor.school_id)
          .eq("profile_id", actorId).eq("is_active", true);
        if (grantsError) throw grantsError;
        const ids = (grants || []).map((g: { permission_id: string }) => g.permission_id);
        if (!ids.length) return Response.json({ success: true, permissions: [] });
        const { data: permissions, error: permissionError } = await ctx.supabaseAdmin.from("permissions")
          .select("permission_key,permission_name").in("id", ids);
        if (permissionError) throw permissionError;
        return Response.json({ success: true, permissions: permissions || [] });
      }

      if (actor.role !== "administrator")
        return Response.json({ error: "Only an active School Administrator can manage another user's permissions." }, { status: 403 });
      if (!["list", "grant", "revoke"].includes(String(body.action)))
        return Response.json({ error: "Unsupported permission action." }, { status: 400 });
      const targetId = String(body.profile_id || "").trim();
      if (!targetId) return Response.json({ error: "A target profile is required." }, { status: 400 });
      const { data: target, error: targetError } = await ctx.supabaseAdmin.from("profiles")
        .select("id,school_id,role,is_active,full_name,username,email")
        .eq("id", targetId).eq("school_id", actor.school_id).maybeSingle();
      if (targetError) throw targetError;
      if (!target || target.role !== "sub_administrator" || target.is_active !== true)
        return Response.json({ error: "The target must be an active Sub Administrator in your school." }, { status: 404 });

      if (body.action === "list") {
        const { data, error } = await ctx.supabaseAdmin.from("profile_permission_grants")
          .select("id,permission_id,is_active,granted_at,revoked_at")
          .eq("school_id", actor.school_id).eq("profile_id", targetId).order("granted_at", { ascending: false });
        if (error) throw error;
        const ids = Array.from(new Set((data || []).map((g: { permission_id: string }) => g.permission_id)));
        const { data: catalogue, error: catalogueError } = ids.length
          ? await ctx.supabaseAdmin.from("permissions").select("id,permission_key,permission_name").in("id", ids)
          : { data: [], error: null };
        if (catalogueError) throw catalogueError;
        const byId = new Map<string, { id: string; permission_key: string; permission_name: string }>();
        (catalogue || []).forEach((x: { id: string; permission_key: string; permission_name: string }) => byId.set(x.id, x));
        return Response.json({ success: true, grants: (data || []).map((g: { permission_id: string }) => ({ ...g, permission: byId.get(g.permission_id) || null })) });
      }

      const key = String(body.permission_key || "").trim();
      if (!DELEGABLE.has(key))
        return Response.json({ error: "This permission is not approved for individual delegation." }, { status: 400 });
      const { data: permission, error: permissionError } = await ctx.supabaseAdmin.from("permissions")
        .select("id,permission_key").eq("permission_key", key).maybeSingle();
      if (permissionError) throw permissionError;
      if (!permission) return Response.json({ error: "Permission catalogue entry not found." }, { status: 404 });

      if (body.action === "grant") {
        const { data, error } = await ctx.supabaseAdmin.from("profile_permission_grants").upsert({
          school_id: actor.school_id, profile_id: targetId, permission_id: permission.id,
          is_active: true, granted_by: actorId, granted_at: new Date().toISOString(),
          revoked_by: null, revoked_at: null, updated_at: new Date().toISOString()
        }, { onConflict: "school_id,profile_id,permission_id" }).select("id,is_active,granted_at").single();
        if (error) throw error;
        return Response.json({ success: true, action: body.action, grant: data });
      }

      const { data: changed, error: changeError } = await ctx.supabaseAdmin.from("profile_permission_grants")
        .update({ is_active: false, revoked_by: actorId, revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("school_id", actor.school_id).eq("profile_id", targetId)
        .eq("permission_id", permission.id).eq("is_active", true).select("id").maybeSingle();
      if (changeError) throw changeError;
      return Response.json({ success: true, action: body.action, changed: !!changed });
    } catch (error) {
      console.error("manage-profile-permissions error:", error);
      return Response.json({ error: error instanceof Error ? error.message : "Unable to manage profile permissions." }, { status: 500 });
    }
  })
};
