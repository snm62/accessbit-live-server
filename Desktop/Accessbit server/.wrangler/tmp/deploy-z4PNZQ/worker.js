var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker.js
var worker_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return handleCORS();
    }
    if (url.pathname === "/api/auth/authorize") {
      return handleOAuthAuthorize(request, env);
    }
    if (url.pathname === "/api/auth/callback") {
      return handleOAuthCallback(request, env);
    }
    if (url.pathname === "/api/auth/token" && request.method === "POST") {
      return handleTokenAuth(request, env);
    }
    if (url.pathname === "/api/accessibility/settings" && request.method === "GET") {
      return handleGetSettings(request, env);
    }
    if (url.pathname === "/api/accessibility/settings" && (request.method === "POST" || request.method === "PUT")) {
      return handleUpdateSettings(request, env);
    }
    if (url.pathname === "/api/auth/verify") {
      return handleVerifyAuth(request, env);
    }
    if (url.pathname === "/api/accessibility/publish" && request.method === "POST") {
      return handlePublishSettings(request, env);
    }
    return new Response("Accessibility Widget API", {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
};
function handleCORS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400"
    }
  });
}
__name(handleCORS, "handleCORS");
async function handleOAuthAuthorize(request, env) {
  const url = new URL(request.url);
  const incomingState = url.searchParams.get("state");
  const siteId = url.searchParams.get("siteId");
  const isDesigner = incomingState && incomingState.startsWith("webflow_designer");
  const scopes = [
    "sites:read",
    "sites:write",
    "custom_code:read",
    "custom_code:write",
    "authorized_user:read"
  ];
  const redirectUri = "https://accessibility-widget.web-8fb.workers.dev/api/auth/callback";
  const authUrl = new URL("https://webflow.com/oauth/authorize");
  authUrl.searchParams.set("client_id", env.WEBFLOW_CLIENT_ID);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", scopes.join(" "));
  if (isDesigner) {
    const currentSiteId = siteId || (incomingState.includes("_") ? incomingState.split("_")[1] : null);
    if (currentSiteId) {
      authUrl.searchParams.set("state", `webflow_designer_${currentSiteId}`);
    } else {
      authUrl.searchParams.set("state", "webflow_designer");
    }
  } else {
    authUrl.searchParams.set("state", "accessibility_widget");
  }
  return new Response(null, {
    status: 302,
    headers: {
      "Location": authUrl.toString()
    }
  });
}
__name(handleOAuthAuthorize, "handleOAuthAuthorize");
async function handleOAuthCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code) {
    return new Response(JSON.stringify({ error: "No authorization code provided" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  if (!state) {
  }
  try {
    const isDesigner = state && state.startsWith("webflow_designer");
    const redirectUri = "https://accessibility-widget.web-8fb.workers.dev/api/auth/callback";
    console.log("=== OAUTH CALLBACK DEBUG ===");
    console.log("Request URL:", request.url);
    console.log("Code received:", code);
    console.log("State:", state);
    console.log("Using redirect URI:", redirectUri);
    console.log("Client ID:", env.WEBFLOW_CLIENT_ID);
    console.log("Flow type:", isDesigner ? "App Interface" : "Apps & Integrations");
    const tokenRequestBody = {
      client_id: env.WEBFLOW_CLIENT_ID,
      client_secret: env.WEBFLOW_CLIENT_SECRET,
      code,
      grant_type: "authorization_code"
    };
    if (isDesigner) {
      tokenRequestBody.redirect_uri = redirectUri;
    }
    console.log("Token request body:", JSON.stringify(tokenRequestBody, null, 2));
    const tokenResponse = await fetch("https://api.webflow.com/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(tokenRequestBody)
    });
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token exchange failed:", tokenResponse.status, errorText);
      throw new Error(`Token exchange failed: ${tokenResponse.status} - ${errorText}`);
    }
    const tokenData = await tokenResponse.json();
    console.log("Token exchange successful");
    const userResponse = await fetch("https://api.webflow.com/v2/token/authorized_by", {
      headers: {
        "Authorization": `Bearer ${tokenData.access_token}`,
        "accept-version": "2.0.0"
      }
    });
    if (!userResponse.ok) {
      throw new Error(`User fetch failed: ${userResponse.status}`);
    }
    const userData = await userResponse.json();
    const sitesResponse = await fetch("https://api.webflow.com/v2/sites", {
      headers: {
        "Authorization": `Bearer ${tokenData.access_token}`,
        "accept-version": "2.0.0"
      }
    });
    if (!sitesResponse.ok) {
      throw new Error(`Sites fetch failed: ${sitesResponse.status}`);
    }
    const sitesData = await sitesResponse.json();
    let sites = [];
    if (sitesData.sites) {
      sites = sitesData.sites;
    } else if (sitesData.items) {
      sites = sitesData.items;
    } else if (Array.isArray(sitesData)) {
      sites = sitesData;
    }
    if (sites.length === 0) {
      throw new Error("No Webflow sites found");
    }
    const sessionToken = await createSessionToken(userData, env);
    if (isDesigner) {
      const siteIdFromState = state.includes("_") ? state.split("_")[1] : null;
      let currentSite;
      if (siteIdFromState) {
        currentSite = sites.find((site) => site.id === siteIdFromState) || sites[0];
      } else {
        currentSite = sites[0];
      }
      await env.ACCESSIBILITY_AUTH.put(currentSite.id, JSON.stringify({
        accessToken: tokenData.access_token,
        siteName: currentSite.shortName,
        siteId: currentSite.id,
        user: userData,
        installedAt: (/* @__PURE__ */ new Date()).toISOString(),
        accessibilitySettings: {
          fontSize: "medium",
          contrast: "normal",
          animations: true,
          screenReader: false,
          keyboardNavigation: true,
          focusIndicators: true,
          highContrast: false,
          reducedMotion: false,
          textSpacing: "normal",
          cursorSize: "normal"
        },
        widgetVersion: "1.0.0",
        lastUsed: (/* @__PURE__ */ new Date()).toISOString()
      }), { expirationTtl: 86400 });
      return new Response(`<!DOCTYPE html>
        <html>
          <head>
            <title>Accessibility Widget Installed</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
              .success { color: #28a745; }
            </style>
          </head>
          <body>
            <h1 class="success">\u2705 Accessibility Widget Installed Successfully!</h1>
            <p>Your accessibility widget is now active on this site.</p>
            <script>
              const sessionData = {
                type: 'AUTH_SUCCESS',
                sessionToken: '${sessionToken.token}',
                user: {
                  firstName: '${userData.firstName || "User"}',
                  email: '${userData.email}',
                  siteId: '${currentSite.id}'
                },
                siteInfo: {
                  siteId: '${currentSite.id}',
                  siteName: '${currentSite.name || currentSite.shortName || "Unknown Site"}',
                  shortName: '${currentSite.shortName}',
                  url: '${currentSite.url || `https://${currentSite.shortName}.webflow.io`}'
                }
              };
              
              window.opener.postMessage(sessionData, '*');
              window.close();
            <\/script>
          </body>
        </html>`, {
        headers: { "Content-Type": "text/html" }
      });
    }
    const storePromises = sites.map(
      (site) => env.ACCESSIBILITY_AUTH.put(site.id, JSON.stringify({
        accessToken: tokenData.access_token,
        siteName: site.shortName,
        siteId: site.id,
        user: userData,
        installedAt: (/* @__PURE__ */ new Date()).toISOString(),
        accessibilitySettings: {
          fontSize: "medium",
          contrast: "normal",
          animations: true,
          screenReader: false,
          keyboardNavigation: true,
          focusIndicators: true,
          highContrast: false,
          reducedMotion: false,
          textSpacing: "normal",
          cursorSize: "normal"
        },
        widgetVersion: "1.0.0",
        lastUsed: (/* @__PURE__ */ new Date()).toISOString()
      }), { expirationTtl: 86400 })
    );
    await Promise.all(storePromises);
    const firstSite = sites[0];
    return new Response(`<!DOCTYPE html>
      <html>
        <head>
          <title>Accessibility Widget Installed</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .success { color: #28a745; }
            .redirect { color: #007bff; margin-top: 20px; }
          </style>
        </head>
        <body>
          <h1 class="success">\u2705Accessibility Widget Installed Successfully!</h1>
          <p>Your accessibility widget is now active on this site.</p>
          <p class="redirect">Redirecting to your site...</p>
          <script>
            // Store site info in session storage
            sessionStorage.setItem('wf_hybrid_user', JSON.stringify({
              sessionToken: '${sessionToken.token}',
              firstName: '${userData.firstName || "User"}',
              email: '${userData.email}',
              exp: Date.now() + (24 * 60 * 60 * 1000),
              siteInfo: {
                siteId: '${firstSite.id}',
                siteName: '${firstSite.name || firstSite.shortName || "Unknown Site"}',
                shortName: '${firstSite.shortName}',
                url: '${firstSite.url || `https://${firstSite.shortName}.webflow.io`}'
              }
            }));
            
            // Redirect to the site after a short delay
            setTimeout(() => {
              window.location.href = 'https://${firstSite.shortName}.design.webflow.com?app=${env.WEBFLOW_CLIENT_ID}';
            }, 2000);
          <\/script>
        </body>
      </html>`, {
      headers: { "Content-Type": "text/html" }
    });
  } catch (error) {
    console.error("OAuth callback error:", error);
    return new Response(JSON.stringify({
      error: "Authorization failed",
      details: error.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(handleOAuthCallback, "handleOAuthCallback");
async function handlePublishSettings(request, env) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`[PUBLISH] ${requestId} Starting publish request`);
  try {
    const authResult = await verifyAuth(request, env);
    if (!authResult) {
      console.log(`[PUBLISH] ${requestId} Authentication failed`);
      return new Response(JSON.stringify({
        error: "Unauthorized",
        requestId
      }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization"
        }
      });
    }
    const { siteId } = authResult;
    console.log(`[PUBLISH] ${requestId} Authenticated for siteId: ${siteId}`);
    const body = await request.json();
    console.log(`[PUBLISH] ${requestId} Received body:`, body);
    const { customization, accessibilityProfiles, customDomain, publishedAt } = body;
    const siteData = await env.ACCESSIBILITY_AUTH.get(siteId);
    if (!siteData) {
      console.log(`[PUBLISH] ${requestId} Site not found: ${siteId}`);
      return new Response(JSON.stringify({
        error: "Site not found",
        requestId
      }), {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization"
        }
      });
    }
    const siteInfo = JSON.parse(siteData);
    siteInfo.customization = customization || {};
    siteInfo.accessibilityProfiles = accessibilityProfiles || [];
    siteInfo.customDomain = customDomain || null;
    siteInfo.publishedAt = publishedAt || (/* @__PURE__ */ new Date()).toISOString();
    siteInfo.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
    siteInfo.lastUsed = (/* @__PURE__ */ new Date()).toISOString();
    const kvKey = `Accessibility-Settings:${siteId}`;
    console.log(`[PUBLISH] ${requestId} Storing settings with key: ${kvKey}`);
    const dataToStore = {
      ...siteInfo,
      accessToken: siteInfo.accessToken,
      siteId,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await env.ACCESSIBILITY_AUTH.put(kvKey, JSON.stringify(dataToStore));
    if (customDomain) {
      const domainKey = `domain:${customDomain}`;
      await env.ACCESSIBILITY_AUTH.put(domainKey, JSON.stringify({
        siteId,
        customDomain,
        connectedAt: (/* @__PURE__ */ new Date()).toISOString()
      }), { expirationTtl: 86400 });
    }
    console.log(`[PUBLISH] ${requestId} Settings published successfully`);
    return new Response(JSON.stringify({
      success: true,
      message: "Accessibility settings published successfully",
      data: {
        customization: siteInfo.customization,
        accessibilityProfiles: siteInfo.accessibilityProfiles,
        customDomain: siteInfo.customDomain,
        publishedAt: siteInfo.publishedAt
      },
      requestId
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
      }
    });
  } catch (error) {
    console.error(`[PUBLISH] ${requestId} Error in publish handler:`, error);
    return new Response(JSON.stringify({
      error: "Failed to publish accessibility settings",
      details: String(error),
      requestId
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
      }
    });
  }
}
__name(handlePublishSettings, "handlePublishSettings");
async function handleGetSettings(request, env) {
  const authResult = await verifyAuth(request, env);
  if (!authResult) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
      }
    });
  }
  const { siteId } = authResult;
  const publishedData = await env.ACCESSIBILITY_AUTH.get(`Accessibility-Settings:${siteId}`);
  if (!publishedData) {
    return new Response(JSON.stringify({ error: "Site not found" }), {
      status: 404,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
      }
    });
  }
  const published = JSON.parse(publishedData);
  return new Response(JSON.stringify({
    settings: published.accessibilitySettings,
    customization: published.customization,
    accessibilityProfiles: published.accessibilityProfiles,
    customDomain: published.customDomain,
    siteId,
    siteName: published.siteName,
    installedAt: published.installedAt,
    lastUsed: published.lastUsed,
    widgetVersion: published.widgetVersion,
    publishedAt: published.publishedAt
  }), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
}
__name(handleGetSettings, "handleGetSettings");
async function handleTokenAuth(request, env) {
  try {
    console.log("=== TOKEN AUTH DEBUG START ===");
    console.log("Request method:", request.method);
    console.log("Request URL:", request.url);
    console.log("Request headers:", Object.fromEntries(request.headers.entries()));
    const { siteId, idToken } = await request.json();
    console.log("Parsed request body:", { siteId: !!siteId, idToken: !!idToken });
    if (!siteId || !idToken) {
      console.error("Missing required parameters");
      return new Response(JSON.stringify({ error: "Missing siteId or idToken" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization"
        }
      });
    }
    console.log("Looking up published settings for siteId:", siteId);
    const publishedData = await env.ACCESSIBILITY_AUTH.get(`Accessibility-Settings:${siteId}`);
    if (!publishedData) {
      console.error("Published settings not found in KV store");
      return new Response(JSON.stringify({ error: "Site not found or not authorized" }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization"
        }
      });
    }
    const { accessToken } = JSON.parse(publishedData);
    console.log("Found access token for site");
    console.log("Verifying user with Webflow...");
    const resolveResponse = await fetch("https://api.webflow.com/v2/token/resolve", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
        "accept-version": "2.0.0"
      },
      body: JSON.stringify({ idToken })
    });
    console.log("Webflow resolve response status:", resolveResponse.status);
    if (!resolveResponse.ok) {
      const errorText = await resolveResponse.text();
      console.error("Token resolve failed:", resolveResponse.status, errorText);
      return new Response(JSON.stringify({ error: "Failed to verify user" }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization"
        }
      });
    }
    const userData = await resolveResponse.json();
    console.log("Resolved user data:", JSON.stringify(userData, null, 2));
    if (!userData.id || !userData.email) {
      console.error("Invalid user data received");
      return new Response(JSON.stringify({ error: "Invalid user data received" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization"
        }
      });
    }
    console.log("Creating session token...");
    const sessionToken = await createSessionToken(userData, env);
    console.log("Session token created successfully");
    await env.ACCESSIBILITY_AUTH.put(`user-auth:${userData.id}`, JSON.stringify({
      accessToken,
      userData: {
        id: userData.id,
        email: userData.email,
        firstName: userData.firstName
      },
      siteId,
      widgetType: "accessibility"
    }), { expirationTtl: 86400 });
    console.log("User authentication stored");
    console.log("=== TOKEN AUTH DEBUG END ===");
    return new Response(JSON.stringify({
      sessionToken: sessionToken.token,
      email: userData.email,
      firstName: userData.firstName,
      exp: sessionToken.exp,
      widgetType: "accessibility"
    }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
      }
    });
  } catch (error) {
    console.error("Token auth error:", error);
    return new Response(JSON.stringify({
      error: "Authentication failed",
      details: error.message
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
      }
    });
  }
}
__name(handleTokenAuth, "handleTokenAuth");
async function handleUpdateSettings(request, env) {
  const authResult = await verifyAuth(request, env);
  if (!authResult) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, PUT, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
      }
    });
  }
  const { siteId } = authResult;
  const newSettings = await request.json();
  const publishedData = await env.ACCESSIBILITY_AUTH.get(`Accessibility-Settings:${siteId}`);
  if (!publishedData) {
    return new Response(JSON.stringify({ error: "Site not found" }), {
      status: 404,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, PUT, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
      }
    });
  }
  const siteInfo = JSON.parse(publishedData);
  siteInfo.accessibilitySettings = { ...siteInfo.accessibilitySettings, ...newSettings };
  siteInfo.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
  siteInfo.lastUsed = (/* @__PURE__ */ new Date()).toISOString();
  await env.ACCESSIBILITY_AUTH.put(`Accessibility-Settings:${siteId}`, JSON.stringify(siteInfo));
  return new Response(JSON.stringify({
    success: true,
    settings: siteInfo.accessibilitySettings,
    lastUpdated: siteInfo.lastUpdated
  }), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
}
__name(handleUpdateSettings, "handleUpdateSettings");
async function handleVerifyAuth(request, env) {
  const authResult = await verifyAuth(request, env);
  return new Response(JSON.stringify({
    authenticated: !!authResult,
    user: authResult?.userData || null
  }), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
}
__name(handleVerifyAuth, "handleVerifyAuth");
async function verifyAuth(request, env) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;
  const token = authHeader.split(" ")[1];
  if (!token) return null;
  try {
    const payload = await verifyJWT(token, env.WEBFLOW_CLIENT_SECRET);
    const userId = payload.user.id;
    const userData = await env.ACCESSIBILITY_AUTH.get(`user-auth:${userId}`);
    if (!userData) return null;
    const { accessToken, userData: user, siteId } = JSON.parse(userData);
    return {
      accessToken,
      userData: user,
      siteId
    };
  } catch (error) {
    console.error("Auth verification error:", error);
    return null;
  }
}
__name(verifyAuth, "verifyAuth");
async function createSessionToken(user, env) {
  const header = {
    alg: "HS256",
    typ: "JWT"
  };
  const payload = {
    user,
    exp: Math.floor(Date.now() / 1e3) + 24 * 60 * 60
    // 24 hours
  };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = await signJWT(
    `${encodedHeader}.${encodedPayload}`,
    env.WEBFLOW_CLIENT_SECRET
  );
  return {
    token: `${encodedHeader}.${encodedPayload}.${signature}`,
    exp: payload.exp
  };
}
__name(createSessionToken, "createSessionToken");
async function verifyJWT(token, secret) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");
  const [header, payload, signature] = parts;
  const expectedSignature = await signJWT(`${header}.${payload}`, secret);
  if (signature !== expectedSignature) {
    throw new Error("Invalid signature");
  }
  const decodedPayload = JSON.parse(base64UrlDecode(payload));
  if (decodedPayload.exp < Math.floor(Date.now() / 1e3)) {
    throw new Error("Token expired");
  }
  return decodedPayload;
}
__name(verifyJWT, "verifyJWT");
async function signJWT(data, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return base64UrlEncode(new Uint8Array(signature));
}
__name(signJWT, "signJWT");
function base64UrlEncode(str) {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
__name(base64UrlEncode, "base64UrlEncode");
function base64UrlDecode(str) {
  str += "=".repeat((4 - str.length % 4) % 4);
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  return atob(str);
}
__name(base64UrlDecode, "base64UrlDecode");
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map
