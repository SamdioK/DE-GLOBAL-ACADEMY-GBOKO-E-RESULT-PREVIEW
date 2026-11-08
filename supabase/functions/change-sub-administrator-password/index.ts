import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@^1";

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") return Response.json({ error: "Only POST requests are allowed." }, { status: 405 });
    try {
      const userId = ctx.userClaims?.id;
      if (!userId) return Response.json({ error: "Authentication required." }, { status: 401 });
      const { data: profile, error: profileError } = await ctx.supabaseAdmin.from("profiles")
        .select("id,role,is_active,must_change_password").eq("id", userId).maybeSingle();
      if (profileError) throw profileError;
      if (!profile || profile.role !== "sub_administrator" || profile.is_active !== true)
        return Response.json({ error: "An active Sub Administrator account is required." }, { status: 403 });
      const body = await req.json();
      const password = String(body.new_password || "");
      if (password.length < 12 || password.length > 128 ||
          !/[A-Z]/.test(password) || !/[a-z]/.test(password) ||
          !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password))
        return Response.json({ error: "Use 12–128 characters and include uppercase and lowercase letters, a number and a special character." }, { status: 400 });
      const { error: authError } = await ctx.supabaseAdmin.auth.admin.updateUserById(userId, { password });
      if (authError) throw authError;
      const { error: updateError } = await ctx.supabaseAdmin.from("profiles")
        .update({ must_change_password: false, updated_at: new Date().toISOString() }).eq("id", userId);
      if (updateError) throw updateError;
      return Response.json({ success: true, message: "Password changed successfully." });
    } catch (error) {
      console.error("change-sub-administrator-password error:", error);
      return Response.json({ error: error instanceof Error ? error.message : "Unable to change password." }, { status: 500 });
    }
  })
};
