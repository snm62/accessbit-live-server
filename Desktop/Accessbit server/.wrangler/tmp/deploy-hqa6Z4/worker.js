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
    if (url.pathname === "/api/accessibility/register-script") {
      return handleRegisterScript(request, env);
    }
    if (url.pathname === "/api/accessibility/apply-script") {
      return handleApplyScript(request, env);
    }
    if (url.pathname === "/api/accessibility/config" && request.method === "GET") {
      return handleGetConfig(request, env);
    }
    if (url.pathname === "/api/accessibility/domain-lookup" && request.method === "GET") {
      return handleDomainLookup(request, env);
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
    const userId = userData.id || userData.email || `user_${Date.now()}`;
    const sessionToken = await createSessionToken({ ...userData, id: userId }, env);
    if (isDesigner) {
      const siteIdFromState = state.includes("_") ? state.split("_")[1] : null;
      let currentSite;
      if (siteIdFromState) {
        currentSite = sites.find((site) => site.id === siteIdFromState) || sites[0];
      } else {
        currentSite = sites[0];
      }
      const userId2 = userData.id || userData.email || `user_${Date.now()}`;
      await env.ACCESSIBILITY_AUTH.put(`user-auth:${userId2}`, JSON.stringify({
        accessToken: tokenData.access_token,
        userData: {
          id: userId2,
          email: userData.email,
          firstName: userData.firstName
        },
        siteId: currentSite.id,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      }), { expirationTtl: 86400 });
      await env.ACCESSIBILITY_AUTH.put(`Accessibility-Settings:${currentSite.id}`, JSON.stringify({
        accessToken: tokenData.access_token,
        siteName: currentSite.name || currentSite.shortName || "Unknown Site",
        siteId: currentSite.id,
        user: userData,
        installedAt: (/* @__PURE__ */ new Date()).toISOString(),
        customization: {},
        accessibilityProfiles: {},
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
              
              // Store siteId in sessionStorage for the widget to use
              sessionStorage.setItem('accessibility_site_id', '${currentSite.id}');
              console.log('Stored siteId in sessionStorage:', '${currentSite.id}');
              
              window.opener.postMessage(sessionData, '*');
              window.close();
            <\/script>
          </body>
        </html>`, {
        headers: { "Content-Type": "text/html" }
      });
    }
    console.log("Apps & Integrations: Determining correct site for data storage...");
    let targetSite = sites[0];
    if (appsIntegrationsSiteInfo) {
      console.log("Apps & Integrations: Using site info from state parameter:", appsIntegrationsSiteInfo);
      const foundSite = sites.find((site) => site.shortName === appsIntegrationsSiteInfo);
      if (foundSite) {
        targetSite = foundSite;
        console.log("Apps & Integrations: Found matching site from state:", foundSite.id, foundSite.name || foundSite.shortName);
      } else {
        console.log("Apps & Integrations: No matching site found for state shortName:", appsIntegrationsSiteInfo);
      }
    } else {
      const referrer = request.headers.get("referer") || "";
      console.log("Apps & Integrations: No state site info, trying referrer:", referrer);
      if (referrer.includes(".design.webflow.com")) {
        const match = referrer.match(/([^.]+)\.design\.webflow\.com/);
        if (match) {
          const shortName = match[1];
          console.log("Apps & Integrations: Found shortName from referrer:", shortName);
          const foundSite = sites.find((site) => site.shortName === shortName);
          if (foundSite) {
            targetSite = foundSite;
            console.log("Apps & Integrations: Found matching site from referrer:", foundSite.id, foundSite.name || foundSite.shortName);
          }
        }
      }
    }
    console.log("Apps & Integrations: Storing data for site:", targetSite.id, targetSite.name || targetSite.shortName);
    await env.ACCESSIBILITY_AUTH.put(`Accessibility-Settings:${targetSite.id}`, JSON.stringify({
      accessToken: tokenData.access_token,
      siteName: targetSite.name || targetSite.shortName || "Unknown Site",
      siteId: targetSite.id,
      user: userData,
      installedAt: (/* @__PURE__ */ new Date()).toISOString(),
      customization: {},
      accessibilityProfiles: {},
      widgetVersion: "1.0.0",
      lastUsed: (/* @__PURE__ */ new Date()).toISOString()
    }), { expirationTtl: 86400 });
    try {
      if (targetSite.shortName) {
        const webflowSubdomain = `${targetSite.shortName}.webflow.io`;
        const domainKey = `domain:${webflowSubdomain}`;
        await env.ACCESSIBILITY_AUTH.put(domainKey, JSON.stringify({
          siteId: targetSite.id,
          domain: webflowSubdomain,
          isPrimary: true,
          isWebflowSubdomain: true,
          connectedAt: (/* @__PURE__ */ new Date()).toISOString()
        }), { expirationTtl: 86400 * 30 });
        console.log("Apps & Integrations: Stored Webflow subdomain mapping:", webflowSubdomain, "->", targetSite.id);
      }
    } catch (domainError) {
      console.warn("Apps & Integrations: Failed to store subdomain mapping:", domainError);
    }
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
            // Store site info in session storage for the correct site
            sessionStorage.setItem('wf_hybrid_user', JSON.stringify({
              sessionToken: '${sessionToken.token}',
              firstName: '${userData.firstName || "User"}',
              email: '${userData.email}',
              exp: Date.now() + (24 * 60 * 60 * 1000),
              siteInfo: {
                siteId: '${targetSite.id}',
                siteName: '${targetSite.name || targetSite.shortName || "Unknown Site"}',
                shortName: '${targetSite.shortName}',
                url: '${targetSite.url || `https://${targetSite.shortName}.webflow.io`}'
              }
            }));
            
            // Also store siteId directly for easy access by the widget
            sessionStorage.setItem('accessibility_site_id', '${targetSite.id}');
            console.log('Apps & Integrations: Stored siteId in sessionStorage:', '${targetSite.id}');
            
            // Redirect to the correct site after a short delay
            setTimeout(() => {
              window.location.href = 'https://${targetSite.shortName}.design.webflow.com?app=${env.WEBFLOW_CLIENT_ID}';
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
      publishedAt
    } = body;
    console.log(`[PUBLISH] ${requestId} Auth result:`, JSON.stringify(authResult, null, 2));
    console.log(`[PUBLISH] ${requestId} User data from auth:`, authResult.userData);
    console.log(`[PUBLISH] ${requestId} Site name from auth:`, authResult.siteName);
    const dataToStore = {
      // Authorization data
      accessToken: authResult.accessToken,
      user: {
        email: authResult.userData?.email || "unknown@example.com",
        firstName: authResult.userData?.firstName || "Unknown",
        id: authResult.userData?.id || "unknown"
      },
      // Site info
      siteId,
      siteName: authResult.siteName || "Unknown Site",
      // Customization data from frontend
      customization: customization || {},
      accessibilityProfiles: accessibilityProfiles || [],
      customDomain: customDomain || null,
      // Metadata
      publishedAt: publishedAt || (/* @__PURE__ */ new Date()).toISOString(),
      lastUpdated: (/* @__PURE__ */ new Date()).toISOString(),
      lastUsed: (/* @__PURE__ */ new Date()).toISOString(),
      widgetVersion: "1.0.0"
    };
    const kvKey = `Accessibility-Settings:${siteId}`;
    console.log(`[PUBLISH] ${requestId} Storing data with key: ${kvKey}`);
    console.log(`[PUBLISH] ${requestId} Data to store:`, JSON.stringify(dataToStore, null, 2));
    await env.ACCESSIBILITY_AUTH.put(kvKey, JSON.stringify(dataToStore));
    try {
      const domainsResponse = await fetch(`https://api.webflow.com/v2/sites/${siteId}/domains`, {
        headers: {
          "Authorization": `Bearer ${authResult.accessToken}`,
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
            isPrimary: domain.isPrimary || false,
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
          "Authorization": `Bearer ${authResult.accessToken}`,
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
        customization: dataToStore.customization,
        accessibilityProfiles: dataToStore.accessibilityProfiles,
        customDomain: dataToStore.customDomain,
        publishedAt: dataToStore.publishedAt
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
  const url = new URL(request.url);
  const urlSiteId = url.searchParams.get("siteId");
  const siteId = urlSiteId || authResult.siteId;
  if (!siteId) {
    return new Response(JSON.stringify({ error: "No siteId provided" }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
      }
    });
  }
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
async function handleRegisterScript(request, env) {
  try {
    console.log("=== REGISTER SCRIPT DEBUG START ===");
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
    const url = new URL(request.url);
    const urlSiteId = url.searchParams.get("siteId");
    const siteId = urlSiteId || authResult.siteId;
    console.log("Authentication successful, using siteId:", siteId, `(from ${urlSiteId ? "URL parameter" : "auth result"})`);
    if (!siteId) {
      console.log("No siteId available for script registration");
      return new Response(JSON.stringify({ error: "No siteId provided" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
    const scriptUrl = "https://cdn.jsdelivr.net/gh/snm62/accessibility-test@3d026ef/accessibility-widget.js";
    const existingScriptsResponse = await fetch(`https://api.webflow.com/v2/sites/${siteId}/registered_scripts`, {
      headers: {
        "Authorization": `Bearer ${authResult.accessToken}`,
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
    const registerResponse = await fetch(`https://api.webflow.com/v2/sites/${authResult.siteId}/registered_scripts/hosted`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${authResult.accessToken}`,
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
          "Accessibility-Allow-Origin": "*"
        }
      });
    }
    const requestBody = await request.json();
    const { targetType, scriptId, location, version, skipApplyScript } = requestBody;
    console.log("script request body:", requestBody);
    if (skipApplyScript) {
      console.log("skipApplyScript is true, skipping script application");
      return new Response(JSON.stringify({
        success: true,
        message: "Script application skipped as requested",
        skipped: true
      }), {
        headers: {
          "Content-Type": "application/json",
          "Accessibility-Allow-Origin": "*"
        }
      });
    }
    const existingResponse = await fetch(`https://api.webflow.com/v2/sites/${authResult.siteId}/custom_code`, {
      headers: {
        "Authorization": `Bearer ${authResult.accessToken}`,
        "accept-version": "2.0.0"
      }
    });
    console.log("existing response status:", existingResponse.status);
    const already_registered_scripts = await fetch(`https://api.webflow.com/v2/sites/${authResult.siteId}/registered_scripts`, {
      headers: {
        "Authorization": `Bearer ${authResult.accessToken}`
      }
    });
    console.log(already_registered_scripts.registeredScripts, "already registered script");
    let existingScripts = [];
    if (existingResponse.ok) {
      const existingData = await existingResponse.json();
      existingScripts = existingData.scripts || [];
    }
    const scriptUrl = "https://cdn.jsdelivr.net/gh/snm62/accessibility-test@3d026ef/accessibility-widget.js";
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
          "Accessibility-Allow-Origin": "*"
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
    const updateResponse = await fetch(`https://api.webflow.com/v2/sites/${authResult.siteId}/custom_code`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${authResult.accessToken}`,
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
        "Accessibility-Allow-Origin": "*"
      }
    });
  } catch (error) {
    console.error("Apply script error:", error);
    return new Response(JSON.stringify({ error: "Failed to apply script" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Accessibility-Allow-Origin": "*"
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
    let siteName = "Unknown Site";
    try {
      const siteData = await env.ACCESSIBILITY_AUTH.get(`Accessibility-Settings:${siteId}`);
      if (siteData) {
        const parsedSiteData = JSON.parse(siteData);
        siteName = parsedSiteData.siteName || "Unknown Site";
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
async function handleGetConfig(request, env) {
  try {
    const url = new URL(request.url);
    const siteId = url.searchParams.get("siteId");
    if (!siteId) {
      return new Response(JSON.stringify({
        error: "Missing siteId parameter"
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }
    const kvKey = `Accessibility-Settings:${siteId}`;
    const storedData = await env.ACCESSIBILITY_AUTH.get(kvKey);
    if (!storedData) {
      return new Response(JSON.stringify({
        error: "Site configuration not found"
      }), {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }
    const siteData = JSON.parse(storedData);
    const config = {
      customization: siteData.customization || {},
      accessibilityProfiles: siteData.accessibilityProfiles || [],
      siteId,
      publishedAt: siteData.publishedAt,
      widgetVersion: siteData.widgetVersion || "1.0.0"
    };
    return new Response(JSON.stringify(config), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Cache-Control": "public, max-age=300"
        // Cache for 5 minutes
      }
    });
  } catch (error) {
    console.error("Get config error:", error);
    return new Response(JSON.stringify({
      error: "Failed to get configuration",
      details: error.message
    }), {
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
__name(handleGetConfig, "handleGetConfig");
async function handleDomainLookup(request, env) {
  try {
    const url = new URL(request.url);
    const domain = url.searchParams.get("domain");
    console.log("Domain lookup request for:", domain);
    if (!domain) {
      return new Response(JSON.stringify({ error: "Missing domain parameter" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }
    const domainKey = `domain:${domain}`;
    const domainData = await env.ACCESSIBILITY_AUTH.get(domainKey);
    if (domainData) {
      const data = JSON.parse(domainData);
      console.log("Found domain mapping:", data);
      return new Response(JSON.stringify({
        siteId: data.siteId,
        domain: data.domain,
        isPrimary: data.isPrimary
      }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }
    console.log("No domain mapping found for:", domain);
    return new Response(JSON.stringify({ error: "Domain not found" }), {
      status: 404,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      }
    });
  } catch (error) {
    console.error("Domain lookup error:", error);
    return new Response(JSON.stringify({ error: "Lookup failed" }), {
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
__name(handleDomainLookup, "handleDomainLookup");
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map
