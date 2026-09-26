import { createServerSupabaseClient } from "../supabase/server.js";
import { createBrowserSupabaseClient } from "../supabase/client.js";

export const ADMIN_ROLES = ["admin", "superadmin"];
export const ADMIN_COOKIE_NAME = "buzzora_admin_token";
export const ADMIN_REFRESH_COOKIE_NAME = "buzzora_admin_refresh_token";

/**
 * Safely resolves cookies from Next.js server context if available.
 */
async function getNextCookies() {
  try {
    const { cookies } = await import("next/headers");
    return cookies();
  } catch {
    return null;
  }
}

/**
 * Extracts the administrator bearer/session token from diverse server contexts:
 * 1. Explicit token string argument
 * 2. Options object containing { token }
 * 3. NextRequest / standard Request cookies or Authorization header
 * 4. next/headers cookies() store
 *
 * @param {string|Object|Request} [reqOrTokenOrOptions]
 * @returns {Promise<string|null>} Access token or null
 */
export async function extractAdminToken(reqOrTokenOrOptions) {
  if (typeof reqOrTokenOrOptions === "string" && reqOrTokenOrOptions.trim()) {
    return reqOrTokenOrOptions.trim();
  }

  if (reqOrTokenOrOptions && typeof reqOrTokenOrOptions.token === "string" && reqOrTokenOrOptions.token.trim()) {
    return reqOrTokenOrOptions.token.trim();
  }

  // Handle standard Next.js / Fetch Request objects
  if (reqOrTokenOrOptions && typeof reqOrTokenOrOptions === "object") {
    // 1. Authorization Bearer header
    const authHeader =
      typeof reqOrTokenOrOptions.headers?.get === "function"
        ? reqOrTokenOrOptions.headers.get("authorization")
        : reqOrTokenOrOptions.headers?.authorization;

    if (authHeader && /^Bearer\s+/i.test(authHeader)) {
      return authHeader.replace(/^Bearer\s+/i, "").trim();
    }

    // 2. Cookie store on request
    if (reqOrTokenOrOptions.cookies && typeof reqOrTokenOrOptions.cookies.get === "function") {
      const cookieVal = reqOrTokenOrOptions.cookies.get(ADMIN_COOKIE_NAME)?.value;
      if (cookieVal) return cookieVal.trim();
    } else if (typeof reqOrTokenOrOptions.headers?.get === "function") {
      // Parse Cookie header manually if cookies API not present
      const rawCookie = reqOrTokenOrOptions.headers.get("cookie") || "";
      const match = rawCookie.match(new RegExp(`(?:^|;\\s*)${ADMIN_COOKIE_NAME}=([^;]+)`));
      if (match && match[1]) {
        return decodeURIComponent(match[1]).trim();
      }
    }
  }

  // 3. Fallback to Next.js server headers cookie store
  const cookieStore = await getNextCookies();
  if (cookieStore && typeof cookieStore.get === "function") {
    const cookieVal = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
    if (cookieVal) return cookieVal.trim();
  }

  return null;
}

/**
 * Authoritative Server-Side Admin Identity & Role Verification.
 *
 * Security principles:
 * - Cryptographically verifies token against Supabase Auth server.
 * - Source of truth for roles is the database (public.admin_users) or server-controlled app_metadata.
 * - NEVER trusts user_metadata (which can be edited by client users).
 * - NEVER trusts client-supplied query params, headers, or request bodies.
 * - Immediately invalidates inactive administrators.
 * - Fails closed on any ambiguity.
 *
 * @param {string|Object|Request} [reqOrTokenOrOptions]
 * @returns {Promise<{
 *   authenticated: boolean,
 *   authorized: boolean,
 *   adminId?: string,
 *   email?: string,
 *   role?: "admin"|"superadmin"|null,
 *   isActive?: boolean,
 *   reason?: string
 * }>}
 */
export async function getAdminContext(reqOrTokenOrOptions) {
  const token = await extractAdminToken(reqOrTokenOrOptions);

  if (!token) {
    return {
      authenticated: false,
      authorized: false,
      reason: "NO_SESSION",
    };
  }

  // 1. Verify token with Supabase Auth
  let supabaseAdmin;
  try {
    supabaseAdmin = createServerSupabaseClient();
  } catch (err) {
    return {
      authenticated: false,
      authorized: false,
      reason: "SERVER_CONFIG_ERROR",
    };
  }

  const { data, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !data?.user) {
    return {
      authenticated: false,
      authorized: false,
      reason: "INVALID_OR_EXPIRED_SESSION",
    };
  }

  const user = data.user;
  const userId = user.id;
  const email = user.email || "";

  // 2. Query Authoritative Role from public.admin_users table
  let adminRecord = null;
  let tableMissing = false;

  try {
    const { data: record, error: dbError } = await supabaseAdmin
      .from("admin_users")
      .select("role, is_active")
      .eq("user_id", userId)
      .maybeSingle();

    if (dbError) {
      if (dbError.code === "PGRST205") {
        tableMissing = true;
      } else {
        console.error("[getAdminContext] Database query error:", dbError.message);
      }
    } else {
      adminRecord = record;
    }
  } catch (queryErr) {
    tableMissing = true;
  }

  // Case A: Record found in admin_users table (authoritative primary source)
  if (adminRecord) {
    if (!adminRecord.is_active) {
      return {
        authenticated: true,
        authorized: false,
        adminId: userId,
        email,
        role: adminRecord.role,
        isActive: false,
        reason: "ACCOUNT_INACTIVE",
      };
    }

    if (!ADMIN_ROLES.includes(adminRecord.role)) {
      return {
        authenticated: true,
        authorized: false,
        adminId: userId,
        email,
        role: adminRecord.role,
        isActive: true,
        reason: "INVALID_ROLE",
      };
    }

    return {
      authenticated: true,
      authorized: true,
      adminId: userId,
      email,
      role: adminRecord.role,
      isActive: true,
    };
  }

  // Case B: Table missing or user not in admin_users -> Inspect server-only app_metadata
  // Note: user.app_metadata can ONLY be modified via service-role API, never by client.
  const appRole = user.app_metadata?.role;
  const appIsActive = user.app_metadata?.is_active !== false;

  if (appRole && ADMIN_ROLES.includes(appRole)) {
    if (!appIsActive) {
      return {
        authenticated: true,
        authorized: false,
        adminId: userId,
        email,
        role: appRole,
        isActive: false,
        reason: "ACCOUNT_INACTIVE",
      };
    }

    return {
      authenticated: true,
      authorized: true,
      adminId: userId,
      email,
      role: appRole,
      isActive: true,
    };
  }

  // Case C: Authenticated user is a regular customer or holds no admin privileges
  // Explicitly ignore user_metadata to prevent privilege escalation.
  return {
    authenticated: true,
    authorized: false,
    adminId: userId,
    email,
    role: null,
    reason: "NOT_AN_ADMIN",
  };
}

