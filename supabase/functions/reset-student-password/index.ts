import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://samdiok.github.io",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

type ResetStatus =
  | "prepared"
  | "auth_update_started"
  | "completed"
  | "reconciliation_required"
  | "failed";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(value);
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value.trim());
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";

  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary);
}

async function encryptionKey(): Promise<CryptoKey> {
  const secret = Deno.env.get("STUDENT_RESET_ENCRYPTION_KEY_V1");

  if (!secret) {
    throw new Error("Reset encryption is not configured.");
  }

  const raw = decodeBase64(secret);

  if (raw.length !== 32) {
    throw new Error("Reset encryption key must decode to 32 bytes.");
  }

  return await crypto.subtle.importKey(
    "raw",
    raw,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptPassword(password: string): Promise<string> {
  const key = await encryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(password),
  );

  return `v1:${encodeBase64(iv)}:${
    encodeBase64(new Uint8Array(ciphertext))
  }`;
}

async function decryptPassword(value: string): Promise<string> {
  const parts = value.split(":");

  if (parts.length !== 3 || parts[0] !== "v1") {
    throw new Error("Stored password ciphertext has an unsupported format.");
  }

  const key = await encryptionKey();

  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: decodeBase64(parts[1]) },
    key,
    decodeBase64(parts[2]),
  );

  return new TextDecoder().decode(plaintext);
}

function generateTemporaryPassword(): string {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";

  const bytes = crypto.getRandomValues(new Uint8Array(48));
  let password = "";

  for (const byte of bytes) {
    password += alphabet[byte % alphabet.length];

    if (password.length === 24) break;
  }

  return password;
}

