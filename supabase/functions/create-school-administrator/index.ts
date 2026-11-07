import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@^1";

interface AdminPayload {
  school_id: string;
  full_name: string;
  username: string;
  email: string;
  phone?: string;
  password: string;
}

console.info("create-school-administrator function started");

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    try {
      if (req.method !== "POST") {
        return Response.json(
          { error: "Only POST requests are allowed." },
          { status: 405 }
        );
      }

      const callerId = ctx.userClaims?.id;

      if (!callerId) {
        return Response.json(
          { error: "Authenticated user could not be identified." },
          { status: 401 }
        );
      }

      // Check that the caller is an active Portal Developer.
      const { data: developerProfile, error: developerError } =
        await ctx.supabase
          .from("profiles")
          .select("id, school_id, role, is_active")
          .eq("id", callerId)
          .maybeSingle();

      if (developerError) {
        throw developerError;
      }

      if (
        !developerProfile ||
        developerProfile.role !== "portal_developer" ||
        developerProfile.is_active !== true
      ) {
        return Response.json(
          {
            error:
              "Only an active Portal Developer can create a School Administrator.",
          },
          { status: 403 }
        );
      }

      const body: AdminPayload = await req.json();

      const schoolId = String(body.school_id || "").trim();
      const fullName = String(body.full_name || "").trim();
      const username = String(body.username || "").trim();
      const email = String(body.email || "").trim().toLowerCase();
      const phone = String(body.phone || "").trim();
      const password = String(body.password || "");

      if (!schoolId || !fullName || !username || !email || !password) {
        return Response.json(
          {
            error:
              "School, full name, username, email and password are required.",
          },
          { status: 400 }
        );
      }

      if (password.length < 8) {
        return Response.json(
          {
            error: "Administrator password must contain at least 8 characters.",
          },
          { status: 400 }
        );
      }

      // Verify that the selected school exists.
      const { data: school, error: schoolError } =
        await ctx.supabaseAdmin
          .from("schools")
          .select("id")
          .eq("id", schoolId)
          .maybeSingle();

      if (schoolError) {
        throw schoolError;
      }

      if (!school) {
        return Response.json(
          { error: "The selected school does not exist." },
          { status: 404 }
        );
      }

      // Prevent duplicate username within the selected school.
      const { data: existingUsername, error: usernameError } =
        await ctx.supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("school_id", schoolId)
          .eq("username", username)
          .maybeSingle();

      if (usernameError) {
        throw usernameError;
      }

      if (existingUsername) {
        return Response.json(
          { error: "That username is already in use for this school." },
          { status: 409 }
        );
      }

      // Create the Administrator's Supabase Auth account.
      const { data: authData, error: authError } =
        await ctx.supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            full_name: fullName,
            username,
            phone: phone || null,
            role: "administrator",
            school_id: schoolId,
          },
        });

      if (authError) {
        return Response.json(
          { error: authError.message },
          { status: 400 }
        );
      }

      if (!authData.user) {
        throw new Error("Supabase did not return the new Auth user.");
      }

      // Create the application's Administrator profile.
      const { error: profileError } =
        await ctx.supabaseAdmin
          .from("profiles")
          .insert({
            id: authData.user.id,
            school_id: schoolId,
            full_name: fullName,
            username,
            phone: phone || null,
            email,
            role: "administrator",
            is_active: true,
          });

      // Roll back Auth account if profile creation fails.
      if (profileError) {
        await ctx.supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        throw profileError;
      }

      return Response.json(
        {
          success: true,
          message: "School Administrator created successfully.",
          administrator: {
            id: authData.user.id,
            school_id: schoolId,
            full_name: fullName,
            username,
            email,
            role: "administrator",
            is_active: true,
          },
        },
        { status: 201 }
      );
    } catch (error) {
      console.error("create-school-administrator error:", error);

      return Response.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Unable to create School Administrator.",
        },
        { status: 500 }
      );
    }
  }),
};