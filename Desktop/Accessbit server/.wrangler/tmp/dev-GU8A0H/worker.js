var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-9N25hX/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// worker.js
var securityHeaders = {
  "Content-Security-Policy": "default-src 'self' https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://*.stripe.com https://cdn.prod.website-files.com; script-src-elem 'self' 'unsafe-inline' https://js.stripe.com https://*.stripe.com https://cdn.prod.website-files.com; script-src-attr 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.prod.website-files.com; style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.prod.website-files.com; img-src 'self' data: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://api.stripe.com https://*.stripe.com https://accessibility-widget.web-8fb.workers.dev https://d3e54v103j8qbb.cloudfront.net; frame-src 'self' https://js.stripe.com; base-uri 'self'; form-action 'self'; frame-ancestors 'self' https://*.webflow.com; object-src 'none'; upgrade-insecure-requests;",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Cross-Origin-Resource-Policy": "same-origin",
  "X-DNS-Prefetch-Control": "on",
  "X-Download-Options": "noopen",
  "X-Permitted-Cross-Domain-Policies": "none",
  "Permissions-Policy": "payment=*"
};
var rateLimitStore = /* @__PURE__ */ new Map();
async function handleWebflowAppInstallation(request, env) {
  const origin = request.headers.get("origin");
  try {
    const { siteId, userId, userEmail, siteName, installationData } = await request.json();
    console.log("Webflow app installation detected:", { siteId, userId, userEmail, siteName });
    try {
      const webhookUrl = env.MAKE_WEBHOOK_URL || "https://hook.us1.make.com/mjcnn3ydks2o2pbkrdna9czn7bb253z0";
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "webflow_app_installed",
          customer: {
            email: userEmail,
            firstName: installationData?.firstName || "User",
            siteId,
            siteName,
            userId
          },
          installation: {
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            data: installationData || {}
          }
        })
      });
      console.log("Webflow installation webhook sent to Make.com successfully");
    } catch (webhookError) {
      console.warn("Webflow webhook failed (non-critical):", webhookError);
    }
    const installationRecord = {
      siteId,
      userId,
      userEmail,
      siteName,
      installedAt: (/* @__PURE__ */ new Date()).toISOString(),
      status: "installed"
    };
    await env.ACCESSIBILITY_AUTH.put(`installation_${siteId}`, JSON.stringify(installationRecord));
    const now = /* @__PURE__ */ new Date();
    const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1e3);
    const userData = {
      siteId,
      email: userEmail || "",
      domain: "",
      paymentStatus: "trial",
      trialStartDate: now.toISOString(),
      trialEndDate: trialEnd.toISOString(),
      createdAt: now.toISOString()
    };
    await env.ACCESSIBILITY_AUTH.put(`user_data_${siteId}`, JSON.stringify(userData));
    await mergeSiteSettings(env, siteId, {
      siteId,
      email: userEmail || "",
      siteName: siteName || "",
      paymentStatus: "trial",
      trialStartDate: now.toISOString(),
      trialEndDate: trialEnd.toISOString()
    });
    const successResponse = secureJsonResponse({
      success: true,
      message: "App installation recorded successfully"
    });
    return addSecurityAndCorsHeaders(successResponse, origin);
  } catch (error) {
    console.error("Webflow app installation error:", error);
    const errorResponse = secureJsonResponse({
      error: "Failed to process app installation",
      details: error.message
    }, 500);
    return addSecurityAndCorsHeaders(errorResponse, origin);
  }
}
__name(handleWebflowAppInstallation, "handleWebflowAppInstallation");
function secureJsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}
__name(secureJsonResponse, "secureJsonResponse");
function sanitizeInput(input) {
  return input.replace(/[<>\"'&]/g, (match) => {
    const escapeMap = {
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#x27;",
      "&": "&amp;"
    };
    return escapeMap[match];
  });
}
__name(sanitizeInput, "sanitizeInput");
function rateLimitCheck(ip, requests) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1e3;
  const maxRequests = 100;
  const userRequests = requests.get(ip);
  if (!userRequests || now > userRequests.resetTime) {
    requests.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }
  if (userRequests.count >= maxRequests) {
    return false;
  }
  userRequests.count++;
  return true;
}
__name(rateLimitCheck, "rateLimitCheck");
async function getSiteSettings(env, siteId) {
  const existing = await env.ACCESSIBILITY_AUTH.get(`accessibility-settings:${siteId}`);
  if (!existing) {
    return {
      siteId,
      customization: {},
      accessibilityProfiles: {},
      email: "",
      domain: "",
      paymentStatus: "unknown",
      trialStartDate: null,
      trialEndDate: null,
      customerId: "",
      subscriptionId: "",
      lastPaymentDate: null,
      lastUpdated: (/* @__PURE__ */ new Date()).toISOString(),
      lastUsed: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  try {
    return JSON.parse(existing);
  } catch {
    return { siteId, customization: {} };
  }
}
__name(getSiteSettings, "getSiteSettings");
async function mergeSiteSettings(env, siteId, patch) {
  const current = await getSiteSettings(env, siteId);
  const updated = { ...current, ...patch, lastUpdated: (/* @__PURE__ */ new Date()).toISOString(), lastUsed: (/* @__PURE__ */ new Date()).toISOString() };
  await env.ACCESSIBILITY_AUTH.put(`accessibility-settings:${siteId}`, JSON.stringify(updated));
  return updated;
}
__name(mergeSiteSettings, "mergeSiteSettings");
function addSecurityAndCorsHeaders(response, origin) {
  const headers = new Headers(response.headers);
  Object.entries(securityHeaders).forEach(([key, value]) => {
    headers.set(key, value);
  });
  headers.set("Access-Control-Allow-Origin", origin || "*");
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin, X-CSRF-Token");
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set("Access-Control-Max-Age", "86400");
  headers.set("Vary", "Origin");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
__name(addSecurityAndCorsHeaders, "addSecurityAndCorsHeaders");
var worker_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get("origin");
    const clientIP = request.headers.get("x-forwarded-for") || "unknown";
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
    if (url.pathname === "/api/auth/verify") {
      return handleVerifyAuth(request, env);
    }
    if (url.pathname === "/api/accessibility/publish" && request.method === "POST") {
      return handlePublishSettings(request, env);
    }
    if (url.pathname === "/api/accessibility/register-script") {
      return handleRegisterScript(request, env);
    }
    if (url.pathname === "/api/accessibility/apply-script") {
      return handleApplyScript(request, env);
    }
    if (url.pathname === "/api/accessibility/get-token" && request.method === "GET") {
      return handleGetTokenBySiteId(request, env);
    }
    const isPaymentEndpoint = url.pathname.includes("/setup-payment") || url.pathname.includes("/verify-payment-method") || url.pathname.includes("/create-subscription") || url.pathname.includes("/cancel-subscription") || url.pathname.includes("/subscription-status") || url.pathname.includes("/update-subscription") || url.pathname.includes("/create-payment-intent") || url.pathname.includes("/check-subscription-status") || url.pathname.includes("/activate-subscription") || url.pathname.includes("/reactivate-subscription") || url.pathname.includes("/check-payment-status") || url.pathname.includes("/domain-lookup") || url.pathname.includes("/validate-domain");
    if (!isPaymentEndpoint && !rateLimitCheck(clientIP, rateLimitStore)) {
      const errorResponse = secureJsonResponse(
        { error: "Rate limit exceeded" },
        429
      );
      return addSecurityAndCorsHeaders(errorResponse, origin);
    }
    if (url.pathname === "/api/accessibility/settings" && request.method === "GET") {
      return handleGetSettings(request, env);
    }
    if (url.pathname === "/api/accessibility/settings" && (request.method === "POST" || request.method === "PUT")) {
      return handleUpdateSettings(request, env);
    }
    if (url.pathname === "/api/accessibility/config" && request.method === "GET") {
      return handleGetConfig(request, env);
    }
    if (url.pathname === "/api/accessibility/domain-lookup" && request.method === "GET") {
      return handleDomainLookup(request, env);
    }
    if (url.pathname === "/api/accessibility/save-settings" && request.method === "POST") {
      return handleSaveSettings(request, env);
    }
    if (url.pathname === "/api/accessibility/create-trial" && request.method === "POST") {
      return handleCreateTrial(request, env);
    }
    if (url.pathname === "/api/accessibility/payment-status" && request.method === "GET") {
      return handlePaymentStatus(request, env);
    }
    if (url.pathname === "/api/accessibility/validate-domain" && request.method === "POST") {
      return handleValidateDomain(request, env);
    }
    if (url.pathname === "/api/accessibility/user-data" && request.method === "GET") {
      return handleUserData(request, env);
    }
    if (url.pathname === "/api/accessibility/update-payment" && request.method === "POST") {
      return handleUpdatePayment(request, env);
    }
    if (url.pathname === "/api/accessibility/create-setup-intent" && request.method === "POST") {
      return handleCreateSetupIntent(request, env);
    }
    if (url.pathname === "/api/accessibility/create-subscription" && request.method === "POST") {
      return handleCreateSubscription(request, env);
    }
    if (url.pathname === "/api/accessibility/cancel-subscription" && request.method === "POST") {
      return handleCancelSubscription(request, env);
    }
    if (url.pathname === "/api/accessibility/subscription-status" && request.method === "POST") {
      return handleGetSubscriptionStatus(request, env);
    }
    if (url.pathname === "/api/accessibility/update-subscription-metadata" && request.method === "POST") {
      return handleUpdateSubscriptionMetadata(request, env);
    }
    if (url.pathname === "/api/accessibility/remove-widget" && request.method === "POST") {
      return handleRemoveWidget(request, env);
    }
    if (url.pathname === "/api/accessibility/install-widget" && request.method === "POST") {
      return handleInstallWidget(request, env);
    }
    if (url.pathname === "/api/accessibility/create-payment-intent" && request.method === "POST") {
      return handleCreatePaymentIntent(request, env);
    }
    if (url.pathname === "/api/stripe/webhook" && request.method === "POST") {
      return handleStripeWebhook(request, env);
    }
    if (url.pathname === "/api/webflow/app-installed" && request.method === "POST") {
      return handleWebflowAppInstallation(request, env);
    }
    if (url.pathname === "/api/accessibility/activate-subscription" && request.method === "POST") {
      console.log("Manual activation endpoint called");
      return handleActivateSubscription(request, env);
    }
    if (url.pathname === "/api/accessibility/check-subscription-status" && request.method === "GET") {
      return handleCheckSubscriptionStatus(request, env);
    }
    if (url.pathname === "/api/accessibility/get-subscription-plan" && request.method === "GET") {
      return handleGetSubscriptionPlan(request, env);
    }
    console.log("Unmatched route:", url.pathname, request.method);
    if (url.pathname === "/api/test" && request.method === "GET") {
      return new Response(JSON.stringify({ message: "Worker is working", timestamp: (/* @__PURE__ */ new Date()).toISOString() }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    if (url.pathname === "/api/accessibility/check-payment-status" && request.method === "GET") {
      return handleCheckPaymentStatus(request, env);
    }
    if (url.pathname === "/api/accessibility/fix-domain-mapping" && request.method === "POST") {
      return handleFixDomainMapping(request, env);
    }
    if (url.pathname === "/api/accessibility/debug-payment" && request.method === "GET") {
      return handleDebugPayment(request, env);
    }
    if (url.pathname === "/api/accessibility/reactivate-subscription" && request.method === "POST") {
      return handleReactivateSubscription(request, env);
    }
    if (url.pathname === "/widget.js" && request.method === "GET") {
      return handleWidgetScript(request, env);
    }
    if (url.pathname === "/api/accessibility/setup-payment" && request.method === "POST") {
      return handleSetupPayment(request, env);
    }
    if (url.pathname === "/api/accessibility/verify-payment-method" && request.method === "POST") {
      return handleVerifyPaymentMethod(request, env);
    }
    if (url.pathname === "/api/accessibility/save-custom-domain" && request.method === "POST") {
      try {
        const { siteId, customDomain, customization } = await request.json();
        if (!siteId || !customDomain) {
          return new Response(JSON.stringify({ error: "Missing siteId or customDomain" }), {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "POST, OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type"
            }
          });
        }
        const existingData = await env.ACCESSIBILITY_AUTH.get(`custom-domain-data:${siteId}`);
        let existingDomainData = {};
        if (existingData) {
          try {
            existingDomainData = JSON.parse(existingData);
          } catch (error) {
            console.warn("Failed to parse existing custom domain data:", error);
          }
        }
        const updatedDomainData = {
          ...existingDomainData,
          siteId,
          customDomain,
          customization: customization || existingDomainData.customization || {},
          lastUpdated: (/* @__PURE__ */ new Date()).toISOString(),
          lastUsed: (/* @__PURE__ */ new Date()).toISOString()
        };
        await env.ACCESSIBILITY_AUTH.put(`custom-domain-data:${siteId}`, JSON.stringify(updatedDomainData));
        const customDomainMirrorKey = `custom-domain:${customDomain}`;
        await env.ACCESSIBILITY_AUTH.put(customDomainMirrorKey, JSON.stringify({
          siteId,
          customDomain,
          customization: updatedDomainData.customization,
          lastUpdated: (/* @__PURE__ */ new Date()).toISOString(),
          lastUsed: (/* @__PURE__ */ new Date()).toISOString()
        }));
        const domainKey = `domain:${customDomain}`;
        await env.ACCESSIBILITY_AUTH.put(domainKey, JSON.stringify({
          siteId,
          customDomain,
          connectedAt: (/* @__PURE__ */ new Date()).toISOString()
        }), { expirationTtl: 86400 * 30 });
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
          }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: "Failed to save custom domain data" }), {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
          }
        });
      }
    }
    if (url.pathname === "/api/accessibility/auth-data" && request.method === "GET") {
      try {
        const url2 = new URL(request.url);
        const siteId = url2.searchParams.get("siteId");
        if (!siteId) {
          return new Response(JSON.stringify({ error: "Missing siteId parameter" }), {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "GET, OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type"
            }
          });
        }
        const authData = await env.ACCESSIBILITY_AUTH.get(`auth-data:${siteId}`);
        if (!authData) {
          return new Response(JSON.stringify({ error: "Authorization data not found" }), {
            status: 404,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "GET, OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type"
            }
          });
        }
        const parsedData = JSON.parse(authData);
        const authResponse = {
          accessToken: parsedData.accessToken,
          siteId: parsedData.siteId,
          siteName: parsedData.siteName,
          user: parsedData.user,
          installedAt: parsedData.installedAt,
          widgetVersion: parsedData.widgetVersion
        };
        return new Response(JSON.stringify(authResponse), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
          }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: "Failed to get authorization data" }), {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
          }
        });
      }
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
  const corsResponse = new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400"
    }
  });
  return addSecurityAndCorsHeaders(corsResponse, "*");
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
    const referrer = request.headers.get("referer") || "";
    let siteInfo = "";
    if (referrer.includes(".design.webflow.com")) {
      const match = referrer.match(/([^.]+)\.design\.webflow\.com/);
      if (match) {
        siteInfo = `_${match[1]}`;
        console.log("Apps & Integrations: Including site info in state:", siteInfo);
      }
    }
    authUrl.searchParams.set("state", `accessibility_widget${siteInfo}`);
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
    const isAppsIntegrations = state && state.startsWith("accessibility_widget");
    const redirectUri = "https://accessibility-widget.web-8fb.workers.dev/api/auth/callback";
    let appsIntegrationsSiteInfo = null;
    if (isAppsIntegrations && state.includes("_")) {
      const parts = state.split("_");
      if (parts.length >= 3) {
        appsIntegrationsSiteInfo = parts.slice(2).join("_");
        console.log("Apps & Integrations: Extracted site info from state:", appsIntegrationsSiteInfo);
      }
    }
    console.log("=== OAUTH CALLBACK DEBUG ===");
    console.log("Request URL:", request.url);
    console.log("Code received:", code);
    console.log("State:", state);
    console.log("Using redirect URI:", redirectUri);
    console.log("Client ID:", env.WEBFLOW_CLIENT_ID);
    console.log("Flow type:", isDesigner ? "App Interface" : "Apps & Integrations");
    const urlSiteId = url.searchParams.get("siteId");
    console.log("SiteId from URL:", urlSiteId);
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
    console.log(tokenData);
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
    let currentSite;
    if (isDesigner) {
      const siteIdFromState = state.includes("_") ? state.split("_")[1] : null;
      if (siteIdFromState) {
        currentSite = sites.find((site) => site.id === siteIdFromState) || sites[0];
      } else {
        currentSite = sites[0];
      }
    } else {
      if (urlSiteId) {
        const foundSite = sites.find((site) => site.id === urlSiteId);
        if (foundSite) {
          currentSite = foundSite;
          console.log("Apps & Integrations: Using site from URL parameter:", currentSite.id, currentSite.shortName);
        } else {
          console.log("Apps & Integrations: Site not found for URL siteId:", urlSiteId);
          currentSite = sites[0];
        }
      } else if (appsIntegrationsSiteInfo) {
        const foundSite = sites.find((site) => site.shortName === appsIntegrationsSiteInfo);
        currentSite = foundSite || sites[0];
      } else {
        const referrer = request.headers.get("referer") || "";
        if (referrer.includes(".design.webflow.com")) {
          const match = referrer.match(/([^.]+)\.design\.webflow\.com/);
          if (match) {
            const shortName = match[1];
            const foundSite = sites.find((site) => site.shortName === shortName);
            currentSite = foundSite || sites[0];
          } else {
            currentSite = sites[0];
          }
        } else {
          currentSite = sites[0];
        }
      }
    }
    const userId = userData.id || userData.email;
    const sessionToken = await createSessionToken({ ...userData, id: userId }, env, currentSite.id);
    if (isDesigner) {
      await env.ACCESSIBILITY_AUTH.put(`auth-data:${currentSite.id}`, JSON.stringify({
        accessToken: tokenData.access_token,
        siteName: currentSite.name || currentSite.shortName,
        siteId: currentSite.id,
        user: userData,
        email: userData.email || "",
        domainUrl: "",
        workspaceId: userData.workspaceId || "",
        installedAt: (/* @__PURE__ */ new Date()).toISOString(),
        widgetVersion: "1.0.0",
        lastUsed: (/* @__PURE__ */ new Date()).toISOString()
      }));
      await env.ACCESSIBILITY_AUTH.put(`accessibility-settings:${currentSite.id}`, JSON.stringify({
        siteId: currentSite.id,
        customization: {},
        accessibilityProfiles: {},
        customDomain: null,
        lastUpdated: (/* @__PURE__ */ new Date()).toISOString(),
        lastUsed: (/* @__PURE__ */ new Date()).toISOString()
      }));
      return new Response(null, {
        status: 302,
        headers: {
          "Location": `https://${currentSite.shortName}.design.webflow.com?app=${env.WEBFLOW_CLIENT_ID}`
        }
      });
    }
    console.log("Apps & Integrations: Using determined site for data storage...");
    console.log("Apps & Integrations: Storing data for site:", currentSite.id, currentSite.name || currentSite.shortName);
    await env.ACCESSIBILITY_AUTH.put(`auth-data:${currentSite.id}`, JSON.stringify({
      accessToken: tokenData.access_token,
      siteName: currentSite.name || currentSite.shortName,
      siteId: currentSite.id,
      user: userData,
      email: userData.email || "",
      domainUrl: "",
      workspaceId: userData.workspaceId || "",
      installedAt: (/* @__PURE__ */ new Date()).toISOString(),
      widgetVersion: "1.0.0",
      lastUsed: (/* @__PURE__ */ new Date()).toISOString()
    }));
    await mergeSiteSettings(env, currentSite.id, { siteId: currentSite.id });
    await mergeSiteSettings(env, currentSite.id, { siteId: currentSite.id });
    try {
      if (currentSite.shortName) {
        const webflowSubdomain = `${currentSite.shortName}.webflow.io`;
        const domainKey = `domain:${webflowSubdomain}`;
        await env.ACCESSIBILITY_AUTH.put(domainKey, JSON.stringify({
          siteId: currentSite.id,
          domain: webflowSubdomain,
          isPrimary: true,
          isWebflowSubdomain: true,
          connectedAt: (/* @__PURE__ */ new Date()).toISOString()
        }), { expirationTtl: 86400 * 30 });
        console.log("Apps & Integrations: Stored Webflow subdomain mapping:", webflowSubdomain, "->", currentSite.id);
      }
    } catch (domainError) {
      console.warn("Apps & Integrations: Failed to store subdomain mapping:", domainError);
    }
    const storedAuthData = await env.ACCESSIBILITY_AUTH.get(`auth-data:${currentSite.id}`);
    let realEmail = userData.email || "";
    if (storedAuthData) {
      try {
        const parsed = JSON.parse(storedAuthData);
        realEmail = parsed.email || userData.email || "";
      } catch (e) {
        console.warn("Failed to parse stored auth data:", e);
      }
    }
    return new Response(null, {
      status: 302,
      headers: {
        "Location": `https://${currentSite.shortName}.design.webflow.com`
      }
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
    const url = new URL(request.url);
    const urlSiteId = url.searchParams.get("siteId");
    const siteId = urlSiteId || authResult.siteId;
    console.log(`[PUBLISH] ${requestId} Using siteId: ${siteId} (from ${urlSiteId ? "URL parameter" : "auth result"})`);
    if (!siteId) {
      console.log(`[PUBLISH] ${requestId} No siteId available`);
      return new Response(JSON.stringify({
        error: "No siteId provided",
        requestId
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization"
        }
      });
    }
    const body = await request.json();
    console.log(`[PUBLISH] ${requestId} Received body:`, body);
    console.log(`[PUBLISH] ${requestId} Body keys:`, Object.keys(body));
    console.log(`[PUBLISH] ${requestId} Customization keys:`, body.customization ? Object.keys(body.customization) : "No customization");
    const {
      customization,
      accessibilityProfiles,
      customDomain,
      publishedAt,
      interfaceLanguage
    } = body;
    console.log(`[PUBLISH] ${requestId} Auth result:`, JSON.stringify(authResult, null, 2));
    console.log(`[PUBLISH] ${requestId} User data from auth:`, authResult.userData);
    console.log(`[PUBLISH] ${requestId} Site name from auth:`, authResult.siteName);
    const existingSettingsData = await env.ACCESSIBILITY_AUTH.get(`accessibility-settings:${siteId}`);
    let existingSettings = {};
    if (existingSettingsData) {
      try {
        existingSettings = JSON.parse(existingSettingsData);
        console.log(`[PUBLISH] ${requestId} Found existing accessibility settings`);
      } catch (error) {
        console.warn(`[PUBLISH] ${requestId} Failed to parse existing accessibility settings:`, error);
      }
    }
    const authData = await env.ACCESSIBILITY_AUTH.get(`auth-data:${siteId}`);
    let authInfo = {};
    if (authData) {
      try {
        authInfo = JSON.parse(authData);
        console.log(`[PUBLISH] ${requestId} Found authorization data`);
      } catch (error) {
        console.warn(`[PUBLISH] ${requestId} Failed to parse authorization data:`, error);
      }
    }
    let accessToken = authInfo.accessToken;
    console.log(`[PUBLISH] ${requestId} Access token status:`, !!accessToken);
    const accessibilityData = {
      siteId,
      customization: {
        ...existingSettings.customization,
        // Preserve existing customization
        ...customization,
        // Override with new customization
        interfaceLanguage: interfaceLanguage || customization?.interfaceLanguage || existingSettings.customization?.interfaceLanguage
      },
      accessibilityProfiles: accessibilityProfiles || existingSettings.accessibilityProfiles,
      customDomain: customDomain || existingSettings.customDomain,
      publishedAt,
      lastUpdated: (/* @__PURE__ */ new Date()).toISOString(),
      lastUsed: (/* @__PURE__ */ new Date()).toISOString()
    };
    const accessibilityKey = `accessibility-settings:${siteId}`;
    console.log(`[PUBLISH] ${requestId} Storing accessibility settings with key: ${accessibilityKey}`);
    console.log(`[PUBLISH] ${requestId} Accessibility data to store:`, JSON.stringify(accessibilityData, null, 2));
    await env.ACCESSIBILITY_AUTH.put(accessibilityKey, JSON.stringify(accessibilityData));
    try {
      const domainsResponse = await fetch(`https://api.webflow.com/v2/sites/${siteId}/domains`, {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "accept-version": "1.0.0"
        }
      });
      if (domainsResponse.ok) {
        const domainsData = await domainsResponse.json();
        console.log(`[PUBLISH] ${requestId} Found domains:`, domainsData);
        for (const domain of domainsData.domains || []) {
          const domainKey = `domain:${domain.name}`;
          await env.ACCESSIBILITY_AUTH.put(domainKey, JSON.stringify({
            siteId,
            domain: domain.name,
            isPrimary: domain.isPrimary,
            connectedAt: (/* @__PURE__ */ new Date()).toISOString()
          }), { expirationTtl: 86400 * 30 });
          console.log(`[PUBLISH] ${requestId} Stored domain mapping: ${domain.name} -> ${siteId}`);
        }
      }
    } catch (domainError) {
      console.warn(`[PUBLISH] ${requestId} Failed to get domains:`, domainError);
    }
    try {
      const siteResponse = await fetch(`https://api.webflow.com/v2/sites/${siteId}`, {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "accept-version": "2.0.0"
        }
      });
      if (siteResponse.ok) {
        const siteData = await siteResponse.json();
        console.log(`[PUBLISH] ${requestId} Site data:`, siteData);
        if (siteData.shortName) {
          const webflowSubdomain = `${siteData.shortName}.webflow.io`;
          const domainKey = `domain:${webflowSubdomain}`;
          await env.ACCESSIBILITY_AUTH.put(domainKey, JSON.stringify({
            siteId,
            domain: webflowSubdomain,
            isPrimary: true,
            // Webflow subdomain is always primary
            isWebflowSubdomain: true,
            connectedAt: (/* @__PURE__ */ new Date()).toISOString()
          }), { expirationTtl: 86400 * 30 });
          console.log(`[PUBLISH] ${requestId} Stored Webflow subdomain mapping: ${webflowSubdomain} -> ${siteId}`);
        }
      }
    } catch (siteError) {
      console.warn(`[PUBLISH] ${requestId} Failed to get site info for subdomain mapping:`, siteError);
    }
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
        customization: accessibilityData.customization,
        accessibilityProfiles: accessibilityData.accessibilityProfiles,
        customDomain: accessibilityData.customDomain,
        publishedAt: accessibilityData.publishedAt
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
  const origin = request.headers.get("origin");
  const authResult = await verifyAuth(request, env);
  if (!authResult) {
    const errorResponse = secureJsonResponse({ error: "Unauthorized" }, 401);
    return addSecurityAndCorsHeaders(errorResponse, origin);
  }
  const url = new URL(request.url);
  const urlSiteId = url.searchParams.get("siteId");
  const siteId = urlSiteId || authResult.siteId;
  if (!siteId) {
    const errorResponse = secureJsonResponse({ error: "No siteId provided" }, 400);
    return addSecurityAndCorsHeaders(errorResponse, origin);
  }
  const accessibilityData = await env.ACCESSIBILITY_AUTH.get(`accessibility-settings:${siteId}`);
  if (!accessibilityData) {
    const errorResponse = secureJsonResponse({ error: "Accessibility settings not found" }, 404);
    return addSecurityAndCorsHeaders(errorResponse, origin);
  }
  const authData = await env.ACCESSIBILITY_AUTH.get(`auth-data:${siteId}`);
  let authInfo = {};
  if (authData) {
    try {
      authInfo = JSON.parse(authData);
    } catch (error) {
      console.warn("Failed to parse authorization data:", error);
    }
  }
  const settings = JSON.parse(accessibilityData);
  const successResponse = secureJsonResponse({
    customization: settings.customization,
    accessibilityProfiles: settings.accessibilityProfiles,
    customDomain: settings.customDomain,
    siteId,
    siteName: authInfo.siteName,
    installedAt: authInfo.installedAt,
    lastUsed: settings.lastUsed,
    widgetVersion: authInfo.widgetVersion,
    publishedAt: settings.publishedAt
  });
  return addSecurityAndCorsHeaders(successResponse, origin);
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
    console.log("Decoding ID token directly for authentication...");
    let userData;
    try {
      const tokenParts = idToken.split(".");
      if (tokenParts.length !== 3) {
        throw new Error("Invalid ID token format");
      }
      const payload = JSON.parse(atob(tokenParts[1]));
      console.log("ID token payload:", payload);
      const storedAuthData2 = await env.ACCESSIBILITY_AUTH.get(`auth-data:${siteId}`);
      let realEmail2 = payload.email || "";
      let realFirstName2 = payload.given_name || payload.name || "User";
      if (storedAuthData2) {
        try {
          const parsed = JSON.parse(storedAuthData2);
          realEmail2 = parsed.email || payload.email || "";
          realFirstName2 = parsed.user?.firstName || payload.given_name || payload.name || "User";
        } catch (e) {
          console.warn("Failed to parse stored auth data:", e);
        }
      }
      userData = {
        id: payload.sub || payload.user_id,
        email: realEmail2,
        firstName: realFirstName2
      };
      console.log("Decoded user data from ID token:", JSON.stringify(userData, null, 2));
      if (!userData.id) {
        console.error("Missing required user ID in ID token:", userData);
        return new Response(JSON.stringify({ error: "Invalid user ID in ID token" }), {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization"
          }
        });
      }
    } catch (error) {
      console.error("ID token verification failed:", error);
      return new Response(JSON.stringify({ error: "Invalid ID token" }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization"
        }
      });
    }
    console.log("Creating session token...");
    const sessionToken = await createSessionToken(userData, env, siteId);
    console.log("Session token created successfully");
    let accessToken = null;
    const existingPublishedData = await env.ACCESSIBILITY_AUTH.get(`accessibility-settings:${siteId}`);
    if (existingPublishedData) {
      const parsedData = JSON.parse(existingPublishedData);
      accessToken = parsedData.accessToken;
      console.log("Found accessToken from existing published settings:", !!accessToken);
    }
    await env.ACCESSIBILITY_AUTH.put(`user-auth:${userData.id}`, JSON.stringify({
      accessToken,
      // Use found accessToken or null
      userData: {
        id: userData.id,
        email: userData.email,
        firstName: userData.firstName
      },
      siteId,
      widgetType: "accessibility",
      authType: "silent_auth"
    }), { expirationTtl: 86400 });
    const authData = await env.ACCESSIBILITY_AUTH.get(`auth-data:${siteId}`);
    if (!authData) {
      console.log("No authorization data found, creating initial auth data...");
      await env.ACCESSIBILITY_AUTH.put(`auth-data:${siteId}`, JSON.stringify({
        accessToken: null,
        // No access token for silent auth
        siteName: "Unknown Site",
        // Will be updated when user publishes
        siteId,
        user: userData,
        installedAt: (/* @__PURE__ */ new Date()).toISOString(),
        widgetVersion: "1.0.0",
        lastUsed: (/* @__PURE__ */ new Date()).toISOString()
      }));
      console.log("Initial authorization data created");
    } else {
      console.log("Authorization data already exists, skipping creation");
    }
    const accessibilityData = await env.ACCESSIBILITY_AUTH.get(`accessibility-settings:${siteId}`);
    if (!accessibilityData) {
      console.log("No accessibility settings found, creating initial settings...");
      await env.ACCESSIBILITY_AUTH.put(`accessibility-settings:${siteId}`, JSON.stringify({
        siteId,
        customization: {},
        accessibilityProfiles: {},
        customDomain: null,
        lastUpdated: (/* @__PURE__ */ new Date()).toISOString(),
        lastUsed: (/* @__PURE__ */ new Date()).toISOString()
      }));
      console.log("Initial accessibility settings created");
    } else {
      console.log("Accessibility settings already exist, skipping creation");
    }
    console.log("User authentication stored");
    console.log("=== TOKEN AUTH DEBUG END ===");
    const storedAuthData = await env.ACCESSIBILITY_AUTH.get(`auth-data:${siteId}`);
    let realEmail = userData.email || "";
    let realFirstName = userData.firstName || "User";
    if (storedAuthData) {
      try {
        const parsed = JSON.parse(storedAuthData);
        realEmail = parsed.email || userData.email || "";
        realFirstName = parsed.user?.firstName || userData.firstName || "User";
      } catch (e) {
        console.warn("Failed to parse stored auth data:", e);
      }
    }
    return new Response(JSON.stringify({
      sessionToken: sessionToken.token,
      email: realEmail,
      firstName: realFirstName,
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
  const origin = request.headers.get("origin");
  const authResult = await verifyAuth(request, env);
  if (!authResult) {
    const errorResponse = secureJsonResponse({ error: "Unauthorized" }, 401);
    return addSecurityAndCorsHeaders(errorResponse, origin);
  }
  const { siteId } = authResult;
  const newSettings = await request.json();
  const sanitizedSettings = {};
  for (const [key, value] of Object.entries(newSettings)) {
    if (typeof value === "string") {
      sanitizedSettings[key] = sanitizeInput(value);
    } else if (typeof value === "object" && value !== null) {
      sanitizedSettings[key] = {};
      for (const [subKey, subValue] of Object.entries(value)) {
        if (typeof subValue === "string") {
          sanitizedSettings[key][subKey] = sanitizeInput(subValue);
        } else {
          sanitizedSettings[key][subKey] = subValue;
        }
      }
    } else {
      sanitizedSettings[key] = value;
    }
  }
  const accessibilityData = await env.ACCESSIBILITY_AUTH.get(`accessibility-settings:${siteId}`);
  if (!accessibilityData) {
    const errorResponse = secureJsonResponse({ error: "Accessibility settings not found" }, 404);
    return addSecurityAndCorsHeaders(errorResponse, origin);
  }
  const settings = JSON.parse(accessibilityData);
  settings.accessibilitySettings = { ...settings.accessibilitySettings, ...sanitizedSettings };
  settings.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
  settings.lastUsed = (/* @__PURE__ */ new Date()).toISOString();
  await env.ACCESSIBILITY_AUTH.put(`accessibility-settings:${siteId}`, JSON.stringify(settings));
  const successResponse = secureJsonResponse({
    success: true,
    settings: settings.accessibilitySettings,
    lastUpdated: settings.lastUpdated
  });
  return addSecurityAndCorsHeaders(successResponse, origin);
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
async function handleRegisterScript(request, env) {
  try {
    console.log("=== REGISTER SCRIPT DEBUG START ===");
    const url = new URL(request.url);
    const siteIdFromUrl = url.searchParams.get("siteId");
    console.log("SiteId from URL:", siteIdFromUrl);
    const authResult = await verifyAuth(request, env);
    if (!authResult) {
      console.log("Authentication failed in register script");
      return new Response(JSON.stringify({ error: "Authentication failed" }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
    console.log("Authentication successful, siteId from auth:", authResult.siteId);
    let accessToken = null;
    const authData = await env.ACCESSIBILITY_AUTH.get(`auth-data:${siteIdFromUrl}`);
    if (authData) {
      const parsedAuthData = JSON.parse(authData);
      accessToken = parsedAuthData.accessToken;
      console.log("Found access token from auth-data:", !!accessToken);
    } else {
      console.log("No auth-data found for siteId:", siteIdFromUrl);
    }
    console.log("Access token status:", !!accessToken);
    if (!accessToken) {
      console.log("No access token available - skipping script registration");
      return new Response(JSON.stringify({
        success: true,
        message: "Script registration skipped - no access token available",
        skipApplyScript: true
      }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
    const scriptUrl = "https://cdn.jsdelivr.net/gh/snm62/accessibility-test@255a604/accessibility-widget.js";
    console.log(accessToken);
    const existingScriptsResponse = await fetch(`https://api.webflow.com/v2/sites/${siteIdFromUrl}/registered_scripts`, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "accept-version": "2.0.0"
      }
    });
    if (existingScriptsResponse.ok) {
      const existingScripts = await existingScriptsResponse.json();
      const existingScript = existingScripts.registeredScripts?.find(
        (script) => script.hostedLocation === scriptUrl
        // Exact match
      );
      if (existingScript) {
        console.log("Script already registered:", existingScript.id);
        return new Response(JSON.stringify({
          success: true,
          message: "Script already registered",
          result: existingScript,
          skipApplyScript: true
          // ADDED: Flag to skip apply script in frontend
        }), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        });
      }
    }
    const scriptResponse = await fetch(scriptUrl);
    const scriptContent = await scriptResponse.text();
    const scriptBuffer = new TextEncoder().encode(scriptContent);
    const hashBuffer = await crypto.subtle.digest("SHA-384", scriptBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashBase64 = btoa(String.fromCharCode.apply(null, hashArray));
    const integrityHash = `sha384-${hashBase64}`;
    console.log("Generated SRI hash:", integrityHash);
    const registerResponse = await fetch(`https://api.webflow.com/v2/sites/${siteIdFromUrl}/registered_scripts/hosted`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "accept-version": "2.0.0"
      },
      body: JSON.stringify({
        displayName: `ContrastKit${Date.now()}`,
        scriptUrl,
        version: "1.0.0",
        hostedLocation: scriptUrl,
        integrityHash,
        canCopy: false,
        isRequired: false
      })
    });
    console.log("Webflow API response status:", registerResponse.status);
    if (!registerResponse.ok) {
      const errorText = await registerResponse.text();
      console.error("Script registration failed:", registerResponse.status, errorText);
      throw new Error(`Script registration failed: ${registerResponse.status} - ${errorText}`);
    }
    const scriptResult = await registerResponse.json();
    console.log("Script registered successfully:", JSON.stringify(scriptResult, null, 2));
    console.log("=== REGISTER SCRIPT DEBUG END ===");
    return new Response(JSON.stringify({
      success: true,
      result: scriptResult
    }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (error) {
    console.error("Register script error:", error);
    console.error("Error details:", error.message, error.stack);
    return new Response(JSON.stringify({
      error: "Failed to register script",
      details: error.message
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}
__name(handleRegisterScript, "handleRegisterScript");
async function handleApplyScript(request, env) {
  try {
    const authResult = await verifyAuth(request, env);
    if (!authResult) {
      return new Response(JSON.stringify({ error: "Authentication failed" }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
    const url = new URL(request.url);
    const urlSiteId = url.searchParams.get("siteId");
    const siteId = urlSiteId || authResult.siteId;
    if (!siteId) {
      return new Response(JSON.stringify({ error: "No siteId provided" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
    const requestBody = await request.json();
    const { targetType, scriptId, location, version } = requestBody;
    console.log("script request body:", requestBody);
    let accessToken = null;
    const authData = await env.ACCESSIBILITY_AUTH.get(`auth-data:${siteId}`);
    if (authData) {
      const parsedAuthData = JSON.parse(authData);
      accessToken = parsedAuthData.accessToken;
    }
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "No access token available" }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
    const existingResponse = await fetch(`https://api.webflow.com/v2/sites/${siteId}/custom_code`, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "accept-version": "2.0.0"
      }
    });
    console.log("existing response status:", existingResponse.status);
    const already_registered_scripts = await fetch(`https://api.webflow.com/v2/sites/${siteId}/registered_scripts`, {
      headers: {
        "Authorization": `Bearer ${accessToken}`
      }
    });
    console.log(already_registered_scripts.registeredScripts, "already registered script");
    let existingScripts = [];
    if (existingResponse.ok) {
      const existingData = await existingResponse.json();
      existingScripts = existingData.scripts || [];
    }
    const scriptUrl = "https://cdn.jsdelivr.net/gh/snm62/accessibility-test@255a604/accessibility-widget.js";
    const existingAccessibilityScript = existingScripts.find(
      (script) => script.scriptUrl === scriptUrl
    );
    console.log(existingAccessibilityScript);
    if (existingAccessibilityScript) {
      console.log("Exact same script already exists, not adding duplicate");
      return new Response(JSON.stringify({
        success: true,
        message: "Script already exists",
        result: existingAccessibilityScript
      }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
    const isAccessibilityScript = /* @__PURE__ */ __name((url2) => {
      return url2 && (url2 === scriptUrl || // exact match
      url2.includes("snm-accessibility-widget") || // any version of this widget
      url2.includes("accessibility-widget"));
    }, "isAccessibilityScript");
    const filteredScripts = existingScripts.filter(
      (script) => !isAccessibilityScript(script.scriptUrl)
    );
    const newScript = {
      id: scriptId,
      version,
      location: "header"
    };
    filteredScripts.push(newScript);
    console.log("Scripts to send to custom_code API:", JSON.stringify(filteredScripts, null, 2));
    const updateResponse = await fetch(`https://api.webflow.com/v2/sites/${siteId}/custom_code`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "accept-version": "2.0.0"
      },
      body: JSON.stringify({
        scripts: filteredScripts
      })
    });
    console.log("update response status:", updateResponse.status);
    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error("Script application failed:", updateResponse.status, errorText);
      throw new Error(`Script application failed: ${updateResponse.status} - ${errorText}`);
    }
    const result = await updateResponse.json();
    return new Response(JSON.stringify({
      success: true,
      result: {
        ...result,
        scriptUrl: newScript.scriptUrl
      }
    }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (error) {
    console.error("Apply script error:", error);
    return new Response(JSON.stringify({ error: "Failed to apply script" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}
__name(handleApplyScript, "handleApplyScript");
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
    let siteName;
    try {
      const siteData = await env.ACCESSIBILITY_AUTH.get(`accessibility-settings:${siteId}`);
      if (siteData) {
        const parsedSiteData = JSON.parse(siteData);
        siteName = parsedSiteData.siteName;
      }
    } catch (error) {
      console.warn("Failed to get site name:", error);
    }
    return {
      accessToken,
      userData: user,
      siteId,
      siteName
    };
  } catch (error) {
    console.error("Auth verification error:", error);
    return null;
  }
}
__name(verifyAuth, "verifyAuth");
async function createSessionToken(user, env, siteId = null) {
  const header = {
    alg: "HS256",
    typ: "JWT"
  };
  const payload = {
    user,
    siteId,
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
async function handleGetConfig(request, env) {
  const origin = request.headers.get("origin");
  try {
    const url = new URL(request.url);
    const siteId = url.searchParams.get("siteId");
    if (!siteId) {
      const errorResponse = secureJsonResponse({
        error: "Missing siteId parameter"
      }, 400);
      return addSecurityAndCorsHeaders(errorResponse, origin);
    }
    const accessibilityKey = `accessibility-settings:${siteId}`;
    const accessibilityData = await env.ACCESSIBILITY_AUTH.get(accessibilityKey);
    if (!accessibilityData) {
      const errorResponse = secureJsonResponse({
        error: "Accessibility settings not found"
      }, 404);
      return addSecurityAndCorsHeaders(errorResponse, origin);
    }
    const authData = await env.ACCESSIBILITY_AUTH.get(`auth-data:${siteId}`);
    let authInfo = {};
    if (authData) {
      try {
        authInfo = JSON.parse(authData);
      } catch (error) {
        console.warn("Failed to parse authorization data:", error);
      }
    }
    const settings = JSON.parse(accessibilityData);
    const config = {
      customization: settings.customization,
      accessibilityProfiles: settings.accessibilityProfiles,
      siteId,
      publishedAt: settings.publishedAt,
      widgetVersion: authInfo.widgetVersion || "1.0.0"
    };
    const successResponse = secureJsonResponse(config);
    const responseWithHeaders = addSecurityAndCorsHeaders(successResponse, origin);
    const headers = new Headers(responseWithHeaders.headers);
    headers.set("Cache-Control", "public, max-age=300");
    return new Response(responseWithHeaders.body, {
      status: responseWithHeaders.status,
      statusText: responseWithHeaders.statusText,
      headers
    });
  } catch (error) {
    console.error("Get config error:", error);
    const errorResponse = secureJsonResponse({
      error: "Failed to get configuration",
      details: error.message
    }, 500);
    return addSecurityAndCorsHeaders(errorResponse, origin);
  }
}
__name(handleGetConfig, "handleGetConfig");
async function handleDomainLookup(request, env) {
  const origin = request.headers.get("origin");
  try {
    const url = new URL(request.url);
    const domain = url.searchParams.get("domain");
    console.log("Domain lookup request for:", domain);
    if (!domain) {
      const errorResponse2 = secureJsonResponse({ error: "Missing domain parameter" }, 400);
      return addSecurityAndCorsHeaders(errorResponse2, origin);
    }
    const sanitizedDomain = sanitizeInput(domain);
    const domainKey = `domain:${sanitizedDomain}`;
    const domainData = await env.ACCESSIBILITY_AUTH.get(domainKey);
    if (domainData) {
      const data = JSON.parse(domainData);
      console.log("Found domain mapping:", data);
      const successResponse = secureJsonResponse({
        siteId: data.siteId,
        domain: data.domain,
        isPrimary: data.isPrimary
      });
      return addSecurityAndCorsHeaders(successResponse, origin);
    }
    console.log("No domain mapping found for:", sanitizedDomain);
    const errorResponse = secureJsonResponse({ error: "Domain not found" }, 404);
    return addSecurityAndCorsHeaders(errorResponse, origin);
  } catch (error) {
    console.error("Domain lookup error:", error);
    const errorResponse = secureJsonResponse({ error: "Lookup failed" }, 500);
    return addSecurityAndCorsHeaders(errorResponse, origin);
  }
}
__name(handleDomainLookup, "handleDomainLookup");
async function handleSaveSettings(request, env) {
  const origin = request.headers.get("origin");
  try {
    const body = await request.json();
    const { siteId, settings } = body;
    if (!siteId || !settings) {
      const errorResponse = secureJsonResponse({ error: "Missing siteId or settings" }, 400);
      return addSecurityAndCorsHeaders(errorResponse, origin);
    }
    const sanitizedSettings = {};
    for (const [key, value] of Object.entries(settings)) {
      if (typeof value === "string") {
        sanitizedSettings[key] = sanitizeInput(value);
      } else if (typeof value === "object" && value !== null) {
        sanitizedSettings[key] = {};
        for (const [subKey, subValue] of Object.entries(value)) {
          if (typeof subValue === "string") {
            sanitizedSettings[key][subKey] = sanitizeInput(subValue);
          } else {
            sanitizedSettings[key][subKey] = subValue;
          }
        }
      } else {
        sanitizedSettings[key] = value;
      }
    }
    const existingData = await env.ACCESSIBILITY_AUTH.get(`accessibility-settings:${siteId}`);
    let existingSettings = {};
    if (existingData) {
      try {
        existingSettings = JSON.parse(existingData);
      } catch (error) {
        console.warn("Failed to parse existing accessibility settings:", error);
      }
    }
    const updatedSettings = {
      ...existingSettings,
      ...sanitizedSettings,
      siteId,
      lastUpdated: (/* @__PURE__ */ new Date()).toISOString(),
      lastUsed: (/* @__PURE__ */ new Date()).toISOString()
    };
    await env.ACCESSIBILITY_AUTH.put(`accessibility-settings:${siteId}`, JSON.stringify(updatedSettings));
    const successResponse = secureJsonResponse({
      success: true,
      message: "Settings saved successfully",
      settings: updatedSettings
    });
    return addSecurityAndCorsHeaders(successResponse, origin);
  } catch (error) {
    console.error("Save settings error:", error);
    const errorResponse = secureJsonResponse({
      error: "Failed to save settings",
      details: error.message
    }, 500);
    return addSecurityAndCorsHeaders(errorResponse, origin);
  }
}
__name(handleSaveSettings, "handleSaveSettings");
async function handleGetTokenBySiteId(request, env) {
  try {
    const url = new URL(request.url);
    const siteId = url.searchParams.get("siteId");
    if (!siteId) {
      return new Response(JSON.stringify({ error: "Missing siteId parameter" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }
    const authData = await env.ACCESSIBILITY_AUTH.get(`auth-data:${siteId}`);
    if (!authData) {
      return new Response(JSON.stringify({ error: "Site not found" }), {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }
    const parsedData = JSON.parse(authData);
    return new Response(JSON.stringify({
      accessToken: parsedData.accessToken,
      siteId: parsedData.siteId,
      siteName: parsedData.siteName,
      user: parsedData.user,
      hasAccessToken: !!parsedData.accessToken
    }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      }
    });
  } catch (error) {
    console.error("Get token by site ID error:", error);
    return new Response(JSON.stringify({ error: "Failed to get token" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      }
    });
  }
}
__name(handleGetTokenBySiteId, "handleGetTokenBySiteId");
async function handleCreateTrial(request, env) {
  const origin = request.headers.get("origin");
  try {
    const { siteId, email, domain, paymentStatus, trialStartDate, trialEndDate } = await request.json();
    if (!siteId || !email || !domain) {
      const errorResponse = secureJsonResponse({ error: "Missing required fields" }, 400);
      return addSecurityAndCorsHeaders(errorResponse, origin);
    }
    const sanitizedEmail = sanitizeInput(email);
    const sanitizedDomain = sanitizeInput(domain);
    const userData = {
      siteId,
      email: sanitizedEmail,
      domain: sanitizedDomain,
      paymentStatus,
      trialStartDate,
      trialEndDate,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await env.ACCESSIBILITY_AUTH.put(`user_data_${siteId}`, JSON.stringify(userData));
    await mergeSiteSettings(env, siteId, {
      siteId,
      domain: sanitizedDomain,
      customerId,
      subscriptionId: subscription.id,
      paymentStatus: "pending"
    });
    await env.ACCESSIBILITY_AUTH.put(`domain_${sanitizedDomain}`, JSON.stringify({
      siteId,
      verified: true
    }));
    await mergeSiteSettings(env, siteId, {
      siteId,
      email: sanitizedEmail,
      domain: sanitizedDomain,
      paymentStatus,
      trialStartDate,
      trialEndDate
    });
    const successResponse = secureJsonResponse({
      success: true,
      message: "Trial created successfully"
    });
    return addSecurityAndCorsHeaders(successResponse, origin);
  } catch (error) {
    console.error("Create trial error:", error);
    const errorResponse = secureJsonResponse({
      error: "Failed to create trial",
      details: error.message
    }, 500);
    return addSecurityAndCorsHeaders(errorResponse, origin);
  }
}
__name(handleCreateTrial, "handleCreateTrial");
async function handlePaymentStatus(request, env) {
  const origin = request.headers.get("origin");
  try {
    const url = new URL(request.url);
    const siteId = url.searchParams.get("siteId");
    if (!siteId) {
      const errorResponse = secureJsonResponse({ error: "SiteId required" }, 400);
      return addSecurityAndCorsHeaders(errorResponse, origin);
    }
    const userDataStr = await env.ACCESSIBILITY_AUTH.get(`user_data_${siteId}`);
    if (!userDataStr) {
      const errorResponse = secureJsonResponse({ error: "User not found" }, 404);
      return addSecurityAndCorsHeaders(errorResponse, origin);
    }
    const userData = JSON.parse(userDataStr);
    const now = /* @__PURE__ */ new Date();
    if (userData.paymentStatus === "trial" && userData.trialEndDate && now > new Date(userData.trialEndDate)) {
      userData.paymentStatus = "inactive";
    }
    if (userData.paymentStatus === "active" && userData.subscriptionPeriodEnd && now > new Date(userData.subscriptionPeriodEnd)) {
      userData.paymentStatus = "expired";
    }
    await env.ACCESSIBILITY_AUTH.put(`user_data_${siteId}`, JSON.stringify(userData));
    await mergeSiteSettings(env, siteId, {
      siteId,
      paymentStatus: userData.paymentStatus,
      trialEndDate: userData.trialEndDate,
      email: userData.email,
      domain: userData.domain
    });
    const successResponse = secureJsonResponse({
      paymentStatus: userData.paymentStatus,
      trialEndDate: userData.trialEndDate,
      email: userData.email,
      domain: userData.domain
    });
    return addSecurityAndCorsHeaders(successResponse, origin);
  } catch (error) {
    console.error("Payment status error:", error);
    const errorResponse = secureJsonResponse({
      error: "Failed to check payment status",
      details: error.message
    }, 500);
    return addSecurityAndCorsHeaders(errorResponse, origin);
  }
}
__name(handlePaymentStatus, "handlePaymentStatus");
async function handleValidateDomain(request, env) {
  const origin = request.headers.get("origin");
  try {
    const { domain, siteId } = await request.json();
    if (!domain || !siteId) {
      const errorResponse = secureJsonResponse({ error: "Domain and siteId required" }, 400);
      return addSecurityAndCorsHeaders(errorResponse, origin);
    }
    const sanitizedDomain = sanitizeInput(domain);
    const domainDataStr = await env.ACCESSIBILITY_AUTH.get(`domain:${sanitizedDomain}`);
    if (!domainDataStr) {
      const successResponse2 = secureJsonResponse({ isValid: false });
      return addSecurityAndCorsHeaders(successResponse2, origin);
    }
    const domainData = JSON.parse(domainDataStr);
    const isValid = domainData.siteId === siteId;
    const successResponse = secureJsonResponse({ isValid });
    return addSecurityAndCorsHeaders(successResponse, origin);
  } catch (error) {
    console.error("Validate domain error:", error);
    const errorResponse = secureJsonResponse({
      isValid: false,
      error: error.message
    }, 500);
    return addSecurityAndCorsHeaders(errorResponse, origin);
  }
}
__name(handleValidateDomain, "handleValidateDomain");
async function handleUserData(request, env) {
  const origin = request.headers.get("origin");
  try {
    const url = new URL(request.url);
    const siteId = url.searchParams.get("siteId");
    if (!siteId) {
      const errorResponse = secureJsonResponse({ error: "SiteId required" }, 400);
      return addSecurityAndCorsHeaders(errorResponse, origin);
    }
    const userDataStr = await env.ACCESSIBILITY_AUTH.get(`user_data_${siteId}`);
    if (!userDataStr) {
      const errorResponse = secureJsonResponse({ error: "User not found" }, 404);
      return addSecurityAndCorsHeaders(errorResponse, origin);
    }
    const userData = JSON.parse(userDataStr);
    const successResponse = secureJsonResponse({
      email: userData.email,
      domain: userData.domain,
      paymentStatus: userData.paymentStatus,
      trialEndDate: userData.trialEndDate
    });
    return addSecurityAndCorsHeaders(successResponse, origin);
  } catch (error) {
    console.error("Get user data error:", error);
    const errorResponse = secureJsonResponse({
      error: "Failed to get user data",
      details: error.message
    }, 500);
    return addSecurityAndCorsHeaders(errorResponse, origin);
  }
}
__name(handleUserData, "handleUserData");
async function handleUpdatePayment(request, env) {
  try {
    const { siteId, paymentStatus, subscriptionId, customerId: customerId2 } = await request.json();
    console.log("Updating payment status:", { siteId, paymentStatus, subscriptionId, customerId: customerId2 });
    if (subscriptionId) {
      const updateResponse = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          "metadata[status]": paymentStatus
        })
      });
      if (!updateResponse.ok) {
        console.error("Failed to update subscription in Stripe");
      }
    }
    const userData = {
      siteId,
      paymentStatus,
      subscriptionId,
      customerId: customerId2,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    await env.CONTRAST_KV.put(`user-data:${siteId}`, JSON.stringify(userData));
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Update payment error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(handleUpdatePayment, "handleUpdatePayment");
async function handleCreateSetupIntent(request, env) {
  const origin = request.headers.get("origin");
  try {
    const { siteId, email, domainUrl } = await request.json();
    console.log("Creating setup intent for:", { siteId, email, domainUrl });
    const sanitizedDomain = domainUrl ? domainUrl.replace(/^https?:\/\//, "").replace(/\/$/, "") : "";
    let customerId2;
    if (email) {
      const customersResponse = await fetch(`https://api.stripe.com/v1/customers?email=${encodeURIComponent(email)}&limit=1`, {
        headers: {
          Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`
        }
      });
      if (customersResponse.ok) {
        const customers = await customersResponse.json();
        if (customers.data.length > 0) {
          customerId2 = customers.data[0].id;
          console.log("Found existing customer:", customerId2);
        }
      }
    }
    if (!customerId2) {
      const customerData = new URLSearchParams();
      customerData.append("email", email || "");
      if (domainUrl || sanitizedDomain) {
        customerData.append("metadata[domain]", domainUrl || sanitizedDomain);
      }
      customerData.append("metadata[siteId]", siteId);
      const customerResponse = await fetch("https://api.stripe.com/v1/customers", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: customerData
      });
      if (!customerResponse.ok) {
        const errorText = await customerResponse.text();
        throw new Error(`Failed to create customer: ${errorText}`);
      }
      const customer = await customerResponse.json();
      customerId2 = customer.id;
      console.log("Created new customer:", customerId2);
    }
    const setupIntentData = new URLSearchParams();
    setupIntentData.append("customer", customerId2);
    setupIntentData.append("payment_method_types[0]", "card");
    setupIntentData.append("usage", "off_session");
    setupIntentData.append("metadata[siteId]", siteId);
    setupIntentData.append("metadata[domain]", domainUrl || sanitizedDomain);
    console.log("Creating setup intent with data:", setupIntentData.toString());
    const setupIntentResponse = await fetch("https://api.stripe.com/v1/setup_intents", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: setupIntentData
    });
    if (!setupIntentResponse.ok) {
      const errorText = await setupIntentResponse.text();
      throw new Error(`Failed to create setup intent: ${errorText}`);
    }
    const setupIntent = await setupIntentResponse.json();
    console.log("Setup intent created successfully:", setupIntent);
    console.log("Setup intent client_secret:", setupIntent.client_secret);
    if (!setupIntent.client_secret) {
      console.error("No client_secret in setup intent response:", setupIntent);
      throw new Error("Setup intent did not return a client secret");
    }
    await env.ACCESSIBILITY_AUTH.put(`setup_intent_${siteId}`, JSON.stringify({
      siteId,
      customerId: customerId2,
      setupIntentId: setupIntent.id,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    }));
    const successResponse = secureJsonResponse({
      success: true,
      clientSecret: setupIntent.client_secret,
      customerId: customerId2,
      setupIntentId: setupIntent.id
    });
    return addSecurityAndCorsHeaders(successResponse, origin);
  } catch (error) {
    console.error("Setup intent creation error:", error);
    const errorResponse = secureJsonResponse({
      error: "Failed to create setup intent",
      details: error.message
    });
    return addSecurityAndCorsHeaders(errorResponse, origin);
  }
}
__name(handleCreateSetupIntent, "handleCreateSetupIntent");
async function handleCreateSubscription(request, env) {
  const origin = request.headers.get("origin");
  try {
    const { siteId, productId, domain, email, domainUrl, firstName, paymentMethodId, customerId: providedCustomerId } = await request.json();
    console.log("Create subscription request data:", { siteId, productId, domain, email, domainUrl, paymentMethodId });
    console.log("Email received:", email);
    console.log("Domain received:", domain);
    console.log("DomainUrl received:", domainUrl);
    console.log("PaymentMethodId received:", paymentMethodId);
    console.log("PaymentMethodId type:", typeof paymentMethodId);
    console.log("PaymentMethodId value:", paymentMethodId);
    if (!siteId || !productId || !domain) {
      const errorResponse = secureJsonResponse({ error: "Missing required fields" }, 400);
      return addSecurityAndCorsHeaders(errorResponse, origin);
    }
    const sanitizedDomain = sanitizeInput(domain);
    let customerId2 = providedCustomerId || "";
    if (!customerId2 && email) {
      console.log("Checking for existing customer with email:", email);
      const existingCustomersResponse = await fetch(`https://api.stripe.com/v1/customers?email=${encodeURIComponent(email)}&limit=1`, {
        headers: {
          Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`
        }
      });
      if (existingCustomersResponse.ok) {
        const existingCustomers = await existingCustomersResponse.json();
        if (existingCustomers.data && existingCustomers.data.length > 0) {
          customerId2 = existingCustomers.data[0].id;
          console.log("Found existing customer:", customerId2);
        }
      }
    }
    if (!customerId2) {
      console.log("Creating new customer...");
      const customerData = new URLSearchParams();
      customerData.append("metadata[siteId]", siteId);
      customerData.append("metadata[domain]", domainUrl || sanitizedDomain);
      customerData.append("metadata[firstName]", firstName || "");
      if (email) {
        customerData.append("email", email);
      }
      const customerResponse = await fetch("https://api.stripe.com/v1/customers", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: customerData
      });
      if (!customerResponse.ok) {
        const errorText = await customerResponse.text();
        throw new Error(`Failed to create customer: ${errorText}`);
      }
      const customer = await customerResponse.json();
      customerId2 = customer.id;
      console.log("Created new customer:", customerId2);
      console.log("Customer default payment method:", customer.invoice_settings?.default_payment_method);
    }
    const productResponse = await fetch(`https://api.stripe.com/v1/products/${productId}`, {
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`
      }
    });
    if (!productResponse.ok) {
      throw new Error("Failed to get product details");
    }
    const product = await productResponse.json();
    const priceId = product.default_price;
    const subscriptionData = new URLSearchParams();
    subscriptionData.append("customer", customerId2);
    subscriptionData.append("items[0][price]", priceId);
    if (paymentMethodId) {
      subscriptionData.append("default_payment_method", paymentMethodId);
      console.log("Creating subscription with payment method:", paymentMethodId);
      subscriptionData.append("payment_behavior", "error_if_incomplete");
    } else {
      console.log("Creating subscription without payment method - will be set via SetupIntent webhook");
      subscriptionData.append("payment_behavior", "default_incomplete");
    }
    subscriptionData.append("collection_method", "charge_automatically");
    subscriptionData.append("payment_settings[save_default_payment_method]", "on_subscription");
    subscriptionData.append("payment_settings[payment_method_types][0]", "card");
    subscriptionData.append("payment_settings[payment_method_options][card][request_three_d_secure]", "automatic");
    subscriptionData.append("expand[]", "latest_invoice.payment_intent");
    subscriptionData.append("metadata[siteId]", siteId);
    subscriptionData.append("metadata[domain]", domainUrl || sanitizedDomain);
    subscriptionData.append("metadata[email]", email || "");
    subscriptionData.append("metadata[firstName]", firstName || "");
    subscriptionData.append("metadata[productId]", productId);
    subscriptionData.append("metadata[createdAt]", (/* @__PURE__ */ new Date()).toISOString());
    console.log("Creating subscription with data:", subscriptionData.toString());
    console.log("Payment method ID being used:", paymentMethodId);
    console.log("Customer ID being used:", customerId2);
    console.log("Subscription metadata:", {
      siteId,
      domain: domainUrl || sanitizedDomain,
      email: email || "",
      domainUrl: domainUrl || "",
      productId
    });
    const subscriptionResponse = await fetch("https://api.stripe.com/v1/subscriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: subscriptionData
    });
    if (!subscriptionResponse.ok) {
      const errorText = await subscriptionResponse.text();
      console.error("Stripe subscription creation failed:", errorText);
      throw new Error(`Failed to create subscription: ${errorText}`);
    }
    const subscription2 = await subscriptionResponse.json();
    console.log("Subscription created successfully:", subscription2);
    console.log("Subscription status:", subscription2.status);
    console.log("Subscription payment method:", subscription2.default_payment_method);
    console.log("Subscription latest invoice:", subscription2.latest_invoice);
    console.log("Subscription items:", subscription2.items?.data?.[0]);
    const userData = {
      siteId,
      domain: sanitizedDomain,
      customerId: customerId2,
      subscriptionId: subscription2.id,
      paymentStatus: subscription2.status,
      firstName: firstName || "",
      currentPeriodStart: subscription2.current_period_start,
      currentPeriodEnd: subscription2.current_period_end,
      cancelAtPeriodEnd: subscription2.cancel_at_period_end || false,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await env.ACCESSIBILITY_AUTH.put(`user_data_${siteId}`, JSON.stringify(userData));
    try {
      const paymentSnapshot = {
        id: subscription2.id,
        siteId,
        type: "subscription_created",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        status: subscription2.status,
        currency: subscription2.currency || null,
        amount: subscription2.items?.data?.[0]?.price?.unit_amount || null,
        customerId: customerId2,
        subscriptionId: subscription2.id,
        invoiceId: subscription2.latest_invoice || null,
        paymentIntentId: subscription2.latest_invoice?.payment_intent || null,
        paymentMethodId: paymentMethodId || null,
        firstName: firstName || "",
        currentPeriodStart: subscription2.current_period_start || null,
        currentPeriodEnd: subscription2.current_period_end || null,
        metadata: subscription2.metadata || {}
      };
      await env.ACCESSIBILITY_AUTH.put(`payment:${siteId}`, JSON.stringify(paymentSnapshot));
    } catch (snapErr) {
      console.warn("Failed to save payment snapshot:", snapErr);
    }
    if (subscription2.status === "incomplete") {
      console.log("Subscription created in incomplete status - will be completed by SetupIntent webhook");
      if (paymentMethodId) {
        console.log("Attempting to activate incomplete subscription with payment method:", paymentMethodId);
        try {
          const activateParams = new URLSearchParams();
          activateParams.append("default_payment_method", paymentMethodId);
          const activateResponse = await fetch(`https://api.stripe.com/v1/subscriptions/${subscription2.id}`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
              "Content-Type": "application/x-www-form-urlencoded"
            },
            body: activateParams
          });
          if (activateResponse.ok) {
            const activatedSubscription = await activateResponse.json();
            console.log("Subscription activated successfully:", activatedSubscription.status);
            userData.paymentStatus = activatedSubscription.status;
            await env.ACCESSIBILITY_AUTH.put(`user_data_${siteId}`, JSON.stringify(userData));
            return addSecurityAndCorsHeaders(secureJsonResponse({
              subscriptionId: subscription2.id,
              status: activatedSubscription.status,
              requiresAction: false
            }), origin);
          } else {
            const errorText = await activateResponse.text();
            console.error("Failed to activate subscription:", errorText);
          }
        } catch (error) {
          console.error("Error activating subscription:", error);
        }
      }
      return addSecurityAndCorsHeaders(secureJsonResponse({
        subscriptionId: subscription2.id,
        status: subscription2.status,
        requiresAction: false,
        // No action needed - webhook will complete it
        message: "Subscription created successfully. Payment will be processed automatically."
      }), origin);
    } else if (subscription2.status === "active") {
      await env.ACCESSIBILITY_AUTH.put(`domain_${sanitizedDomain}`, JSON.stringify({
        siteId,
        verified: true
      }));
      return addSecurityAndCorsHeaders(secureJsonResponse({
        subscriptionId: subscription2.id,
        status: subscription2.status,
        requiresAction: false
      }), origin);
    } else {
      return addSecurityAndCorsHeaders(secureJsonResponse({
        subscriptionId: subscription2.id,
        status: subscription2.status,
        requiresAction: false
      }), origin);
    }
  } catch (error) {
    console.error("Create subscription error:", error);
    const errorResponse = secureJsonResponse({
      error: "Failed to create subscription",
      details: error.message
    }, 500);
    return addSecurityAndCorsHeaders(errorResponse, origin);
  }
}
__name(handleCreateSubscription, "handleCreateSubscription");
async function handleCreatePaymentIntent(request, env) {
  const origin = request.headers.get("origin");
  try {
    const { siteId, amount, currency = "usd", email } = await request.json();
    if (!siteId || !amount) {
      return addSecurityAndCorsHeaders(secureJsonResponse({ error: "Missing required fields" }, 400), origin);
    }
    let customerId2 = "";
    if (email) {
      const custRes = await fetch("https://api.stripe.com/v1/customers", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({ email })
      });
      const cust = await custRes.json();
      customerId2 = cust.id || "";
    }
    const piRes = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        amount: String(amount),
        currency,
        "payment_method_types[]": "card",
        "automatic_payment_methods[enabled]": "false",
        "payment_method_options[card][request_three_d_secure]": "automatic",
        ...customerId2 ? { customer: customerId2 } : {},
        ...siteId ? { "metadata[siteId]": siteId } : {}
      })
    });
    if (!piRes.ok) {
      const text = await piRes.text();
      return addSecurityAndCorsHeaders(secureJsonResponse({ error: `Stripe error: ${text}` }, 400), origin);
    }
    const pi = await piRes.json();
    return addSecurityAndCorsHeaders(secureJsonResponse({ clientSecret: pi.client_secret }), origin);
  } catch (error) {
    return addSecurityAndCorsHeaders(secureJsonResponse({ error: error.message || "failed" }, 500), origin);
  }
}
__name(handleCreatePaymentIntent, "handleCreatePaymentIntent");
async function handleStripeWebhook(request, env) {
  const origin = request.headers.get("origin");
  try {
    const sig = request.headers.get("stripe-signature");
    if (!sig || !env.STRIPE_WEBHOOK_SECRET) {
      return addSecurityAndCorsHeaders(secureJsonResponse({ error: "Missing signature or webhook secret" }, 400), origin);
    }
    const payload = await request.text();
    const parts = Object.fromEntries(sig.split(",").map((kv) => kv.split("=")));
    const timestamp = parts["t"];
    const v1 = parts["v1"];
    if (!timestamp || !v1) {
      return addSecurityAndCorsHeaders(secureJsonResponse({ error: "Invalid signature header" }, 400), origin);
    }
    const signedPayload = `${timestamp}.${payload}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(env.STRIPE_WEBHOOK_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
    const signatureHex = Array.from(new Uint8Array(signatureBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
    if (signatureHex !== v1) {
      return addSecurityAndCorsHeaders(secureJsonResponse({ error: "Signature verification failed" }, 400), origin);
    }
    const event = JSON.parse(payload);
    if (event.type === "customer.subscription.created") {
      const subscription2 = event.data.object || {};
      const siteId = subscription2.metadata?.siteId;
      if (siteId) {
        const userDataStr = await env.ACCESSIBILITY_AUTH.get(`user_data_${siteId}`);
        const userData = userDataStr ? JSON.parse(userDataStr) : {};
        userData.paymentStatus = "active";
        userData.subscriptionId = subscription2.id;
        userData.lastPaymentDate = (/* @__PURE__ */ new Date()).toISOString();
        await env.ACCESSIBILITY_AUTH.put(`user_data_${siteId}`, JSON.stringify(userData));
        await mergeSiteSettings(env, siteId, {
          siteId,
          paymentStatus: "active",
          subscriptionId: subscription2.id,
          lastPaymentDate: userData.lastPaymentDate
        });
        try {
          const webhookUrl = env.MAKE_WEBHOOK_URL || "https://hook.us1.make.com/mjcnn3ydks2o2pbkrdna9czn7bb253z0";
          await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              event: "subscription_created",
              customer: {
                email: subscription2.metadata?.email || "",
                firstName: subscription2.metadata?.firstName || "User",
                domain: subscription2.metadata?.domain || "",
                siteId
              },
              subscription: {
                id: subscription2.id,
                productId: subscription2.metadata?.productId || ""
              },
              timestamp: (/* @__PURE__ */ new Date()).toISOString()
            })
          });
          console.log("Webhook sent to Make.com successfully");
        } catch (webhookError) {
          console.warn("Webhook failed (non-critical):", webhookError);
        }
      }
    } else if (event.type === "customer.subscription.updated") {
      const subscription2 = event.data.object || {};
      const siteId = subscription2.metadata?.siteId;
      if (siteId) {
        const userDataStr = await env.ACCESSIBILITY_AUTH.get(`user_data_${siteId}`);
        const userData = userDataStr ? JSON.parse(userDataStr) : {};
        userData.paymentStatus = subscription2.status === "active" ? "active" : "inactive";
        userData.lastPaymentDate = (/* @__PURE__ */ new Date()).toISOString();
        userData.currentPeriodStart = subscription2.current_period_start;
        userData.currentPeriodEnd = subscription2.current_period_end;
        userData.cancelAtPeriodEnd = subscription2.cancel_at_period_end || false;
        await env.ACCESSIBILITY_AUTH.put(`user_data_${siteId}`, JSON.stringify(userData));
        await mergeSiteSettings(env, siteId, {
          siteId,
          paymentStatus: userData.paymentStatus,
          lastPaymentDate: userData.lastPaymentDate
        });
        try {
          const price = subscription2.items?.data?.[0]?.price;
          const snap = {
            id: subscription2.id,
            siteId,
            type: "subscription_updated",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            status: subscription2.status,
            currency: price?.currency || null,
            amount: price?.unit_amount || null,
            customerId: subscription2.customer || null,
            subscriptionId: subscription2.id,
            invoiceId: subscription2.latest_invoice || null,
            paymentIntentId: null,
            paymentMethodId: null,
            currentPeriodStart: subscription2.current_period_start || null,
            currentPeriodEnd: subscription2.current_period_end || null,
            cancelAtPeriodEnd: subscription2.cancel_at_period_end || false,
            productId: price?.product || null,
            priceId: price?.id || null,
            metadata: subscription2.metadata || {}
          };
          await env.ACCESSIBILITY_AUTH.put(`payment:${siteId}`, JSON.stringify(snap));
        } catch (e) {
          console.warn("Failed to save payment snapshot (updated):", e);
        }
        try {
          const webhookUrl = env.MAKE_WEBHOOK_URL || "https://hook.us1.make.com/mjcnn3ydks2o2pbkrdna9czn7bb253z0";
          await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              event: "subscription_updated",
              customer: {
                email: subscription2.metadata?.email || "",
                firstName: subscription2.metadata?.firstName || "User",
                domain: subscription2.metadata?.domain || "",
                siteId
              },
              subscription: {
                id: subscription2.id,
                status: subscription2.status,
                productId: subscription2.metadata?.productId || "",
                currentPeriodStart: subscription2.current_period_start,
                currentPeriodEnd: subscription2.current_period_end,
                cancelAtPeriodEnd: subscription2.cancel_at_period_end || false
              },
              timestamp: (/* @__PURE__ */ new Date()).toISOString()
            })
          });
          console.log("Subscription updated webhook sent to Make.com successfully");
        } catch (webhookError) {
          console.warn("Subscription updated webhook failed (non-critical):", webhookError);
        }
      }
    } else if (event.type === "customer.subscription.deleted") {
      const subscription2 = event.data.object || {};
      const siteId = subscription2.metadata?.siteId;
      if (siteId) {
        const userDataStr = await env.ACCESSIBILITY_AUTH.get(`user_data_${siteId}`);
        const userData = userDataStr ? JSON.parse(userDataStr) : {};
        userData.paymentStatus = "cancelled";
        userData.lastPaymentDate = (/* @__PURE__ */ new Date()).toISOString();
        userData.canceled_at = (/* @__PURE__ */ new Date()).toISOString();
        userData.cancellationDate = (/* @__PURE__ */ new Date()).toISOString();
        await env.ACCESSIBILITY_AUTH.put(`user_data_${siteId}`, JSON.stringify(userData));
        await mergeSiteSettings(env, siteId, {
          siteId,
          paymentStatus: "cancelled",
          lastPaymentDate: userData.lastPaymentDate
        });
        try {
          let productId = null;
          let priceId = null;
          if (subscription2.items && subscription2.items.data && subscription2.items.data.length > 0) {
            const item = subscription2.items.data[0];
            productId = item.price?.product || null;
            priceId = item.price?.id || null;
          }
          const snap = {
            id: subscription2.id,
            siteId,
            type: "subscription_deleted",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            status: "canceled",
            currency: null,
            amount: null,
            customerId: subscription2.customer || null,
            subscriptionId: subscription2.id,
            invoiceId: subscription2.latest_invoice || null,
            paymentIntentId: null,
            paymentMethodId: null,
            currentPeriodStart: subscription2.current_period_start || null,
            currentPeriodEnd: subscription2.current_period_end || null,
            cancelAtPeriodEnd: true,
            canceled_at: (/* @__PURE__ */ new Date()).toISOString(),
            cancellationDate: (/* @__PURE__ */ new Date()).toISOString(),
            productId,
            priceId,
            metadata: subscription2.metadata || {}
          };
          await env.ACCESSIBILITY_AUTH.put(`payment:${siteId}`, JSON.stringify(snap));
        } catch (e) {
          console.warn("Failed to save payment snapshot (deleted):", e);
        }
        try {
          const webhookUrl = env.MAKE_WEBHOOK_URL || "https://hook.us1.make.com/mjcnn3ydks2o2pbkrdna9czn7bb253z0";
          await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              event: "subscription_cancelled",
              customer: {
                email: subscription2.metadata?.email || "",
                firstName: subscription2.metadata?.firstName || "User",
                domain: subscription2.metadata?.domain || "",
                siteId
              },
              subscription: {
                id: subscription2.id,
                status: "canceled",
                productId: subscription2.metadata?.productId || "",
                cancelledAt: (/* @__PURE__ */ new Date()).toISOString()
              },
              timestamp: (/* @__PURE__ */ new Date()).toISOString()
            })
          });
          console.log("Subscription cancelled webhook sent to Make.com successfully");
        } catch (webhookError) {
          console.warn("Subscription cancelled webhook failed (non-critical):", webhookError);
        }
      }
    } else if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object || {};
      const siteId = pi.metadata?.siteId;
      if (siteId) {
        const userDataStr = await env.ACCESSIBILITY_AUTH.get(`user_data_${siteId}`);
        const userData = userDataStr ? JSON.parse(userDataStr) : {};
        userData.paymentStatus = "active";
        userData.lastPaymentDate = (/* @__PURE__ */ new Date()).toISOString();
        userData.paymentMethod = pi.payment_method_types?.[0] || "unknown";
        await env.ACCESSIBILITY_AUTH.put(`user_data_${siteId}`, JSON.stringify(userData));
        await mergeSiteSettings(env, siteId, {
          siteId,
          paymentStatus: "active",
          lastPaymentDate: userData.lastPaymentDate
        });
      }
    } else if (event.type === "payment_intent.payment_failed") {
      const pi = event.data.object || {};
      const siteId = pi.metadata?.siteId;
      if (siteId) {
        const userDataStr = await env.ACCESSIBILITY_AUTH.get(`user_data_${siteId}`);
        const userData = userDataStr ? JSON.parse(userDataStr) : {};
        userData.paymentStatus = "failed";
        userData.lastPaymentDate = (/* @__PURE__ */ new Date()).toISOString();
        await env.ACCESSIBILITY_AUTH.put(`user_data_${siteId}`, JSON.stringify(userData));
        await mergeSiteSettings(env, siteId, {
          siteId,
          paymentStatus: "failed",
          lastPaymentDate: userData.lastPaymentDate
        });
      }
    } else if (event.type === "setup_intent.succeeded") {
      console.log("\u{1F514} SetupIntent succeeded webhook received");
      const setupIntent = event.data.object || {};
      const siteId = setupIntent.metadata?.siteId;
      let subscriptionId = setupIntent.metadata?.subscriptionId;
      const email = setupIntent.metadata?.email;
      const domain = setupIntent.metadata?.domain;
      console.log("\u{1F514} SetupIntent webhook data:", { siteId, subscriptionId, email, domain });
      if (siteId && !subscriptionId) {
        console.log("No subscriptionId in SetupIntent metadata, looking up by customer...");
        try {
          const userDataStr = await env.ACCESSIBILITY_AUTH.get(`user_data_${siteId}`);
          if (userDataStr) {
            const userData = JSON.parse(userDataStr);
            subscriptionId = userData.subscriptionId;
            console.log("Found subscriptionId from user data:", subscriptionId);
          }
        } catch (error) {
          console.error("Error looking up subscriptionId:", error);
        }
      }
      if (siteId && subscriptionId) {
        console.log("SetupIntent succeeded, activating subscription:", subscriptionId);
        console.log("SetupIntent metadata:", setupIntent.metadata);
        console.log("Payment method from SetupIntent:", setupIntent.payment_method);
        const updateParams = new URLSearchParams();
        updateParams.append("default_payment_method", setupIntent.payment_method);
        if (email) updateParams.append("metadata[email]", email);
        if (domain) updateParams.append("metadata[domain]", domain);
        if (siteId) updateParams.append("metadata[siteId]", siteId);
        const subscriptionUpdateResponse = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: updateParams
        });
        if (subscriptionUpdateResponse.ok) {
          const updatedSubscription = await subscriptionUpdateResponse.json();
          console.log("Subscription updated with payment method from SetupIntent");
          console.log("Updated subscription status:", updatedSubscription.status);
          console.log("Updated subscription metadata:", updatedSubscription.metadata);
          const userDataStr = await env.ACCESSIBILITY_AUTH.get(`user_data_${siteId}`);
          const userData = userDataStr ? JSON.parse(userDataStr) : {};
          userData.paymentStatus = "active";
          userData.lastPaymentDate = (/* @__PURE__ */ new Date()).toISOString();
          userData.paymentMethod = setupIntent.payment_method_types?.[0] || "card";
          userData.email = email || userData.email;
          userData.domain = domain || userData.domain;
          userData.currentPeriodStart = updatedSubscription.current_period_start;
          userData.currentPeriodEnd = updatedSubscription.current_period_end;
          userData.cancelAtPeriodEnd = updatedSubscription.cancel_at_period_end || false;
          await env.ACCESSIBILITY_AUTH.put(`user_data_${siteId}`, JSON.stringify(userData));
          await mergeSiteSettings(env, siteId, {
            siteId,
            email: email || "",
            domain: domain || "",
            paymentStatus: "active",
            lastPaymentDate: userData.lastPaymentDate
          });
        } else {
          const errorText = await subscriptionUpdateResponse.text();
          console.error("Failed to update subscription:", errorText);
        }
      }
    }
    return new Response("ok", { status: 200, headers: { "Content-Type": "text/plain" } });
  } catch (err) {
    return addSecurityAndCorsHeaders(secureJsonResponse({ error: err.message || "webhook error" }, 500), origin);
  }
}
__name(handleStripeWebhook, "handleStripeWebhook");
async function handleActivateSubscription(request, env) {
  const origin = request.headers.get("origin");
  try {
    const { siteId, setupIntentId, paymentMethodId } = await request.json();
    if (!siteId || !setupIntentId || !paymentMethodId) {
      const errorResponse = secureJsonResponse({ error: "Missing required fields" }, 400);
      return addSecurityAndCorsHeaders(errorResponse, origin);
    }
    console.log("Manual activation request:", { siteId, setupIntentId, paymentMethodId });
    const userDataStr = await env.ACCESSIBILITY_AUTH.get(`user_data_${siteId}`);
    console.log("User data from KV:", userDataStr);
    if (!userDataStr) {
      const errorResponse = secureJsonResponse({ error: "No subscription found for site" }, 404);
      return addSecurityAndCorsHeaders(errorResponse, origin);
    }
    const userData = JSON.parse(userDataStr);
    const subscriptionId = userData.subscriptionId;
    console.log("Found subscription ID:", subscriptionId);
    if (!subscriptionId) {
      const errorResponse = secureJsonResponse({ error: "No subscription ID found" }, 404);
      return addSecurityAndCorsHeaders(errorResponse, origin);
    }
    console.log("Checking if payment method is already attached to customer:", userData.customerId);
    try {
      const paymentMethodResponse = await fetch(`https://api.stripe.com/v1/payment_methods/${paymentMethodId}`, {
        headers: {
          Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`
        }
      });
      if (paymentMethodResponse.ok) {
        const paymentMethod = await paymentMethodResponse.json();
        console.log("Payment method details:", paymentMethod);
        if (paymentMethod.customer === userData.customerId) {
          console.log("Payment method is already attached to customer - continuing");
        } else {
          console.log("Payment method is attached to different customer, attempting to attach to correct customer");
          const attachParams = new URLSearchParams();
          attachParams.append("customer", userData.customerId);
          const attachResponse = await fetch(`https://api.stripe.com/v1/payment_methods/${paymentMethodId}/attach`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
              "Content-Type": "application/x-www-form-urlencoded"
            },
            body: attachParams
          });
          if (attachResponse.ok) {
            console.log("Payment method attached to customer successfully");
          } else {
            const attachError = await attachResponse.text();
            console.error("Failed to attach payment method to customer:", attachError);
            throw new Error(`Failed to attach payment method: ${attachError}`);
          }
        }
      } else {
        console.error("Failed to retrieve payment method details");
        throw new Error("Failed to retrieve payment method details");
      }
    } catch (error) {
      console.log("Payment method attachment check failed, but continuing:", error.message);
    }
    const subscriptionLookup = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
      headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` }
    });
    let subscriptionCustomerId = userData.customerId;
    if (subscriptionLookup.ok) {
      const sub = await subscriptionLookup.json();
      subscriptionCustomerId = sub.customer || subscriptionCustomerId;
      console.log("Subscription customer ID:", subscriptionCustomerId);
    } else {
      console.warn("Failed to look up subscription for customer id, proceeding with stored customerId");
    }
    try {
      const pmResp = await fetch(`https://api.stripe.com/v1/payment_methods/${paymentMethodId}`, {
        headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` }
      });
      if (pmResp.ok) {
        const pm = await pmResp.json();
        if (pm.customer && pm.customer !== subscriptionCustomerId) {
          const conflict = secureJsonResponse({
            error: "payment_method_conflict",
            details: "Payment method belongs to a different customer. Please retry payment to create a new payment method for this site."
          }, 409);
          return addSecurityAndCorsHeaders(conflict, origin);
        }
      }
    } catch (pmErr) {
      console.log("Payment method lookup warning:", pmErr?.message || pmErr);
    }
    const updateParams = new URLSearchParams();
    updateParams.append("default_payment_method", paymentMethodId);
    console.log("Updating subscription with payment method:", paymentMethodId);
    console.log("Update params:", updateParams.toString());
    const subscriptionUpdateResponse = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: updateParams
    });
    console.log("Subscription update response status:", subscriptionUpdateResponse.status);
    if (subscriptionUpdateResponse.ok) {
      let updatedSubscription = await subscriptionUpdateResponse.json();
      console.log("Subscription manually activated (post-update):", updatedSubscription.status);
      console.log("Updated subscription details:", updatedSubscription);
      try {
        if (updatedSubscription.status === "incomplete" && updatedSubscription.latest_invoice) {
          console.log("Attempting to pay latest invoice:", updatedSubscription.latest_invoice);
          const payResp = await fetch(`https://api.stripe.com/v1/invoices/${updatedSubscription.latest_invoice}/pay`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`
            }
          });
          if (!payResp.ok) {
            const pt = await payResp.text();
            console.warn("Failed to pay invoice:", pt);
          } else {
            console.log("Invoice payment attempted successfully");
          }
          const refreshedResp = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
            headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` }
          });
          if (refreshedResp.ok) {
            updatedSubscription = await refreshedResp.json();
            console.log("Subscription status after invoice pay attempt:", updatedSubscription.status);
          }
        }
      } catch (invoiceErr) {
        console.log("Invoice payment flow warning:", invoiceErr?.message || invoiceErr);
      }
      userData.paymentStatus = "active";
      userData.lastPaymentDate = (/* @__PURE__ */ new Date()).toISOString();
      userData.paymentMethod = "card";
      await env.ACCESSIBILITY_AUTH.put(`user_data_${siteId}`, JSON.stringify(userData));
      await mergeSiteSettings(env, siteId, {
        siteId,
        paymentStatus: updatedSubscription.status === "active" ? "active" : updatedSubscription.status,
        lastPaymentDate: userData.lastPaymentDate
      });
      try {
        const snapshot = {
          id: updatedSubscription.id,
          siteId,
          type: "manual_activation",
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          status: updatedSubscription.status,
          currency: updatedSubscription.currency || null,
          amount: updatedSubscription.items?.data?.[0]?.price?.unit_amount || null,
          customerId: updatedSubscription.customer || null,
          subscriptionId: updatedSubscription.id,
          invoiceId: updatedSubscription.latest_invoice || null,
          paymentIntentId: null,
          paymentMethodId,
          currentPeriodStart: updatedSubscription.current_period_start || null,
          currentPeriodEnd: updatedSubscription.current_period_end || null,
          metadata: updatedSubscription.metadata || {}
        };
        await env.ACCESSIBILITY_AUTH.put(`payment:${siteId}`, JSON.stringify(snapshot));
      } catch (snapErr) {
        console.warn("Failed to save payment snapshot (manual activation):", snapErr);
      }
      return addSecurityAndCorsHeaders(secureJsonResponse({
        success: true,
        status: updatedSubscription.status
      }), origin);
    } else {
      const errorText = await subscriptionUpdateResponse.text();
      console.error("Subscription update failed:", errorText);
      console.error("Response status:", subscriptionUpdateResponse.status);
      throw new Error(`Failed to activate subscription: ${errorText}`);
    }
  } catch (error) {
    console.error("Manual activation error:", error);
    console.error("Error stack:", error.stack);
    console.error("Error details:", {
      message: error.message,
      name: error.name,
      cause: error.cause
    });
    const errorResponse = secureJsonResponse({
      error: error.message || "Activation failed",
      details: error.stack
    }, 500);
    return addSecurityAndCorsHeaders(errorResponse, origin);
  }
}
__name(handleActivateSubscription, "handleActivateSubscription");
async function handleCheckSubscriptionStatus(request, env) {
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  const subscriptionId = url.searchParams.get("id");
  if (!subscriptionId) {
    const errorResponse = secureJsonResponse({ error: "Missing subscription ID" }, 400);
    return addSecurityAndCorsHeaders(errorResponse, origin);
  }
  try {
    const subscriptionResponse = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`
      }
    });
    if (!subscriptionResponse.ok) {
      const errorText = await subscriptionResponse.text();
      throw new Error(`Failed to retrieve subscription: ${errorText}`);
    }
    const subscription2 = await subscriptionResponse.json();
    return addSecurityAndCorsHeaders(secureJsonResponse({
      status: subscription2.status,
      subscriptionId: subscription2.id,
      current_period_end: subscription2.current_period_end,
      current_period_start: subscription2.current_period_start,
      cancel_at_period_end: subscription2.cancel_at_period_end,
      canceled_at: subscription2.canceled_at,
      access_details: {
        has_access: subscription2.status === "active",
        access_until: subscription2.current_period_end,
        access_start: subscription2.current_period_start,
        will_cancel: subscription2.cancel_at_period_end,
        canceled_at: subscription2.canceled_at
      }
    }), origin);
  } catch (error) {
    console.error("Check subscription status error:", error);
    const errorResponse = secureJsonResponse({
      error: "Failed to check subscription status",
      details: error.message
    }, 500);
    return addSecurityAndCorsHeaders(errorResponse, origin);
  }
}
__name(handleCheckSubscriptionStatus, "handleCheckSubscriptionStatus");
async function handleGetSubscriptionPlan(request, env) {
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  const subscriptionId = url.searchParams.get("id");
  if (!subscriptionId) {
    const errorResponse = secureJsonResponse({ error: "Missing subscription ID" }, 400);
    return addSecurityAndCorsHeaders(errorResponse, origin);
  }
  try {
    const subscriptionResponse = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`
      }
    });
    if (!subscriptionResponse.ok) {
      const errorText = await subscriptionResponse.text();
      throw new Error(`Failed to retrieve subscription: ${errorText}`);
    }
    const subscription2 = await subscriptionResponse.json();
    let planType = "monthly";
    if (subscription2.items && subscription2.items.data && subscription2.items.data.length > 0) {
      const priceId = subscription2.items.data[0].price.id;
      if (priceId === "price_1SL2ZQRh1lS9W4XK8QJqJzKx" || priceId.includes("annual")) {
        planType = "annual";
      } else if (priceId === "price_1SL2ZQRh1lS9W4XK8QJqJzKy" || priceId.includes("monthly")) {
        planType = "monthly";
      }
    }
    const validUntil = new Date(subscription2.current_period_end * 1e3).toISOString();
    return addSecurityAndCorsHeaders(secureJsonResponse({
      planType,
      validUntil,
      subscriptionId: subscription2.id,
      status: subscription2.status,
      current_period_end: subscription2.current_period_end,
      current_period_start: subscription2.current_period_start
    }), origin);
  } catch (error) {
    console.error("Get subscription plan error:", error);
    const errorResponse = secureJsonResponse({
      error: "Failed to get subscription plan",
      details: error.message
    }, 500);
    return addSecurityAndCorsHeaders(errorResponse, origin);
  }
}
__name(handleGetSubscriptionPlan, "handleGetSubscriptionPlan");
async function handleSetupPayment(request, env) {
  const origin = request.headers.get("origin");
  try {
    const requestBody = await request.text();
    console.log("\u{1F50D} Raw request body:", requestBody);
    console.log("\u{1F50D} Request body length:", requestBody.length);
    let requestData;
    try {
      requestData = JSON.parse(requestBody);
      console.log("\u{1F50D} Parsed request data:", requestData);
    } catch (parseError) {
      console.error("\u{1F50D} JSON parse error:", parseError);
      const errorResponse = secureJsonResponse({ error: "Invalid JSON in request body" }, 400);
      return addSecurityAndCorsHeaders(errorResponse, origin);
    }
    const { email, domainUrl, siteId } = requestData;
    console.log("\u{1F50D} Extracted fields:", { email, domainUrl, siteId });
    console.log("\u{1F50D} Email type:", typeof email, "Email value:", email);
    console.log("\u{1F50D} SiteId type:", typeof siteId, "SiteId value:", siteId);
    console.log("\u{1F50D} DomainUrl type:", typeof domainUrl, "DomainUrl value:", domainUrl);
    if (!email || !siteId) {
      console.error("\u{1F50D} Missing required fields - email:", !!email, "siteId:", !!siteId);
      const errorResponse = secureJsonResponse({ error: "Missing required fields", details: { email: !!email, siteId: !!siteId } }, 400);
      return addSecurityAndCorsHeaders(errorResponse, origin);
    }
    console.log("Setting up payment for:", { email, domainUrl, siteId });
    let customer;
    const existingCustomersResponse = await fetch(`https://api.stripe.com/v1/customers?email=${encodeURIComponent(email)}&limit=1`, {
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`
      }
    });
    if (existingCustomersResponse.ok) {
      const existingCustomers = await existingCustomersResponse.json();
      if (existingCustomers.data.length > 0) {
        customer = existingCustomers.data[0];
        console.log("Found existing customer:", customer.id);
      }
    }
    if (!customer) {
      const customerData = new URLSearchParams();
      customerData.append("email", email);
      customerData.append("metadata[siteId]", siteId);
      customerData.append("metadata[domain]", domainUrl || "");
      const customerResponse = await fetch("https://api.stripe.com/v1/customers", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: customerData
      });
      if (!customerResponse.ok) {
        const errorText = await customerResponse.text();
        throw new Error(`Failed to create customer: ${errorText}`);
      }
      customer = await customerResponse.json();
      console.log("Created new customer:", customer.id);
    }
    const setupIntentData = new URLSearchParams();
    setupIntentData.append("customer", customer.id);
    setupIntentData.append("payment_method_types[]", "card");
    setupIntentData.append("usage", "off_session");
    setupIntentData.append("metadata[siteId]", siteId);
    setupIntentData.append("metadata[email]", email);
    setupIntentData.append("metadata[domain]", domainUrl || "");
    const setupIntentResponse = await fetch("https://api.stripe.com/v1/setup_intents", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: setupIntentData
    });
    if (!setupIntentResponse.ok) {
      const errorText = await setupIntentResponse.text();
      throw new Error(`Failed to create setup intent: ${errorText}`);
    }
    const setupIntent = await setupIntentResponse.json();
    console.log("Created setup intent:", setupIntent.id);
    return addSecurityAndCorsHeaders(secureJsonResponse({
      setupIntentId: setupIntent.id,
      clientSecret: setupIntent.client_secret,
      customerId: customer.id
    }), origin);
  } catch (error) {
    console.error("Setup payment error:", error);
    const errorResponse = secureJsonResponse({
      error: "Failed to set up payment",
      details: error.message
    }, 500);
    return addSecurityAndCorsHeaders(errorResponse, origin);
  }
}
__name(handleSetupPayment, "handleSetupPayment");
async function handleVerifyPaymentMethod(request, env) {
  const origin = request.headers.get("origin");
  try {
    const { setupIntentId } = await request.json();
    if (!setupIntentId) {
      const errorResponse = secureJsonResponse({ error: "Missing setupIntentId" }, 400);
      return addSecurityAndCorsHeaders(errorResponse, origin);
    }
    console.log("Verifying payment method for setup intent:", setupIntentId);
    const setupIntentResponse = await fetch(`https://api.stripe.com/v1/setup_intents/${setupIntentId}`, {
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`
      }
    });
    if (!setupIntentResponse.ok) {
      const errorText = await setupIntentResponse.text();
      throw new Error(`Failed to retrieve setup intent: ${errorText}`);
    }
    const setupIntent = await setupIntentResponse.json();
    console.log("Setup intent status:", setupIntent.status);
    if (setupIntent.status !== "succeeded") {
      const errorResponse = secureJsonResponse({
        error: "Setup intent not successful",
        details: `Current status: ${setupIntent.status}`
      }, 400);
      return addSecurityAndCorsHeaders(errorResponse, origin);
    }
    if (!setupIntent.payment_method) {
      const errorResponse = secureJsonResponse({
        error: "No payment method attached",
        details: "The setup intent did not result in an attached payment method"
      }, 400);
      return addSecurityAndCorsHeaders(errorResponse, origin);
    }
    const paymentMethodId = setupIntent.payment_method;
    const customerId2 = setupIntent.customer;
    console.log("Payment method attached:", paymentMethodId);
    console.log("Customer ID:", customerId2);
    const customerUpdateData = new URLSearchParams();
    customerUpdateData.append("invoice_settings[default_payment_method]", paymentMethodId);
    const customerUpdateResponse = await fetch(`https://api.stripe.com/v1/customers/${customerId2}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: customerUpdateData
    });
    if (!customerUpdateResponse.ok) {
      const errorText = await customerUpdateResponse.text();
      console.warn("Failed to set default payment method:", errorText);
    } else {
      console.log("Default payment method set successfully");
    }
    const customerResponse = await fetch(`https://api.stripe.com/v1/customers/${customerId2}`, {
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`
      }
    });
    let isDefaultSet = false;
    if (customerResponse.ok) {
      const customer = await customerResponse.json();
      isDefaultSet = customer.invoice_settings?.default_payment_method === paymentMethodId;
      console.log("Default payment method verification:", isDefaultSet);
    }
    return addSecurityAndCorsHeaders(secureJsonResponse({
      success: true,
      paymentMethodId,
      customerId: customerId2,
      isDefaultPaymentMethodSet: isDefaultSet
    }), origin);
  } catch (error) {
    console.error("Payment method verification error:", error);
    const errorResponse = secureJsonResponse({
      error: "Failed to verify payment method",
      details: error.message
    }, 500);
    return addSecurityAndCorsHeaders(errorResponse, origin);
  }
}
__name(handleVerifyPaymentMethod, "handleVerifyPaymentMethod");
async function handleCheckPaymentStatus(request, env) {
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  const domain = url.searchParams.get("domain");
  const siteId = url.searchParams.get("siteId");
  try {
    console.log("Checking payment status for domain:", domain, "siteId:", siteId);
    if (!domain) {
      const errorResponse = secureJsonResponse({ error: "Missing domain parameter" }, 400);
      return addSecurityAndCorsHeaders(errorResponse, origin);
    }
    const isStagingDomain = domain.includes(".webflow.io") || domain.includes(".webflow.com") || domain.includes("localhost") || domain.includes("127.0.0.1") || domain.includes("staging");
    if (isStagingDomain) {
      console.log("Staging domain detected, allowing access:", domain);
      return addSecurityAndCorsHeaders(secureJsonResponse({
        hasAccess: true,
        isStaging: true,
        reason: "Staging domain - no payment required"
      }), origin);
    }
    let paymentData = null;
    if (siteId) {
      const paymentRecord = await env.ACCESSIBILITY_AUTH.get(`payment:${siteId}`);
      if (paymentRecord) {
        paymentData = JSON.parse(paymentRecord);
        console.log("Found payment data by siteId:", paymentData);
      }
    }
    if (!paymentData) {
      const domainKey = `domain:${domain}`;
      const domainData = await env.ACCESSIBILITY_AUTH.get(domainKey);
      if (domainData) {
        const domainInfo = JSON.parse(domainData);
        const siteIdFromDomain = domainInfo.siteId;
        if (siteIdFromDomain) {
          const paymentRecord = await env.ACCESSIBILITY_AUTH.get(`payment:${siteIdFromDomain}`);
          if (paymentRecord) {
            paymentData = JSON.parse(paymentRecord);
            console.log("Found payment data by domain lookup:", paymentData);
          }
        }
      }
    }
    if (!paymentData) {
      console.log("No payment data found for domain:", domain);
      return addSecurityAndCorsHeaders(secureJsonResponse({
        hasAccess: false,
        isStaging: false,
        reason: "No payment found for this domain",
        requiresPayment: true
      }), origin);
    }
    const now = (/* @__PURE__ */ new Date()).getTime();
    const currentPeriodEnd = paymentData.currentPeriodEnd;
    let isActive = false;
    if (paymentData.status === "active") {
      if (currentPeriodEnd) {
        const periodEndMs = currentPeriodEnd > 1e12 ? currentPeriodEnd : currentPeriodEnd * 1e3;
        isActive = now < periodEndMs;
        console.log("Payment validation:", {
          status: paymentData.status,
          currentPeriodEnd,
          periodEndMs,
          now,
          isActive
        });
      } else {
        isActive = true;
        console.log("Payment validation: No currentPeriodEnd, using status only:", paymentData.status);
      }
    }
    if (!isActive && paymentData.status === "active" && !currentPeriodEnd) {
      const subscriptionDate = new Date(paymentData.timestamp);
      const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1e3);
      if (subscriptionDate > thirtyDaysAgo) {
        isActive = true;
        console.log("Payment validation: Recent subscription without period data, allowing access");
      }
    }
    if (isActive) {
      console.log("Payment is active for domain:", domain);
      return addSecurityAndCorsHeaders(secureJsonResponse({
        hasAccess: true,
        isStaging: false,
        reason: "Active payment found",
        paymentStatus: paymentData.status,
        validUntil: new Date(currentPeriodEnd * 1e3).toISOString(),
        subscriptionId: paymentData.subscriptionId
      }), origin);
    } else {
      console.log("Payment is not active for domain:", domain, "status:", paymentData.status);
      return addSecurityAndCorsHeaders(secureJsonResponse({
        hasAccess: false,
        isStaging: false,
        reason: "Payment not active or expired",
        paymentStatus: paymentData.status,
        validUntil: currentPeriodEnd ? new Date(currentPeriodEnd * 1e3).toISOString() : null,
        requiresPayment: true
      }), origin);
    }
  } catch (error) {
    console.error("Check payment status error:", error);
    const errorResponse = secureJsonResponse({
      error: "Failed to check payment status",
      details: error.message
    }, 500);
    return addSecurityAndCorsHeaders(errorResponse, origin);
  }
}
__name(handleCheckPaymentStatus, "handleCheckPaymentStatus");
async function handleWidgetScript(request, env) {
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  const domain = url.searchParams.get("domain");
  const siteId = url.searchParams.get("siteId");
  try {
    console.log("\u{1F525} Widget script requested for domain:", domain, "siteId:", siteId);
    console.log("\u{1F525} Request headers referer:", request.headers.get("referer"));
    console.log("\u{1F525} Request URL:", request.url);
    const currentDomain = domain || request.headers.get("referer") || "unknown";
    console.log("\u{1F525} Current domain determined as:", currentDomain);
    const isStagingDomain = currentDomain.includes(".webflow.io") || currentDomain.includes(".webflow.com") || currentDomain.includes("localhost") || currentDomain.includes("127.0.0.1") || currentDomain.includes("staging");
    if (isStagingDomain) {
      console.log("Staging domain detected, serving widget script:", currentDomain);
      return new Response(getWidgetScript(true), {
        headers: {
          "Content-Type": "application/javascript",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=3600"
        }
      });
    }
    let paymentData = null;
    if (siteId) {
      const paymentRecord = await env.ACCESSIBILITY_AUTH.get(`payment:${siteId}`);
      if (paymentRecord) {
        paymentData = JSON.parse(paymentRecord);
        console.log("Found payment data by siteId:", paymentData);
      }
    }
    if (!paymentData) {
      const domainKey = `domain:${currentDomain}`;
      console.log("\u{1F525} Looking for domain mapping with key:", domainKey);
      const domainData = await env.ACCESSIBILITY_AUTH.get(domainKey);
      if (domainData) {
        const domainInfo = JSON.parse(domainData);
        console.log("\u{1F525} Found domain mapping:", domainInfo);
        const siteIdFromDomain = domainInfo.siteId;
        if (siteIdFromDomain) {
          const paymentRecord = await env.ACCESSIBILITY_AUTH.get(`payment:${siteIdFromDomain}`);
          if (paymentRecord) {
            paymentData = JSON.parse(paymentRecord);
            console.log("\u{1F525} Found payment data by domain lookup:", paymentData);
          }
        }
      } else {
        console.log("\u{1F525} No domain mapping found for:", domainKey);
      }
    }
    if (!paymentData) {
      console.log("No payment data found for domain:", currentDomain);
      return new Response(getWidgetScript(false, "No payment found for this domain"), {
        headers: {
          "Content-Type": "application/javascript",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=300"
        }
      });
    }
    const now = (/* @__PURE__ */ new Date()).getTime();
    const currentPeriodEnd = paymentData.currentPeriodEnd;
    let isActive = false;
    if (paymentData.status === "active") {
      if (currentPeriodEnd) {
        const periodEndMs = currentPeriodEnd > 1e12 ? currentPeriodEnd : currentPeriodEnd * 1e3;
        isActive = now < periodEndMs;
        console.log("Payment validation:", {
          status: paymentData.status,
          currentPeriodEnd,
          periodEndMs,
          now,
          isActive
        });
      } else {
        isActive = true;
        console.log("Payment validation: No currentPeriodEnd, using status only:", paymentData.status);
      }
    }
    if (!isActive && paymentData.status === "active" && !currentPeriodEnd) {
      const subscriptionDate = new Date(paymentData.timestamp);
      const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1e3);
      if (subscriptionDate > thirtyDaysAgo) {
        isActive = true;
        console.log("Payment validation: Recent subscription without period data, allowing access");
      }
    }
    if (isActive) {
      console.log("Payment is active for domain:", currentDomain);
      return new Response(getWidgetScript(true), {
        headers: {
          "Content-Type": "application/javascript",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=3600"
        }
      });
    } else {
      console.log("Payment is not active for domain:", currentDomain, "status:", paymentData.status);
      const reason = paymentData.status === "active" ? "Payment expired" : "Payment not active";
      return new Response(getWidgetScript(false, reason), {
        headers: {
          "Content-Type": "application/javascript",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=300"
        }
      });
    }
  } catch (error) {
    console.error("Widget script error:", error);
    return new Response(getWidgetScript(false, "Error checking payment status"), {
      headers: {
        "Content-Type": "application/javascript",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache"
      }
    });
  }
}
__name(handleWidgetScript, "handleWidgetScript");
function getWidgetScript(hasAccess, reason = "") {
  if (hasAccess) {
    return `
(function() {
  'use strict';
  
  // ContrastKit Accessibility Widget Script
  console.log('ContrastKit Accessibility Widget loaded - Full Access');
  
  // Accessibility Widget Implementation
  const ContrastKitWidget = {
    isInitialized: false,
    
    init: function() {
      if (this.isInitialized) return;
      this.isInitialized = true;
      
      console.log('ContrastKit Accessibility Widget initialized');
      
      // Create accessibility toolbar
      this.createToolbar();
      
      // Add keyboard navigation support
      this.addKeyboardSupport();
      
      // Add screen reader support
      this.addScreenReaderSupport();
      
      console.log('ContrastKit features activated');
    },
    
    createToolbar: function() {
      const toolbar = document.createElement('div');
      toolbar.id = 'contrastkit-toolbar';
      toolbar.innerHTML = \`
        <div style="
          position: fixed;
          top: 20px;
          left: 20px;
          background: #1a1a1a;
          color: white;
          padding: 12px;
          border-radius: 8px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 14px;
          z-index: 9999;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          max-width: 200px;
        ">
          <div style="font-weight: 600; margin-bottom: 8px;">Accessibility Tools</div>
          <button onclick="ContrastKitWidget.increaseFontSize()" style="
            background: #3b82f6;
            color: white;
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            margin: 2px;
            cursor: pointer;
            font-size: 12px;
          ">A+</button>
          <button onclick="ContrastKitWidget.decreaseFontSize()" style="
            background: #3b82f6;
            color: white;
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            margin: 2px;
            cursor: pointer;
            font-size: 12px;
          ">A-</button>
          <button onclick="ContrastKitWidget.toggleHighContrast()" style="
            background: #3b82f6;
            color: white;
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            margin: 2px;
            cursor: pointer;
            font-size: 12px;
          ">High Contrast</button>
        </div>
      \`;
      document.body.appendChild(toolbar);
    },
    
    increaseFontSize: function() {
      const currentSize = parseFloat(getComputedStyle(document.body).fontSize);
      document.body.style.fontSize = (currentSize + 2) + 'px';
    },
    
    decreaseFontSize: function() {
      const currentSize = parseFloat(getComputedStyle(document.body).fontSize);
      document.body.style.fontSize = Math.max(currentSize - 2, 12) + 'px';
    },
    
    toggleHighContrast: function() {
      document.body.classList.toggle('contrastkit-high-contrast');
      if (!document.querySelector('#contrastkit-contrast-styles')) {
        const style = document.createElement('style');
        style.id = 'contrastkit-contrast-styles';
        style.textContent = \`
          .contrastkit-high-contrast {
            filter: contrast(150%) brightness(120%);
          }
          .contrastkit-high-contrast * {
            background-color: white !important;
            color: black !important;
          }
        \`;
        document.head.appendChild(style);
      }
    },
    
    addKeyboardSupport: function() {
      document.addEventListener('keydown', function(e) {
        // Alt + A to toggle accessibility toolbar
        if (e.altKey && e.key === 'a') {
          const toolbar = document.getElementById('contrastkit-toolbar');
          if (toolbar) {
            toolbar.style.display = toolbar.style.display === 'none' ? 'block' : 'none';
          }
        }
      });
    },
    
    addScreenReaderSupport: function() {
      // Add ARIA labels to interactive elements
      const buttons = document.querySelectorAll('button:not([aria-label])');
      buttons.forEach(button => {
        if (!button.getAttribute('aria-label')) {
          button.setAttribute('aria-label', button.textContent || 'Button');
        }
      });
    }
  };
  
  // Make widget globally accessible
  window.ContrastKitWidget = ContrastKitWidget;
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      ContrastKitWidget.init();
    });
  } else {
    ContrastKitWidget.init();
  }
})();
`;
  } else {
    return `
(function() {
  'use strict';
  
  console.log('ContrastKit Accessibility Widget - Payment Required');
  console.log('Reason: ${reason}');
  
  // Show payment required message
  const showPaymentMessage = function() {
    const message = document.createElement('div');
    message.innerHTML = \`
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: #f59e0b;
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        z-index: 9999;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        max-width: 300px;
      ">
        <strong>Accessibility Widget</strong><br>
        Payment required to activate features.
        <a href="https://accessibility-widget.web-8fb.workers.dev" style="color: white; text-decoration: underline; margin-left: 4px;">
          Subscribe Now
        </a>
      </div>
    \`;
    document.body.appendChild(message);
    
    // Remove message after 10 seconds
    setTimeout(() => {
      if (message.parentNode) {
        message.parentNode.removeChild(message);
      }
    }, 10000);
  };
  
  // Show message when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showPaymentMessage);
  } else {
    showPaymentMessage();
  }
})();
`;
  }
}
__name(getWidgetScript, "getWidgetScript");
async function handleCancelSubscription(request, env) {
  const origin = request.headers.get("origin");
  try {
    const { subscriptionId, siteId, cancelAtPeriodEnd = true } = await request.json();
    let finalSubscriptionId = subscriptionId;
    if (!finalSubscriptionId && siteId) {
      console.log("No subscriptionId provided, looking up from siteId:", siteId);
      const userDataStr = await env.ACCESSIBILITY_AUTH.get(`user_data_${siteId}`);
      if (userDataStr) {
        const userData = JSON.parse(userDataStr);
        finalSubscriptionId = userData.subscriptionId;
        console.log("Found subscriptionId in user_data:", finalSubscriptionId);
        console.log("Full user_data:", userData);
      }
      if (!finalSubscriptionId) {
        const paymentSnapshotStr = await env.ACCESSIBILITY_AUTH.get(`payment:${siteId}`);
        if (paymentSnapshotStr) {
          const paymentSnapshot = JSON.parse(paymentSnapshotStr);
          finalSubscriptionId = paymentSnapshot.subscriptionId;
          console.log("Found subscriptionId in payment snapshot:", finalSubscriptionId);
        }
      }
    }
    if (!finalSubscriptionId) {
      const errorResponse = secureJsonResponse({ error: "Missing subscription ID" }, 400);
      return addSecurityAndCorsHeaders(errorResponse, origin);
    }
    console.log("Cancel subscription request:", { subscriptionId: finalSubscriptionId, siteId, cancelAtPeriodEnd });
    console.log("About to call Stripe API with subscription ID:", finalSubscriptionId);
    let subscription2;
    if (cancelAtPeriodEnd) {
      console.log("Canceling subscription at period end");
      const subscriptionResponse = await fetch(`https://api.stripe.com/v1/subscriptions/${finalSubscriptionId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          cancel_at_period_end: "true"
        })
      });
      if (!subscriptionResponse.ok) {
        const errorText = await subscriptionResponse.text();
        console.error("Stripe API error (period end):", errorText);
        throw new Error(`Failed to cancel subscription: ${errorText}`);
      }
      subscription2 = await subscriptionResponse.json();
      console.log("Stripe cancellation response (period end):", subscription2);
    } else {
      console.log("Canceling subscription immediately");
      const subscriptionResponse = await fetch(`https://api.stripe.com/v1/subscriptions/${finalSubscriptionId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`
        }
      });
      if (!subscriptionResponse.ok) {
        const errorText = await subscriptionResponse.text();
        console.error("Stripe API error (immediate):", errorText);
        throw new Error(`Failed to cancel subscription: ${errorText}`);
      }
      subscription2 = await subscriptionResponse.json();
      console.log("Stripe cancellation response (immediate):", subscription2);
    }
    if (siteId) {
      console.log("Updating KV store for cancellation:", { siteId, cancelAtPeriodEnd });
      const userDataStr = await env.ACCESSIBILITY_AUTH.get(`user_data_${siteId}`);
      if (userDataStr) {
        const userData = JSON.parse(userDataStr);
        userData.paymentStatus = cancelAtPeriodEnd ? "canceling" : "canceled";
        userData.cancelAtPeriodEnd = subscription2.cancel_at_period_end;
        userData.currentPeriodEnd = subscription2.current_period_end;
        userData.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
        userData.cancellationDate = (/* @__PURE__ */ new Date()).toISOString();
        userData.canceled_at = (/* @__PURE__ */ new Date()).toISOString();
        await env.ACCESSIBILITY_AUTH.put(`user_data_${siteId}`, JSON.stringify(userData));
        console.log("Updated user_data_${siteId} with cancellation status");
      }
      const paymentSnapshotStr = await env.ACCESSIBILITY_AUTH.get(`payment:${siteId}`);
      if (paymentSnapshotStr) {
        const paymentSnapshot = JSON.parse(paymentSnapshotStr);
        paymentSnapshot.status = cancelAtPeriodEnd ? "canceling" : "canceled";
        paymentSnapshot.cancelAtPeriodEnd = subscription2.cancel_at_period_end;
        paymentSnapshot.currentPeriodEnd = subscription2.current_period_end;
        paymentSnapshot.cancellationDate = (/* @__PURE__ */ new Date()).toISOString();
        paymentSnapshot.canceled_at = (/* @__PURE__ */ new Date()).toISOString();
        paymentSnapshot.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
        await env.ACCESSIBILITY_AUTH.put(`payment:${siteId}`, JSON.stringify(paymentSnapshot));
        console.log("Updated payment:${siteId} with cancellation status");
      }
      await mergeSiteSettings(env, siteId, {
        siteId,
        paymentStatus: cancelAtPeriodEnd ? "canceling" : "canceled",
        cancelAtPeriodEnd: subscription2.cancel_at_period_end,
        currentPeriodEnd: subscription2.current_period_end,
        cancellationDate: (/* @__PURE__ */ new Date()).toISOString(),
        lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
      });
      console.log("Updated site settings with cancellation status");
    }
    const successResponse = secureJsonResponse({
      success: true,
      subscription: {
        id: subscription2.id,
        status: subscription2.status,
        cancel_at_period_end: subscription2.cancel_at_period_end,
        current_period_end: subscription2.current_period_end,
        canceled_at: subscription2.canceled_at,
        access_details: {
          has_access: subscription2.status === "active",
          access_until: subscription2.current_period_end,
          access_start: subscription2.current_period_start,
          will_cancel: subscription2.cancel_at_period_end,
          canceled_at: subscription2.canceled_at
        }
      },
      message: cancelAtPeriodEnd ? "Subscription will be canceled at the end of the current billing period" : "Subscription has been canceled immediately"
    });
    return addSecurityAndCorsHeaders(successResponse, origin);
  } catch (error) {
    console.error("Cancel subscription error:", error);
    const errorResponse = secureJsonResponse({
      success: false,
      error: "Failed to cancel subscription",
      details: error.message
    }, 500);
    return addSecurityAndCorsHeaders(errorResponse, origin);
  }
}
__name(handleCancelSubscription, "handleCancelSubscription");
async function handleGetSubscriptionStatus(request, env) {
  const origin = request.headers.get("origin");
  try {
    const { siteId } = await request.json();
    if (!siteId) {
      const errorResponse = secureJsonResponse({ error: "Missing site ID" }, 400);
      return addSecurityAndCorsHeaders(errorResponse, origin);
    }
    const userDataStr = await env.ACCESSIBILITY_AUTH.get(`user_data_${siteId}`);
    if (!userDataStr) {
      const errorResponse = secureJsonResponse({ error: "No subscription found for this site" }, 404);
      return addSecurityAndCorsHeaders(errorResponse, origin);
    }
    const userData = JSON.parse(userDataStr);
    console.log("\u{1F525} Backend: User data from KV:", {
      subscriptionId: userData.subscriptionId,
      paymentStatus: userData.paymentStatus,
      currentPeriodEnd: userData.currentPeriodEnd
    });
    let subscriptionDetails = null;
    if (userData.subscriptionId) {
      console.log("\u{1F525} Backend: Fetching Stripe subscription:", userData.subscriptionId);
      try {
        const subscriptionResponse = await fetch(`https://api.stripe.com/v1/subscriptions/${userData.subscriptionId}`, {
          headers: {
            Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`
          }
        });
        console.log("\u{1F525} Backend: Stripe API response status:", subscriptionResponse.status);
        if (subscriptionResponse.ok) {
          subscriptionDetails = await subscriptionResponse.json();
          const currentPeriodEnd = subscriptionDetails.items && subscriptionDetails.items.data && subscriptionDetails.items.data.length > 0 ? subscriptionDetails.items.data[0].current_period_end : null;
          console.log("\u{1F525} Backend: Stripe subscription details:", {
            id: subscriptionDetails.id,
            current_period_end: currentPeriodEnd,
            current_period_start: subscriptionDetails.items?.data?.[0]?.current_period_start,
            status: subscriptionDetails.status,
            created: subscriptionDetails.created,
            billing_cycle_anchor: subscriptionDetails.billing_cycle_anchor
          });
          if (currentPeriodEnd) {
            subscriptionDetails.current_period_end = currentPeriodEnd;
            console.log("\u{1F525} Backend: Added current_period_end to subscriptionDetails:", currentPeriodEnd);
          } else {
            console.error("\u{1F525} Backend: Could not extract current_period_end from items!");
          }
        } else {
          const errorText = await subscriptionResponse.text();
          console.error("\u{1F525} Backend: Stripe API error:", subscriptionResponse.status, errorText);
        }
      } catch (error) {
        console.error("\u{1F525} Backend: Failed to fetch subscription details from Stripe:", error);
      }
    } else {
      console.log("\u{1F525} Backend: No subscription ID found in user data");
    }
    const successResponse = secureJsonResponse({
      success: true,
      subscription: {
        id: userData.subscriptionId,
        status: userData.paymentStatus,
        cancelAtPeriodEnd: userData.cancelAtPeriodEnd || false,
        currentPeriodEnd: userData.currentPeriodEnd,
        lastPaymentDate: userData.lastPaymentDate,
        current_period_end: subscriptionDetails ? subscriptionDetails.current_period_end : userData.currentPeriodEnd,
        details: subscriptionDetails
      }
    });
    console.log("\u{1F525} Backend: Returning subscription data:", {
      id: userData.subscriptionId,
      status: userData.paymentStatus,
      currentPeriodEnd: userData.currentPeriodEnd,
      current_period_end: subscriptionDetails ? subscriptionDetails.current_period_end : userData.currentPeriodEnd,
      details: subscriptionDetails ? {
        current_period_end: subscriptionDetails.current_period_end,
        status: subscriptionDetails.status
      } : null
    });
    return addSecurityAndCorsHeaders(successResponse, origin);
  } catch (error) {
    console.error("Get subscription status error:", error);
    const errorResponse = secureJsonResponse({
      error: "Failed to get subscription status",
      details: error.message
    }, 500);
    return addSecurityAndCorsHeaders(errorResponse, origin);
  }
}
__name(handleGetSubscriptionStatus, "handleGetSubscriptionStatus");
async function handleUpdateSubscriptionMetadata(request, env) {
  const origin = request.headers.get("origin");
  try {
    const { siteId, subscriptionId, metadata } = await request.json();
    if (!siteId || !subscriptionId || !metadata) {
      const errorResponse = secureJsonResponse({ error: "Missing required fields" }, 400);
      return addSecurityAndCorsHeaders(errorResponse, origin);
    }
    console.log("Updating subscription metadata:", { siteId, subscriptionId, metadata });
    const existingSubscriptionResponse = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`
      }
    });
    if (!existingSubscriptionResponse.ok) {
      const errorText = await existingSubscriptionResponse.text();
      console.error("Failed to retrieve existing subscription:", errorText);
      const errorResponse = secureJsonResponse({
        error: "Failed to retrieve subscription",
        details: errorText
      }, 400);
      return addSecurityAndCorsHeaders(errorResponse, origin);
    }
    const existingSubscription = await existingSubscriptionResponse.json();
    const existingMetadata = existingSubscription.metadata || {};
    const mergedMetadata = {
      ...existingMetadata,
      ...metadata,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    console.log("Merged metadata:", mergedMetadata);
    const formData = new URLSearchParams();
    Object.entries(mergedMetadata).forEach(([key, value]) => {
      formData.append(`metadata[${key}]`, value);
    });
    const updateResponse = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: formData
    });
    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error("Failed to update subscription metadata:", errorText);
      const errorResponse = secureJsonResponse({
        error: "Failed to update subscription metadata",
        details: errorText
      }, 400);
      return addSecurityAndCorsHeaders(errorResponse, origin);
    }
    const updatedSubscription = await updateResponse.json();
    console.log("Subscription metadata updated successfully:", updatedSubscription.metadata);
    try {
      const userDataStr = await env.ACCESSIBILITY_AUTH.get(`user_data_${siteId}`);
      if (userDataStr) {
        const userData = JSON.parse(userDataStr);
        userData.domain = metadata.domain || userData.domain;
        userData.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
        await env.ACCESSIBILITY_AUTH.put(`user_data_${siteId}`, JSON.stringify(userData));
        console.log("Updated user_data with new domain:", userData.domain);
      }
      const paymentSnapshotStr = await env.ACCESSIBILITY_AUTH.get(`payment:${siteId}`);
      if (paymentSnapshotStr) {
        const paymentSnapshot = JSON.parse(paymentSnapshotStr);
        paymentSnapshot.metadata = mergedMetadata;
        paymentSnapshot.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
        await env.ACCESSIBILITY_AUTH.put(`payment:${siteId}`, JSON.stringify(paymentSnapshot));
        console.log("Updated payment snapshot with new metadata");
      }
      if (metadata.domain) {
        const domainKey = `domain:${metadata.domain}`;
        await env.ACCESSIBILITY_AUTH.put(domainKey, JSON.stringify({
          siteId,
          domain: metadata.domain,
          connectedAt: (/* @__PURE__ */ new Date()).toISOString(),
          lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
        }), { expirationTtl: 86400 * 30 });
        console.log("Updated domain mapping for:", metadata.domain);
      }
    } catch (kvError) {
      console.warn("Failed to update KV store:", kvError);
    }
    const successResponse = secureJsonResponse({
      success: true,
      subscription: {
        id: updatedSubscription.id,
        metadata: updatedSubscription.metadata
      }
    });
    return addSecurityAndCorsHeaders(successResponse, origin);
  } catch (error) {
    console.error("Update subscription metadata error:", error);
    const errorResponse = secureJsonResponse({
      error: "Failed to update subscription metadata",
      details: error.message
    }, 500);
    return addSecurityAndCorsHeaders(errorResponse, origin);
  }
}
__name(handleUpdateSubscriptionMetadata, "handleUpdateSubscriptionMetadata");
async function handleRemoveWidget(request, env) {
  const origin = request.headers.get("origin");
  try {
    const { siteId, domain, subscriptionId } = await request.json();
    if (!siteId || !domain || !subscriptionId) {
      const errorResponse = secureJsonResponse({ error: "Missing required fields" }, 400);
      return addSecurityAndCorsHeaders(errorResponse, origin);
    }
    console.log("\u{1F525} Backend: Removing widget from domain:", domain, "siteId:", siteId);
    const domainKey = `domain:${domain}`;
    await env.ACCESSIBILITY_AUTH.delete(domainKey);
    console.log("\u{1F525} Backend: Removed domain mapping for:", domain);
    try {
      const allKeys = await env.ACCESSIBILITY_AUTH.list({ prefix: "domain:" });
      for (const key of allKeys.keys) {
        const domainData = await env.ACCESSIBILITY_AUTH.get(key.name);
        if (domainData) {
          const domainInfo = JSON.parse(domainData);
          if (domainInfo.siteId === siteId && domainInfo.domain !== domain) {
            console.log("\u{1F525} Backend: Removing conflicting domain mapping:", key.name, "for siteId:", siteId);
            await env.ACCESSIBILITY_AUTH.delete(key.name);
          }
        }
      }
    } catch (error) {
      console.log("\u{1F525} Backend: Could not clean up conflicting domain mappings:", error);
    }
    const userDataStr = await env.ACCESSIBILITY_AUTH.get(`user_data_${siteId}`);
    if (userDataStr) {
      const userData = JSON.parse(userDataStr);
      userData.previousDomain = userData.domain;
      userData.domain = null;
      userData.widgetRemovedAt = (/* @__PURE__ */ new Date()).toISOString();
      await env.ACCESSIBILITY_AUTH.put(`user_data_${siteId}`, JSON.stringify(userData));
      console.log("\u{1F525} Backend: Updated user data - widget removed from domain");
    }
    const paymentSnapshotStr = await env.ACCESSIBILITY_AUTH.get(`payment:${siteId}`);
    if (paymentSnapshotStr) {
      const paymentSnapshot = JSON.parse(paymentSnapshotStr);
      paymentSnapshot.previousDomain = paymentSnapshot.domain;
      paymentSnapshot.domain = null;
      paymentSnapshot.widgetRemovedAt = (/* @__PURE__ */ new Date()).toISOString();
      await env.ACCESSIBILITY_AUTH.put(`payment:${siteId}`, JSON.stringify(paymentSnapshot));
      console.log("\u{1F525} Backend: Updated payment snapshot - widget removed");
    }
    const successResponse = secureJsonResponse({
      success: true,
      message: "Widget removed from domain successfully",
      domain,
      removedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    return addSecurityAndCorsHeaders(successResponse, origin);
  } catch (error) {
    console.error("\u{1F525} Backend: Remove widget error:", error);
    const errorResponse = secureJsonResponse({
      error: "Failed to remove widget from domain",
      details: error.message
    }, 500);
    return addSecurityAndCorsHeaders(errorResponse, origin);
  }
}
__name(handleRemoveWidget, "handleRemoveWidget");
async function handleInstallWidget(request, env) {
  const origin = request.headers.get("origin");
  try {
    const { siteId, domain, subscriptionId } = await request.json();
    if (!siteId || !domain || !subscriptionId) {
      const errorResponse = secureJsonResponse({ error: "Missing required fields" }, 400);
      return addSecurityAndCorsHeaders(errorResponse, origin);
    }
    console.log("\u{1F525} Backend: Installing widget on domain:", domain, "siteId:", siteId);
    const domainKey = `domain:${domain}`;
    await env.ACCESSIBILITY_AUTH.put(domainKey, JSON.stringify({
      siteId,
      domain,
      subscriptionId,
      connectedAt: (/* @__PURE__ */ new Date()).toISOString(),
      lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
    }), { expirationTtl: 86400 * 30 });
    console.log("\u{1F525} Backend: Created domain mapping for:", domain);
    const userDataStr = await env.ACCESSIBILITY_AUTH.get(`user_data_${siteId}`);
    if (userDataStr) {
      const userData = JSON.parse(userDataStr);
      userData.previousDomain = userData.domain;
      userData.domain = domain;
      userData.widgetInstalledAt = (/* @__PURE__ */ new Date()).toISOString();
      userData.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
      await env.ACCESSIBILITY_AUTH.put(`user_data_${siteId}`, JSON.stringify(userData));
      console.log("\u{1F525} Backend: Updated user data with new domain:", domain);
    }
    const paymentSnapshotStr = await env.ACCESSIBILITY_AUTH.get(`payment:${siteId}`);
    if (paymentSnapshotStr) {
      const paymentSnapshot = JSON.parse(paymentSnapshotStr);
      paymentSnapshot.previousDomain = paymentSnapshot.domain;
      paymentSnapshot.domain = domain;
      paymentSnapshot.widgetInstalledAt = (/* @__PURE__ */ new Date()).toISOString();
      paymentSnapshot.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
      await env.ACCESSIBILITY_AUTH.put(`payment:${siteId}`, JSON.stringify(paymentSnapshot));
      console.log("\u{1F525} Backend: Updated payment snapshot with new domain");
    }
    try {
      const formData = new URLSearchParams();
      formData.append("metadata[domain]", domain);
      formData.append("metadata[domainInstalledAt]", (/* @__PURE__ */ new Date()).toISOString());
      const updateResponse = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.STRIPE_SECRET_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: formData
      });
      if (updateResponse.ok) {
        console.log("\u{1F525} Backend: Updated Stripe subscription metadata with new domain");
      } else {
        console.warn("\u{1F525} Backend: Failed to update Stripe subscription metadata");
      }
    } catch (stripeError) {
      console.warn("\u{1F525} Backend: Stripe metadata update failed:", stripeError);
    }
    const successResponse = secureJsonResponse({
      success: true,
      message: "Widget installed on domain successfully",
      domain,
      installedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    return addSecurityAndCorsHeaders(successResponse, origin);
  } catch (error) {
    console.error("\u{1F525} Backend: Install widget error:", error);
    const errorResponse = secureJsonResponse({
      error: "Failed to install widget on domain",
      details: error.message
    }, 500);
    return addSecurityAndCorsHeaders(errorResponse, origin);
  }
}
__name(handleInstallWidget, "handleInstallWidget");
async function handleFixDomainMapping(request, env) {
  const origin = request.headers.get("origin");
  try {
    const { domain, siteId } = await request.json();
    if (!domain || !siteId) {
      const errorResponse = secureJsonResponse({ error: "Missing domain or siteId" }, 400);
      return addSecurityAndCorsHeaders(errorResponse, origin);
    }
    console.log("Fixing domain mapping for:", domain, "siteId:", siteId);
    const domainKey = `domain:${domain}`;
    await env.ACCESSIBILITY_AUTH.put(domainKey, JSON.stringify({
      siteId,
      domain,
      connectedAt: (/* @__PURE__ */ new Date()).toISOString(),
      lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
    }), { expirationTtl: 86400 * 30 });
    console.log("Domain mapping created successfully for:", domain);
    const successResponse = secureJsonResponse({
      success: true,
      message: "Domain mapping created successfully",
      domain,
      siteId
    });
    return addSecurityAndCorsHeaders(successResponse, origin);
  } catch (error) {
    console.error("Error in handleFixDomainMapping:", error);
    const errorResponse = secureJsonResponse({ error: "Failed to fix domain mapping" }, 500);
    return addSecurityAndCorsHeaders(errorResponse, origin);
  }
}
__name(handleFixDomainMapping, "handleFixDomainMapping");
async function handleDebugPayment(request, env) {
  const origin = request.headers.get("origin");
  try {
    const url = new URL(request.url);
    const siteId = url.searchParams.get("siteId");
    if (!siteId) {
      const errorResponse = secureJsonResponse({ error: "Missing siteId parameter" }, 400);
      return addSecurityAndCorsHeaders(errorResponse, origin);
    }
    console.log("Debug payment data for siteId:", siteId);
    const paymentKey = `payment:${siteId}`;
    const userDataKey = `user_data_${siteId}`;
    const authDataKey = `auth-data:${siteId}`;
    const paymentData = await env.ACCESSIBILITY_AUTH.get(paymentKey);
    const userData = await env.ACCESSIBILITY_AUTH.get(userDataKey);
    const authData = await env.ACCESSIBILITY_AUTH.get(authDataKey);
    const debugInfo = {
      siteId,
      paymentData: paymentData ? JSON.parse(paymentData) : null,
      userData: userData ? JSON.parse(userData) : null,
      authData: authData ? JSON.parse(authData) : null,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    console.log("Debug payment info:", debugInfo);
    const successResponse = secureJsonResponse(debugInfo);
    return addSecurityAndCorsHeaders(successResponse, origin);
  } catch (error) {
    console.error("Error in handleDebugPayment:", error);
    const errorResponse = secureJsonResponse({ error: "Failed to debug payment data" }, 500);
    return addSecurityAndCorsHeaders(errorResponse, origin);
  }
}
__name(handleDebugPayment, "handleDebugPayment");
async function handleReactivateSubscription(request, env) {
  const origin = request.headers.get("origin");
  try {
    const { siteId } = await request.json();
    if (!siteId) {
      const errorResponse = secureJsonResponse({ error: "Missing siteId" }, 400);
      return addSecurityAndCorsHeaders(errorResponse, origin);
    }
    console.log("Reactivating subscription for siteId:", siteId);
    const userDataStr = await env.ACCESSIBILITY_AUTH.get(`user_data_${siteId}`);
    if (userDataStr) {
      const userData = JSON.parse(userDataStr);
      userData.paymentStatus = "active";
      userData.lastPaymentDate = (/* @__PURE__ */ new Date()).toISOString();
      userData.currentPeriodStart = Math.floor(Date.now() / 1e3);
      userData.currentPeriodEnd = Math.floor(Date.now() / 1e3) + 365 * 24 * 60 * 60;
      userData.cancelAtPeriodEnd = false;
      userData.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
      await env.ACCESSIBILITY_AUTH.put(`user_data_${siteId}`, JSON.stringify(userData));
      console.log("Updated user_data_${siteId} with active status");
    }
    const paymentSnapshotStr = await env.ACCESSIBILITY_AUTH.get(`payment:${siteId}`);
    if (paymentSnapshotStr) {
      const paymentSnapshot = JSON.parse(paymentSnapshotStr);
      paymentSnapshot.status = "active";
      paymentSnapshot.lastPaymentDate = (/* @__PURE__ */ new Date()).toISOString();
      paymentSnapshot.currentPeriodStart = Math.floor(Date.now() / 1e3);
      paymentSnapshot.currentPeriodEnd = Math.floor(Date.now() / 1e3) + 365 * 24 * 60 * 60;
      paymentSnapshot.cancelAtPeriodEnd = false;
      paymentSnapshot.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
      await env.ACCESSIBILITY_AUTH.put(`payment:${siteId}`, JSON.stringify(paymentSnapshot));
      console.log("Updated payment:${siteId} with active status");
    }
    const successResponse = secureJsonResponse({
      success: true,
      message: "Subscription reactivated successfully",
      siteId,
      status: "active",
      validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1e3).toISOString()
    });
    return addSecurityAndCorsHeaders(successResponse, origin);
  } catch (error) {
    console.error("Error in handleReactivateSubscription:", error);
    const errorResponse = secureJsonResponse({ error: "Failed to reactivate subscription" }, 500);
    return addSecurityAndCorsHeaders(errorResponse, origin);
  }
}
__name(handleReactivateSubscription, "handleReactivateSubscription");

// ../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-9N25hX/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// ../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-9N25hX/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=worker.js.map