/**
 * Asserts privileged administrator authorization.
 * Throws an Error with an appropriate HTTP statusCode if unauthorized.
 *
 * @param {string|Object|Request} [reqOrTokenOrOptions]
 * @returns {Promise<{
 *   authenticated: true,
 *   authorized: true,
 *   adminId: string,
 *   email: string,
 *   role: "admin"|"superadmin",
 *   isActive: true
 * }>}
 */
export async function requireAdmin(reqOrTokenOrOptions) {
  const context = await getAdminContext(reqOrTokenOrOptions);

  if (!context.authenticated) {
    const error = new Error("Authentication required. Please sign in.");
    error.statusCode = 401;
    error.code = context.reason || "UNAUTHENTICATED";
    throw error;
  }

  if (!context.authorized) {
    const error = new Error("Forbidden: Privileged administrator authorization required.");
    error.statusCode = 403;
    error.code = context.reason || "FORBIDDEN";
    throw error;
  }

  return context;
}

/**
 * Asserts superadmin authorization.
 *
 * @param {string|Object|Request} [reqOrTokenOrOptions]
 * @returns {Promise<{
 *   authenticated: true,
 *   authorized: true,
 *   adminId: string,
 *   email: string,
 *   role: "superadmin",
 *   isActive: true
 * }>}
 */
export async function requireSuperAdmin(reqOrTokenOrOptions) {
  const context = await requireAdmin(reqOrTokenOrOptions);

  if (context.role !== "superadmin") {
    const error = new Error("Forbidden: Superadmin authorization required.");
    error.statusCode = 403;
    error.code = "SUPERADMIN_REQUIRED";
    throw error;
  }

  return context;
}

/**
 * Server-side Admin Authentication Helper.
 * Validates credentials via Supabase Auth and verifies active admin role before returning session.
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{
 *   success: boolean,
 *   error?: string,
 *   code?: string,
 *   user?: { id: string, email: string, role: string },
 *   session?: Object
 * }>}
 */
export async function verifyAdminCredentials(email, password) {
  const cleanEmail = (email || "").trim().toLowerCase();
  const cleanPassword = typeof password === "string" ? password : "";

  // 1. Basic format validation
  if (!cleanEmail || !cleanEmail.includes("@") || !cleanPassword) {
    return {
      success: false,
      error: "Invalid email or password format.",
      code: "INVALID_INPUT",
    };
  }

  let authClient;
  try {
    authClient = createBrowserSupabaseClient();
  } catch (err) {
    return {
      success: false,
      error: "Server authentication configuration error.",
      code: "CONFIG_ERROR",
    };
  }

  // 2. Authenticate against Supabase Auth
  const { data, error } = await authClient.auth.signInWithPassword({
    email: cleanEmail,
    password: cleanPassword,
  });

  if (error || !data?.session?.access_token) {
    return {
      success: false,
      error: "Invalid email or password.",
      code: "INVALID_CREDENTIALS",
    };
  }

  // 3. Immediately verify administrator authorization
  const adminContext = await getAdminContext(data.session.access_token);

  if (!adminContext.authorized) {
    return {
      success: false,
      error: "Access denied. This account does not possess administrator privileges.",
      code: adminContext.reason || "UNAUTHORIZED_ADMIN",
    };
  }

  return {
    success: true,
    user: {
      id: adminContext.adminId,
      email: adminContext.email,
      role: adminContext.role,
    },
    session: data.session,
  };
}

/**
 * Configures secure HTTP-only cookies on an outgoing Response.
 *
 * @param {Response} response - Next.js NextResponse
 * @param {Object} session - Supabase session object
 */
export function setAdminSessionCookies(response, session) {
  const isProduction = process.env.NODE_ENV === "production";
  const maxAge = session.expires_in || 3600; // Default 1 hour if not specified

  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: session.access_token,
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge,
  });

  if (session.refresh_token) {
    response.cookies.set({
      name: ADMIN_REFRESH_COOKIE_NAME,
      value: session.refresh_token,
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
  }
}

/**
 * Clears administrator session cookies on an outgoing Response.
 *
 * @param {Response} response - Next.js NextResponse
 */
export function clearAdminSessionCookies(response) {
  const isProduction = process.env.NODE_ENV === "production";

  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });

  response.cookies.set({
    name: ADMIN_REFRESH_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
}