function unresolvedResponse(
  operationId: string,
  status: ResetStatus,
  message: string,
  httpStatus = 409,
) {
  return jsonResponse({
    success: false,
    operation_id: operationId,
    status: status === "prepared" ? "in_progress" : "outcome_uncertain",
    retry_same_operation: false,
    retry_with_same_operation_id: false,
    message,
  }, httpStatus);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const origin = req.headers.get("Origin");

  if (origin && origin !== "https://samdiok.github.io") {
    return jsonResponse({ error: "Origin not allowed." }, 403);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return jsonResponse({
        error: "Server configuration is incomplete.",
      }, 500);
    }

    const authorization = req.headers.get("Authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return jsonResponse({
        error: "Authentication is required.",
      }, 401);
    }

    const accessToken = authorization.slice(7).trim();

    if (!accessToken) {
      return jsonResponse({
        error: "Authentication is required.",
      }, 401);
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user: caller },
      error: callerError,
    } = await authClient.auth.getUser(accessToken);

    if (callerError || !caller) {
      return jsonResponse({
        error: "Your session is invalid or expired. Please sign in again.",
      }, 401);
    }

    const {
      data: callerProfile,
      error: callerProfileError,
    } = await adminClient
      .from("profiles")
      .select("id, school_id, role, is_active")
      .eq("id", caller.id)
      .maybeSingle();

    if (callerProfileError) {
      console.error(
        "Caller profile lookup failed:",
        callerProfileError.message,
      );

      return jsonResponse({
        error: "Unable to verify your account permissions.",
      }, 500);
    }

    if (
      !callerProfile ||
      callerProfile.is_active !== true ||
      callerProfile.role !== "administrator" ||
      !callerProfile.school_id
    ) {
      return jsonResponse({
        error: "An active School Administrator account is required.",
      }, 403);
    }

    let body: {
      student_id?: unknown;
      operation_id?: unknown;
    };

    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid request body." }, 400);
    }

    if (!isUuid(body.student_id) || !isUuid(body.operation_id)) {
      return jsonResponse({
        error: "Valid student_id and operation_id UUIDs are required.",
      }, 400);
    }

    const studentId = body.student_id;
    const operationId = body.operation_id;

    const {
      data: student,
      error: studentError,
    } = await adminClient
      .from("students")
      .select(
        "id, school_id, admission_number, profile_id, status, login_status",
      )
      .eq("id", studentId)
      .maybeSingle();

    if (studentError) {
      console.error("Student lookup failed:", studentError.message);

      return jsonResponse({
        error: "Unable to retrieve the student record.",
      }, 500);
    }

    if (!student) {
      return jsonResponse({ error: "Student record not found." }, 404);
    }

    if (student.school_id !== callerProfile.school_id) {
      return jsonResponse({
        error: "You can reset passwords only for students in your own school.",
      }, 403);
    }

    if (
      student.status !== "active" ||
      !student.profile_id ||
      student.login_status !== "created"
    ) {
      return jsonResponse({
        error:
          "Password reset requires an active student with an existing created login.",
      }, 400);
    }

    const admissionNumber = String(student.admission_number ?? "").trim();

    if (
      !admissionNumber ||
      admissionNumber.length > 100 ||
      /^PENDING-/i.test(admissionNumber)
    ) {
      return jsonResponse({
        error:
          "A valid admission number is required before resetting this password.",
      }, 400);
    }

    // Verify that the student belongs to the current academic session.
    const {
      data: currentSession,
      error: currentSessionError,
    } = await adminClient
      .from("academic_sessions")
      .select("id")
      .eq("school_id", student.school_id)
      .eq("is_current", true)
      .maybeSingle();

    if (currentSessionError) {
      console.error(
        "Current academic session lookup failed:",
        currentSessionError.message,
      );

      return jsonResponse({
        error: "Unable to verify the current academic session.",
      }, 500);
    }

    if (!currentSession) {
      return jsonResponse({
        error: "No current academic session is configured for this school.",
      }, 409);
    }

    const {
      data: currentEnrolments,
      error: enrolmentError,
    } = await adminClient
      .from("student_enrolments")
      .select("id, class_id")
      .eq("school_id", student.school_id)
      .eq("student_id", studentId)
      .eq("academic_session_id", currentSession.id)
      .limit(2);

    if (enrolmentError) {
      console.error(
        "Current student enrolment lookup failed:",
        enrolmentError.message,
      );

      return jsonResponse({
        error: "Unable to verify the student's current enrolment.",
      }, 500);
    }

    if (!currentEnrolments || currentEnrolments.length === 0) {
      return jsonResponse({
        error:
          "Password reset requires an enrolment in the current academic session.",
      }, 400);
    }

    if (currentEnrolments.length > 1) {
      return jsonResponse({
        error:
          "Multiple current-session enrolments were found. Resolve the enrolment records before resetting this password.",
      }, 409);
    }

    const {
      data: enrolledClass,
      error: enrolledClassError,
    } = await adminClient
      .from("classes")
      .select("id, school_id")
      .eq("id", currentEnrolments[0].class_id)
      .maybeSingle();

    if (enrolledClassError) {
      console.error(
        "Enrolled class lookup failed:",
        enrolledClassError.message,
      );

      return jsonResponse({
        error: "Unable to verify the student's enrolled class.",
      }, 500);
    }

    if (
      !enrolledClass ||
      enrolledClass.school_id !== student.school_id
    ) {
      return jsonResponse({
        error:
          "The student's enrolment points to a missing or inconsistent class.",
      }, 409);
    }

    const {
      data: studentProfile,
      error: studentProfileError,
    } = await adminClient
      .from("profiles")
      .select("id, school_id, role, is_active, must_change_password")
      .eq("id", student.profile_id)
      .maybeSingle();

    if (studentProfileError) {
      console.error(
        "Student profile lookup failed:",
        studentProfileError.message,
      );

      return jsonResponse({
        error: "Unable to verify the student's login profile.",
      }, 500);
    }

    if (
      !studentProfile ||
      studentProfile.id !== student.profile_id ||
      studentProfile.role !== "student" ||
      studentProfile.is_active !== true ||
      studentProfile.school_id !== student.school_id
    ) {
      return jsonResponse({
        error:
          "The student's linked profile is missing, inactive, or inconsistent.",
      }, 400);
    }

    const {
      data: existing,
      error: existingError,
    } = await adminClient
      .from("student_password_reset_operations")
      .select(
        "operation_id, school_id, student_id, initiated_by, status, encrypted_password, encryption_key_version, expires_at",
      )
      .eq("operation_id", operationId)
      .maybeSingle();

    if (existingError) {
      console.error("Operation lookup failed:", existingError.message);

      return jsonResponse({
        error: "Unable to verify the reset operation.",
      }, 500);
    }

    let operation = existing;

    if (operation) {
      if (
        operation.student_id !== studentId ||
        operation.school_id !== student.school_id ||
        operation.initiated_by !== caller.id
      ) {
        return jsonResponse({
          error: "This operation ID is already bound to a different reset request.",
        }, 409);
      }

      if (operation.status === "completed") {
        // Never change Auth again when recovering a completed operation.
        if (studentProfile.must_change_password !== true) {
          return jsonResponse({
            success: false,
            operation_id: operationId,
            status: "completed",
            retry_same_operation: false,
            message:
              "This operation already completed, but the account no longer requires the temporary password. No password change was performed by this request. Do not reset again automatically.",
          }, 409);
        }

        if (new Date(operation.expires_at).getTime() <= Date.now()) {
          return jsonResponse({
            success: false,
            operation_id: operationId,
            status: "completed",
            retry_same_operation: false,
            message:
              "This reset already completed, but its temporary credential has expired from recovery. Do not reset again automatically; begin a separately authorised reset only after confirming the student's current account state.",
          }, 410);
        }

        try {
          const password = await decryptPassword(operation.encrypted_password);

          return jsonResponse({
            success: true,
            operation_id: operationId,
            status: "completed",
            message:
              "This operation was already completed. No password change was performed by this request.",
            admission_number: admissionNumber,
            temporary_password: password,
            must_change_password: true,
          });
        } catch (decryptError) {
          console.error(
            "Completed operation credential recovery failed:",
            decryptError instanceof Error
              ? decryptError.message
              : "unknown",
          );

          return unresolvedResponse(
            operationId,
            "reconciliation_required",
            "The operation is marked completed, but its stored credential could not be recovered. Do not start another reset; contact the Portal Developer.",
          );
        }
      }

      if (operation.status !== "prepared") {
        return unresolvedResponse(
          operationId,
          operation.status as ResetStatus,
          "This operation may have reached the Auth password update. It will not be repeated automatically; reconcile the existing operation first.",
        );
      }
    } else {
      const temporaryPassword = generateTemporaryPassword();

      let encryptedPassword: string;

      try {
        encryptedPassword = await encryptPassword(temporaryPassword);
      } catch (encryptionError) {
        console.error(
          "Password encryption setup failed:",
          encryptionError instanceof Error
            ? encryptionError.message
            : "unknown",
        );

        return jsonResponse({
          error:
            "Secure password storage is not configured correctly. No reset was started.",
        }, 500);
      }

      const expiresAt = new Date(
        Date.now() + 24 * 60 * 60 * 1000,
      ).toISOString();

      const {
        data: inserted,
        error: insertError,
      } = await adminClient
        .from("student_password_reset_operations")
        .insert({
          operation_id: operationId,
          school_id: student.school_id,
          student_id: studentId,
          initiated_by: caller.id,
          status: "prepared",
          encrypted_password: encryptedPassword,
          encryption_key_version: "v1",
          attempts: 0,
          expires_at: expiresAt,
        })
        .select(
          "operation_id, school_id, student_id, initiated_by, status, encrypted_password, encryption_key_version, expires_at",
        )
        .maybeSingle();

      if (insertError || !inserted) {
        console.error(
          "Operation insert failed:",
          insertError?.message ?? "No inserted row returned",
        );

        // Verify whether this exact operation was reserved before permitting retry.
        const {
          data: afterInsertFailure,
          error: recoveryLookupError,
        } = await adminClient
          .from("student_password_reset_operations")
          .select(
            "operation_id, school_id, student_id, initiated_by, status, encrypted_password, encryption_key_version, expires_at",
          )
          .eq("operation_id", operationId)
          .maybeSingle();

        if (recoveryLookupError) {
          console.error(
            "Operation recovery lookup failed:",
            recoveryLookupError.message,
          );

          return unresolvedResponse(
            operationId,
            "reconciliation_required",
            "The reservation result could not be verified. Do not start another reset; contact the Portal Developer.",
          );
        }

        if (afterInsertFailure) {
          if (
            afterInsertFailure.student_id !== studentId ||
            afterInsertFailure.school_id !== student.school_id ||
            afterInsertFailure.initiated_by !== caller.id
          ) {
            return jsonResponse({
              error:
                "This operation ID is already bound to a different reset request.",
            }, 409);
          }

          if (
            afterInsertFailure.status === "completed" &&
            studentProfile.must_change_password === true &&
            new Date(afterInsertFailure.expires_at).getTime() > Date.now()
          ) {
            try {
              const recoveredPassword = await decryptPassword(
                afterInsertFailure.encrypted_password,
              );

              return jsonResponse({
                success: true,
                operation_id: operationId,
                status: "completed",
                message:
                  "The existing operation was recovered. No additional password change was performed.",
                admission_number: admissionNumber,
                temporary_password: recoveredPassword,
                must_change_password: true,
              });
            } catch (recoveryError) {
              console.error(
                "Existing operation credential recovery failed:",
                recoveryError instanceof Error
                  ? recoveryError.message
                  : "unknown",
              );
            }
          }

          return unresolvedResponse(
            operationId,
            afterInsertFailure.status as ResetStatus,
            "An operation record already exists or may be processing. It will not be repeated automatically; reconcile the existing operation first.",
          );
        }

        // No reservation exists for this ID. Auth was not reached by this request.
        return jsonResponse({
          success: false,
          operation_id: operationId,
          status: "in_progress",
          retry_with_same_operation_id: true,
          message:
            "No reservation was found for this operation ID, and this request did not reach the Auth password update. You may retry using the same operation ID only.",
        }, 503);
      }

      operation = inserted;
    }

    // Claim the prepared operation exactly once before touching Auth.
    const {
      data: claimed,
      error: claimError,
    } = await adminClient
      .from("student_password_reset_operations")
      .update({
        status: "auth_update_started",
        attempts: 1,
        auth_update_started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("operation_id", operationId)
      .eq("status", "prepared")
      .select("operation_id, encrypted_password, expires_at")
      .maybeSingle();

    if (claimError || !claimed) {
      console.error(
        "Operation claim failed:",
        claimError?.message ?? "Operation was not in prepared state",
      );

      return unresolvedResponse(
        operationId,
        "reconciliation_required",
        "Another request may be processing this operation. No second password update was started by this request.",
      );
    }

    let temporaryPassword: string;

    try {
      temporaryPassword = await decryptPassword(claimed.encrypted_password);
    } catch (decryptError) {
      console.error(
        "Prepared password decryption failed:",
        decryptError instanceof Error
          ? decryptError.message
          : "unknown",
      );

      await adminClient
        .from("student_password_reset_operations")
        .update({
          status: "reconciliation_required",
          last_error_code: "credential_decryption_failed",
          updated_at: new Date().toISOString(),
        })
        .eq("operation_id", operationId)
        .eq("status", "auth_update_started");

      return unresolvedResponse(
        operationId,
        "reconciliation_required",
        "The stored temporary password could not be decrypted. No Auth password update was attempted.",
      );
    }

    const {
      data: authResult,
      error: authLookupError,
    } = await adminClient.auth.admin.getUserById(student.profile_id);

    if (authLookupError || !authResult.user) {
      console.error(
        "Student Auth lookup failed:",
        authLookupError?.message ?? "user not found",
      );

      await adminClient
        .from("student_password_reset_operations")
        .update({
          status: "reconciliation_required",
          last_error_code: "auth_user_lookup_failed",
          updated_at: new Date().toISOString(),
        })
        .eq("operation_id", operationId)
        .eq("status", "auth_update_started");

      return unresolvedResponse(
        operationId,
        "reconciliation_required",
        "The Auth account could not be verified after reserving this operation. Do not repeat it automatically.",
      );
    }

    const { error: flagError } = await adminClient
      .from("profiles")
      .update({ must_change_password: true })
      .eq("id", student.profile_id)
      .eq("role", "student");

    if (flagError) {
      console.error(
        "Could not set password-change flag:",
        flagError.message,
      );

      await adminClient
        .from("student_password_reset_operations")
        .update({
          status: "reconciliation_required",
          last_error_code: "password_change_flag_failed",
          updated_at: new Date().toISOString(),
        })
        .eq("operation_id", operationId)
        .eq("status", "auth_update_started");

      return unresolvedResponse(
        operationId,
        "reconciliation_required",
        "The account could not be prepared safely. The operation has been held for reconciliation.",
      );
    }

    const { error: passwordError } = await adminClient.auth.admin
      .updateUserById(student.profile_id, {
        password: temporaryPassword,
        user_metadata: {
          ...(authResult.user.user_metadata ?? {}),
          must_change_password: true,
        },
      });

    if (passwordError) {
      console.error(
        "Auth password update returned an error; outcome is treated as uncertain:",
        passwordError.message,
      );

      const { error: uncertainStateError } = await adminClient
        .from("student_password_reset_operations")
        .update({
          status: "reconciliation_required",
          last_error_code: "auth_password_update_outcome_uncertain",
          updated_at: new Date().toISOString(),
        })
        .eq("operation_id", operationId)
        .eq("status", "auth_update_started");

      if (uncertainStateError) {
        console.error(
          "Could not record uncertain Auth outcome:",
          uncertainStateError.message,
        );
      }

      return unresolvedResponse(
        operationId,
        "reconciliation_required",
        "Supabase Auth returned an error and the password outcome cannot be safely determined. Do not retry this operation or start another reset; reconcile the existing operation first.",
        409,
      );
    }

    const {
      data: completedOperation,
      error: completeError,
    } = await adminClient
      .from("student_password_reset_operations")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_error_code: null,
      })
      .eq("operation_id", operationId)
      .eq("status", "auth_update_started")
      .select("operation_id")
      .maybeSingle();

    if (completeError || !completedOperation) {
      console.error(
        "Could not record completed reset operation:",
        completeError?.message ?? "No operation row was updated",
      );

      return unresolvedResponse(
        operationId,
        "reconciliation_required",
        "The Auth update may have succeeded, but completion could not be recorded. Do not retry or start another reset; reconcile this operation first.",
      );
    }

    console.log(
      "Student password reset completed for operation:",
      operationId,
    );

    return jsonResponse({
      success: true,
      operation_id: operationId,
      status: "completed",
      message:
        "The student's password has been reset. The student must change it at the next login.",
      admission_number: admissionNumber,
      temporary_password: temporaryPassword,
      must_change_password: true,
    });
  } catch (error) {
    console.error(
      "Unexpected password-reset error:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return jsonResponse({
      error:
        "An unexpected error occurred. Do not repeat a reset whose outcome is uncertain.",
    }, 500);
  }
});