var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker.js
var securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains"
};
async function handleCheckInstallation(request, env) {
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
    console.log("\u{1F50D} Checking if installation exists for siteId:", siteId);
    const installationKey = `installation_${siteId}`;
    const installationRecord = await env.ACCESSIBILITY_AUTH.get(installationKey);
    if (!installationRecord) {
      console.log("\u274C Installation record not found for siteId:", siteId);
      const response2 = secureJsonResponse({ exists: false }, 404);
      return addSecurityAndCorsHeaders(response2, origin);
    }
    console.log("\u2705 Installation record found for siteId:", siteId);
    const response = secureJsonResponse({ exists: true });
    return addSecurityAndCorsHeaders(response, origin);
  } catch (error) {
    console.error("\u274C Error checking installation:", error);
    const errorResponse = secureJsonResponse({
      error: "Failed to check installation",
      details: error.message
    }, 500);
    return addSecurityAndCorsHeaders(errorResponse, origin);
  }
}
__name(handleCheckInstallation, "handleCheckInstallation");
async function sendWelcomeEmail(env, email, firstName) {
  try {
    if (!email || !email.includes("@")) {
      console.warn("[SIGNUP] Invalid email for Brevo welcome email:", email);
      return false;
    }
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": env.BREVO_API_KEY,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        sender: {
          name: "AccessBit Team",
          email: "web@accessbit.io"
        },
        to: [{
          email,
          name: firstName || (email.split("@")[0] || "User")
        }],
        subject: "Thanks for installing AccessBit on Webflow",
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <p>Hi ${firstName || (email.split("@")[0] || "User")},</p>
            <p>Thank you for installing the Accessbit app on your Webflow website! We're excited to have you onboard.</p>
            <p><strong>Important note:</strong> If you plan to publish your site to a custom domain, you'll need to upgrade to the paid plan.</p>
            <p><strong>Check out the installation videos:</strong></p>
            <ul>
              <li><a href="https://vimeo.com/1170089748" style="color:#007BFF; text-decoration:none;">AccessBit Installation part 1</a></li>
              <li><a href="https://vimeo.com/1170089799" style="color:#007BFF; text-decoration:none;">AccessBit Installation part 2</a></li>
              <li><a href="https://vimeo.com/1170089848" style="color:#007BFF; text-decoration:none;">AccessBit Installation part 3</a></li>
            </ul>
            <p>If you have any questions, visit our <a href="https://www.accessbit.io/help-center" style="color:#007BFF; text-decoration:none;">AccessBit Help Center</a> for guides and FAQs.</p>
            <p>Need assistance? We've got you covered:</p>
            <ul>
              <li>Email us anytime at <a href="mailto:web@accessbit.io" style="color:#007BFF;">web@accessbit.io</a></li>
              <li>Book a quick support call directly.</li>
              <li>Fill out our contact form and we'll get back to you shortly.</li>
            </ul>
            <p>We're excited to support you in creating an inclusive, accessible experience for all users and meeting global accessibility standards. If you have questions, feature suggestions, or need any assistance, we're always just a message away.</p>
            <p>Thanks again,<br><strong>The AccessBit Team</strong></p>
          </div>
        `,
        textContent: `Hi ${firstName || (email.split("@")[0] || "User")},

Thank you for installing the Accessbit app on your Webflow website! We're excited to have you onboard.

Important note: If you plan to publish your site to a custom domain, you'll need to upgrade to the paid plan.

Check out the installation videos:
- AccessBit Installation part 1
- AccessBit Installation part 2
- AccessBit Installation part 3

If you have any questions, visit our AccessBit Help Center for guides and FAQs: https://www.accessbit.io/help-center

Need assistance? We've got you covered:
- Email us anytime at web@accessbit.io
- Book a quick support call directly.
- Fill out our contact form and we'll get back to you shortly.

We're excited to support you in creating an inclusive, accessible experience for all users and meeting global accessibility standards. If you have questions, feature suggestions, or need any assistance, we're always just a message away.

Thanks again,
The AccessBit Team`,
        tags: ["welcome", "signup"]
      })
    });
    if (response.ok) {
      const result = await response.json().catch(() => ({}));
      console.log(`[SIGNUP] Brevo welcome email sent: ${email} \u2192 MessageId: ${result.messageId || "n/a"}`);
      return true;
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.warn(`[SIGNUP] Brevo error (${response.status}):`, errorData);
      return false;
    }
  } catch (err) {
    console.error(`[SIGNUP] Brevo send failed for ${email}:`, err);
    return false;
  }
}
__name(sendWelcomeEmail, "sendWelcomeEmail");
async function handleWebflowAppInstallation(request, env) {
  const origin = request.headers.get("origin");
  const ip = getClientIp(request);
  const ipOk = await checkRateLimit(env, "app-installed-ip", ip, 10, 60);
  if (!ipOk) {
    return addSecurityAndCorsHeaders(new Response(JSON.stringify({ error: "Too many requests", retryAfter: 60 }), {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": "60" }
    }), origin);
  }
  try {
    console.log("\u{1F50D} Starting installation webhook handler");
    const requestBody = await request.text();
    console.log("\u{1F4E6} Raw request body:", requestBody);
    let parsedData;
    try {
      parsedData = JSON.parse(requestBody);
    } catch (parseError) {
      console.error("\u274C Failed to parse JSON:", parseError);
      const errorResponse = secureJsonResponse({
        error: "Invalid JSON in request body",
        details: parseError.message
      }, 400);
      return addSecurityAndCorsHeaders(errorResponse, origin);
    }
    console.log("\u2705 Parsed data:", JSON.stringify(parsedData, null, 2));
    const { siteId: topLevelSiteId, userId, userEmail, siteName: topLevelSiteName, firstName: topLevelFirstName, installationData } = parsedData;
    const siteId = topLevelSiteId || installationData?.siteId || null;
    const siteName = topLevelSiteName || installationData?.siteName || null;
    const firstName = installationData?.firstName && installationData.firstName.trim() || topLevelFirstName && topLevelFirstName.trim() || userEmail && userEmail.split("@")[0] || "User";
    if (!siteId || !userEmail) {
      console.error("\u274C Missing required fields: siteId or userEmail");
      const errorResponse = secureJsonResponse({
        error: "Missing required fields: siteId and userEmail are required"
      }, 400);
      return addSecurityAndCorsHeaders(errorResponse, origin);
    }
    const siteOk = await checkRateLimit(env, "app-installed-site", siteId, 5, 60);
    if (!siteOk) {
      return addSecurityAndCorsHeaders(new Response(JSON.stringify({ error: "Too many requests", retryAfter: 60 }), {
        status: 429,
        headers: { "Content-Type": "application/json", "Retry-After": "60" }
      }), origin);
    }
    const maskedEmail = userEmail ? userEmail.replace(/([^@]).*(@.*)/, "$1****$2") : "";
    console.log("\u{1F4E4} Preparing to send webhook to Make.com for:", maskedEmail);
    const customDomain2 = installationData?.customDomain || null;
    const shortName = installationData?.shortName || null;
    const stagingUrl = installationData?.stagingUrl || (shortName ? `https://${shortName}.webflow.io` : null);
    const domain = customDomain2 || stagingUrl;
    const domainHost = domain ? normalizeHost(domain) : null;
    const isStaging = domainHost && (domainHost.includes(".webflow.io") || domainHost.includes(".webflow.com") || domainHost.includes("localhost") || domainHost.includes("127.0.0.1") || domainHost.includes("staging"));
    console.log("\u{1F50D} Domain check:", { domain, domainHost, isStaging });
    let hasActivePayment = false;
    let clickupFolder = null;
    let paymentStatusData = null;
    if (isStaging) {
      clickupFolder = "staging";
      console.log("\u{1F4C1} Staging domain detected, will create task in staging folder");
    } else if (domainHost) {
      console.log("\u{1F4B0} Checking payment status for live domain:", domainHost);
      try {
        const domainKey = `domain:${domainHost}`;
        const customerId = await env.ACCESSIBILITY_AUTH.get(domainKey);
        if (customerId) {
          const customerKey = `customer:${customerId}`;
          const customerDataStr = await env.ACCESSIBILITY_AUTH.get(customerKey);
          if (customerDataStr) {
            const customerData = JSON.parse(customerDataStr);
            hasActivePayment = !!(customerData.paymentStatus === "paid" || customerData.subscriptionStatus === "complete" || customerData.isSubscribed === true || customerData.subscriptionStatus === "active" && customerData.paymentStatus === "paid");
            paymentStatusData = {
              paymentStatus: customerData.paymentStatus || "unknown",
              subscriptionStatus: customerData.subscriptionStatus || "unknown",
              isSubscribed: customerData.isSubscribed || false,
              subscriptionId: customerData.stripeSubscriptionId || null,
              customerId: customerId || null,
              planType: customerData.planType || null
            };
            console.log("\u{1F4B0} Payment status from customer data:", {
              paymentStatus: customerData.paymentStatus,
              subscriptionStatus: customerData.subscriptionStatus,
              isSubscribed: customerData.isSubscribed,
              hasActivePayment
            });
          }
        }
        if (!paymentStatusData && siteId) {
          const paymentRecord = await env.ACCESSIBILITY_AUTH.get(`payment:${siteId}`);
          if (paymentRecord) {
            const paymentData = JSON.parse(paymentRecord);
            hasActivePayment = paymentData.status === "active" || paymentData.paymentStatus === "paid";
            paymentStatusData = {
              paymentStatus: paymentData.paymentStatus || paymentData.status || "unknown",
              subscriptionStatus: paymentData.subscriptionStatus || paymentData.status || "unknown",
              isSubscribed: hasActivePayment,
              subscriptionId: paymentData.subscriptionId || null,
              customerId: paymentData.customerId || null,
              planType: paymentData.planType || null
            };
            console.log("\u{1F4B0} Payment status from siteId payment record:", {
              status: paymentData.status,
              paymentStatus: paymentData.paymentStatus,
              hasActivePayment
            });
          }
        }
        if (hasActivePayment) {
          clickupFolder = "live";
          console.log("\u2705 Active payment found, will create task in live folder");
        } else {
          console.log("\u274C No active payment found, will NOT create ClickUp task for live domain");
        }
      } catch (paymentCheckError) {
        console.error("\u274C Error checking payment status:", paymentCheckError);
      }
    }
    try {
      const clickupWebhookUrl = env.MAKE_CLICKUP_WEBHOOK_URL || "https://hook.us1.make.com/2nq5grcxerkoum85ibdhoayngay6j1hg";
      const webhookPayload = {
        event: "webflow_app_installed",
        // Customer information at top level for easy access
        email: userEmail,
        firstName,
        siteId,
        siteName,
        userId,
        // Additional data from installationData
        customDomain: customDomain2,
        stagingUrl,
        // Include staging URL if available
        shortName,
        exp: installationData?.exp || null,
        timestamp: installationData?.timestamp || (/* @__PURE__ */ new Date()).toISOString(),
        source: installationData?.source || "webflow_app",
        // ClickUp folder information
        clickupFolder,
        isStaging,
        hasActivePayment,
        // Payment status details for router condition in Make.com
        paymentStatus: paymentStatusData?.paymentStatus || "unknown",
        subscriptionStatus: paymentStatusData?.subscriptionStatus || "unknown",
        isSubscribed: paymentStatusData?.isSubscribed || false,
        subscriptionId: paymentStatusData?.subscriptionId || null,
        customerId: paymentStatusData?.customerId || null,
        planType: paymentStatusData?.planType || null,
        // Keep nested structure for backward compatibility
        customer: {
          email: userEmail,
          firstName,
          siteId,
          siteName,
          userId
        },
        installation: {
          timestamp: installationData?.timestamp || (/* @__PURE__ */ new Date()).toISOString(),
          data: installationData || {}
        },
        // Include full siteInfo if available
        siteInfo: installationData?.siteInfo || null
      };
      const payloadToLog = Object.assign({}, webhookPayload, { email: webhookPayload.email ? webhookPayload.email.replace(/([^@]).*(@.*)/, "$1****$2") : webhookPayload.email });
      console.log("\u{1F680} Sending welcome email via Brevo (email masked payload):", JSON.stringify(payloadToLog, null, 2));
      const emailSent = await sendWelcomeEmail(env, userEmail, firstName);
      if (!emailSent) {
        console.warn("\u26A0\uFE0F Brevo welcome email failed or returned false for:", maskedEmail);
      }
      console.log(`\u{1F4C1} Sending to ClickUp webhook with folder: ${clickupFolder || "null (no folder - live domain without payment)"}`);
      const clickupWebhookResponse = await fetch(clickupWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(webhookPayload)
      });
      const clickupWebhookResponseText = await clickupWebhookResponse.text();
      console.log("\u{1F4E8} ClickUp webhook response status:", clickupWebhookResponse.status);
      console.log("\u{1F4E8} ClickUp webhook response body:", clickupWebhookResponseText);
      if (!clickupWebhookResponse.ok) {
        console.error("\u274C ClickUp webhook failed:", clickupWebhookResponse.status, clickupWebhookResponseText);
      } else {
        console.log(`\u2705 ClickUp webhook sent successfully (folder: ${clickupFolder || "null"})`);
      }
    } catch (webhookError) {
      console.error("\u274C Error sending webhook to Make.com:", webhookError);
      console.error("\u274C Webhook error stack:", webhookError.stack);
    }
    const installationRecord = {
      siteId,
      userId,
      userEmail,
      siteName,
      firstName: installationData?.firstName || "User",
      customDomain: customDomain2,
      stagingUrl,
      shortName,
      installedAt: (/* @__PURE__ */ new Date()).toISOString(),
      status: "installed",
      installationData
      // Store full installation data
    };
    await env.ACCESSIBILITY_AUTH.put(`installation_${siteId}`, JSON.stringify(installationRecord));
    if (userEmail) {
      try {
        const emailLower = userEmail.toLowerCase().trim();
        if (env.EMAIL_ENCRYPTION_KEY && env.EMAIL_INDEX_KEY) {
          const encrypted = await encryptEmailServerSide(emailLower, env);
          const emailHash = await computeHmacHex(emailLower, env.EMAIL_INDEX_KEY);
          installationRecord.encryptedEmail = encrypted;
          installationRecord.emailHash = emailHash;
          delete installationRecord.userEmail;
          await env.ACCESSIBILITY_AUTH.put(`installation-email-hash:${emailHash}`, JSON.stringify(installationRecord));
          console.log("\u2705 Stored encrypted installation data under hashed email key:", `installation-email-hash:${emailHash}`);
        } else {
          await env.ACCESSIBILITY_AUTH.put(`installation-email:${emailLower}`, JSON.stringify(installationRecord));
          console.log("\u2705 Stored installation data by email (legacy):", userEmail);
        }
      } catch (encryptionErr) {
        console.error("\u274C Failed to encrypt/store email:", encryptionErr);
        try {
          await env.ACCESSIBILITY_AUTH.put(`installation-email:${userEmail.toLowerCase()}`, JSON.stringify(installationRecord));
        } catch (e) {
        }
      }
    }
    if (customDomain2) {
      await env.ACCESSIBILITY_AUTH.put(`installation-domain:${customDomain2}`, JSON.stringify(installationRecord));
      console.log("\u2705 Stored installation data by domain (raw):", customDomain2);
      const normalizedDomain = normalizeHost(customDomain2);
      if (normalizedDomain && normalizedDomain !== customDomain2) {
        await env.ACCESSIBILITY_AUTH.put(`installation-domain:${normalizedDomain}`, JSON.stringify(installationRecord));
        console.log("\u2705 Stored installation data by domain (normalized):", normalizedDomain);
      }
    }
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
    console.error("\u274C Fatal error in handleWebflowAppInstallation:", error);
    console.error("\u274C Error stack:", error.stack);
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
var AUTH_DATA_ALLOWED_ORIGINS = /* @__PURE__ */ new Set([
  "https://app.accessbit.io",
  "https://accessbit.io",
  "https://accessbit-test.web-8fb.workers.dev",
  "https://accessibility-widget.web-8fb.workers.dev"
]);
function getAllowedAuthDataOrigin(origin) {
  if (!origin || typeof origin !== "string") return null;
  const normalized = origin.replace(/\/+$/, "");
  return AUTH_DATA_ALLOWED_ORIGINS.has(normalized) ? normalized : null;
}
__name(getAllowedAuthDataOrigin, "getAllowedAuthDataOrigin");
function getPublishCorsOrigin(origin) {
  if (!origin || typeof origin !== "string") return "*";
  const normalized = origin.replace(/\/+$/, "");
  try {
    const u = new URL(normalized);
    if (u.protocol !== "https:" && u.protocol !== "http:") return "*";
    if (u.protocol === "http:" && u.hostname !== "localhost" && !u.hostname.startsWith("127.")) return "*";
    return normalized;
  } catch (_) {
    return "*";
  }
}
__name(getPublishCorsOrigin, "getPublishCorsOrigin");
function getClientIp(request) {
  return request.headers.get("CF-Connecting-IP") || (request.headers.get("X-Forwarded-For") || "").split(",")[0].trim() || "unknown";
}
__name(getClientIp, "getClientIp");
async function checkRateLimit(env, prefix, identifier, limit, windowSec) {
  if (!identifier || limit <= 0 || windowSec <= 0) return true;
  const bucket = windowSec <= 1 ? Math.floor(Date.now() / 1e3) : Math.floor(Date.now() / 6e4);
  const key = `ratelimit:${prefix}:${String(identifier).replace(/:/g, "_")}:${bucket}`;
  const raw = await env.ACCESSIBILITY_AUTH.get(key);
  const count = parseInt(raw || "0", 10);
  if (count >= limit) return false;
  const ttl = Math.max(60, windowSec + 60);
  await env.ACCESSIBILITY_AUTH.put(key, String(count + 1), { expirationTtl: ttl });
  return true;
}
__name(checkRateLimit, "checkRateLimit");
function sanitizeAccessibilityStatementLink(link) {
  if (!link || typeof link !== "string") return "";
  const trimmed = link.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    const protocol = url.protocol.toLowerCase();
    if (protocol === "http:" || protocol === "https:") {
      return trimmed;
    }
    return "";
  } catch (e) {
    return "";
  }
}
__name(sanitizeAccessibilityStatementLink, "sanitizeAccessibilityStatementLink");
async function base64ToArrayBuffer(s) {
  const b = atob(s);
  const len = b.length;
  const arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) arr[i] = b.charCodeAt(i);
  return arr.buffer;
}
__name(base64ToArrayBuffer, "base64ToArrayBuffer");
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
__name(arrayBufferToBase64, "arrayBufferToBase64");
async function importAesKeyFromBase64(b64) {
  const raw = await base64ToArrayBuffer(b64);
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}
__name(importAesKeyFromBase64, "importAesKeyFromBase64");
async function importHmacKeyFromBase64(b64) {
  const raw = await base64ToArrayBuffer(b64);
  return crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
__name(importHmacKeyFromBase64, "importHmacKeyFromBase64");
async function encryptEmailServerSide(plaintext, env) {
  if (!env.EMAIL_ENCRYPTION_KEY) throw new Error("EMAIL_ENCRYPTION_KEY not configured");
  const aesKey = await importAesKeyFromBase64(env.EMAIL_ENCRYPTION_KEY);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder().encode(plaintext);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, enc);
  const ciphertextB64 = arrayBufferToBase64(ct);
  const ivB64 = arrayBufferToBase64(iv.buffer);
  return { ciphertext: ciphertextB64, iv: ivB64 };
}
__name(encryptEmailServerSide, "encryptEmailServerSide");
async function decryptEmailServerSide(encryptedObj, env) {
  if (!env.EMAIL_ENCRYPTION_KEY) throw new Error("EMAIL_ENCRYPTION_KEY not configured");
  const aesKey = await importAesKeyFromBase64(env.EMAIL_ENCRYPTION_KEY);
  const ivBuf = await base64ToArrayBuffer(encryptedObj.iv);
  const ctBuf = await base64ToArrayBuffer(encryptedObj.ciphertext);
  const plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(ivBuf) }, aesKey, ctBuf);
  return new TextDecoder().decode(plainBuf);
}
__name(decryptEmailServerSide, "decryptEmailServerSide");
async function computeHmacHex(message, b64Key) {
  if (!b64Key) throw new Error("HMAC key not configured");
  const hmacKey = await importHmacKeyFromBase64(b64Key);
  const data = new TextEncoder().encode(message);
  const sig = await crypto.subtle.sign("HMAC", hmacKey, data);
  const bytes = new Uint8Array(sig);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(computeHmacHex, "computeHmacHex");
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
    if (request.method === "OPTIONS") {
      return handleCORS();
    }
    if (url.pathname === "/api/auth/authorize") {
      return handleOAuthAuthorize(request, env);
    }
    if (url.pathname === "/api/auth/callback") {
      return handleOAuthCallback(request, env);
    }
    if (url.pathname === "/auth-success") {
      return handleAuthSuccess(request, env);
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
    if (url.pathname.replace(/\/+/g, "/") === "/api/accessibility/register-script") {
      return handleRegisterScript(request, env);
    }
    if (url.pathname.replace(/\/+/g, "/") === "/api/accessibility/apply-script") {
      return handleApplyScript(request, env);
    }
    if (url.pathname === "/api/accessibility/get-token" && request.method === "GET") {
      return handleGetTokenBySiteId(request, env);
    }
    if (url.pathname === "/api/accessibility/get-widget-url" && request.method === "GET") {
      return handleGetWidgetUrl(request, env);
    }
    if (url.pathname === "/api/accessibility/settings" && request.method === "GET") {
      return handleGetSettings(request, env);
    }
    if (url.pathname === "/api/accessibility/settings" && (request.method === "POST" || request.method === "PUT")) {
      return handleUpdateSettings(request, env);
    }
    if (url.pathname.replace(/\/+/g, "/") === "/api/accessibility/config" && request.method === "GET") {
      return handleGetConfig(request, env);
    }
    if (url.pathname.replace(/\/+/g, "/") === "/api/accessibility/domain-lookup" && request.method === "GET") {
      return handleDomainLookup(request, env);
    }
    if (url.pathname.replace(/\/+/g, "/") === "/api/accessibility/save-settings" && request.method === "POST") {
      return handleSaveSettings(request, env);
    }
    if (url.pathname.replace(/\/+/g, "/") === "/api/accessibility/payment-status" && request.method === "GET") {
      return handlePaymentStatus(request, env);
    }
    if (url.pathname.replace(/\/+/g, "/") === "/api/accessibility/validate-domain" && request.method === "POST") {
      return handleValidateDomain(request, env);
    }
    if (url.pathname.replace(/\/+/g, "/") === "/api/accessibility/user-data" && request.method === "GET") {
      return handleUserData(request, env);
    }
    if (url.pathname.replace(/\/+/g, "/") === "/api/accessibility/get-decrypted-email" && request.method === "GET") {
      const auth = request.headers.get("x-webhook-auth") || request.headers.get("authorization");
      if (!auth || !env.WEBHOOK_AUTH_TOKEN || auth !== env.WEBHOOK_AUTH_TOKEN) {
        return addSecurityAndCorsHeaders(secureJsonResponse({ error: "Unauthorized" }, 401), origin);
      }
      const siteId = url.searchParams.get("siteId");
      const email = url.searchParams.get("email");
      try {
        let installationDataStr = null;
        if (siteId) {
          installationDataStr = await env.ACCESSIBILITY_AUTH.get(`installation_${siteId}`);
        } else if (email && env.EMAIL_INDEX_KEY) {
          const emailLower = email.toLowerCase().trim();
          const emailHash = await computeHmacHex(emailLower, env.EMAIL_INDEX_KEY);
          installationDataStr = await env.ACCESSIBILITY_AUTH.get(`installation-email-hash:${emailHash}`);
        }
        if (!installationDataStr) return addSecurityAndCorsHeaders(secureJsonResponse({ error: "Not found" }, 404), origin);
        const installationData = JSON.parse(installationDataStr);
        if (!installationData.encryptedEmail) return addSecurityAndCorsHeaders(secureJsonResponse({ error: "No encrypted email stored" }, 404), origin);
        const decrypted = await decryptEmailServerSide(installationData.encryptedEmail, env);
        return addSecurityAndCorsHeaders(secureJsonResponse({ email: decrypted }), origin);
      } catch (err) {
        console.error("\u274C Error decrypting email:", err);
        return addSecurityAndCorsHeaders(secureJsonResponse({ error: "Failed to decrypt" }, 500), origin);
      }
    }
    if (url.pathname.replace(/\/+/g, "/") === "/api/accessibility/update-payment" && request.method === "POST") {
      return handleUpdatePayment(request, env);
    }
    if (url.pathname.replace(/\/+/g, "/") === "/api/accessibility/create-setup-intent" && request.method === "POST") {
      return handleCreateSetupIntent(request, env);
    }
    if (url.pathname.replace(/\/+/g, "/") === "/api/accessibility/create-subscription" && request.method === "POST") {
      return handleCreateSubscription(request, env);
    }
    if (url.pathname.replace(/\/+/g, "/") === "/api/accessibility/cancel-subscription" && request.method === "POST") {
      return handleCancelSubscription(request, env);
    }
    if (url.pathname.replace(/\/+/g, "/") === "/api/accessibility/subscription-status" && request.method === "POST") {
      return handleGetSubscriptionStatus(request, env);
    }
    if (url.pathname.replace(/\/+/g, "/") === "/api/accessibility/update-subscription-metadata" && request.method === "POST") {
      return handleUpdateSubscriptionMetadata(request, env);
    }
    if (url.pathname.replace(/\/+/g, "/") === "/api/accessibility/remove-widget" && request.method === "POST") {
      return handleRemoveWidget(request, env);
    }
    if (url.pathname.replace(/\/+/g, "/") === "/api/accessibility/install-widget" && request.method === "POST") {
      return handleInstallWidget(request, env);
    }
    if (url.pathname.replace(/\/+/g, "/") === "/api/accessibility/create-payment-intent" && request.method === "POST") {
      return handleCreatePaymentIntent(request, env);
    }
    if (url.pathname.replace(/\/+/g, "/") === "/api/stripe/webhook" && request.method === "POST") {
      return handleStripeWebhook(request, env);
    }
    if (url.pathname === "/api/stripe/create-checkout-session" && request.method === "POST") {
      return handleCreateCheckoutSession(request, env);
    }
    if (url.pathname === "/api/debug/kv-keys" && request.method === "GET") {
      return handleDebugKVKeys(request, env);
    }
    if (url.pathname === "/api/debug/fix-domain-index" && request.method === "POST") {
      return handleFixDomainIndex(request, env);
    }
    if (url.pathname === "/api/stripe/customer-data-by-domain" && request.method === "GET") {
      return handleCustomerDataByDomain(request, env);
    }
    if (url.pathname.replace(/\/+/g, "/") === "/api/webflow/app-installed" && request.method === "POST") {
      console.log("\u{1F4E5} Installation webhook request received");
      return handleWebflowAppInstallation(request, env);
    }
    if (url.pathname.replace(/\/+/g, "/") === "/api/accessibility/check-installation" && request.method === "GET") {
      return handleCheckInstallation(request, env);
    }
    if (url.pathname === "/api/accessibility/activate-subscription" && request.method === "POST") {
      return handleActivateSubscription(request, env);
    }
    if (url.pathname === "/api/accessibility/check-subscription-status" && request.method === "GET") {
      return handleCheckSubscriptionStatus(request, env);
    }
    if (url.pathname === "/api/accessibility/get-subscription-plan" && request.method === "GET") {
      return handleGetSubscriptionPlan(request, env);
    }
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
        const { siteId, customDomain: customDomain2, customization } = await request.json();
        if (!siteId || !customDomain2) {
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
          customDomain: customDomain2,
          customization: customization || existingDomainData.customization || {},
          lastUpdated: (/* @__PURE__ */ new Date()).toISOString(),
          lastUsed: (/* @__PURE__ */ new Date()).toISOString()
        };
        await env.ACCESSIBILITY_AUTH.put(`custom-domain-data:${siteId}`, JSON.stringify(updatedDomainData));
        const customDomainMirrorKey = `custom-domain:${customDomain2}`;
        await env.ACCESSIBILITY_AUTH.put(customDomainMirrorKey, JSON.stringify({
          siteId,
          customDomain: customDomain2,
          customization: updatedDomainData.customization,
          lastUpdated: (/* @__PURE__ */ new Date()).toISOString(),
          lastUsed: (/* @__PURE__ */ new Date()).toISOString()
        }));
        const domainKey = `domain:${customDomain2}`;
        await env.ACCESSIBILITY_AUTH.put(domainKey, JSON.stringify({
          siteId,
          customDomain: customDomain2,
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
        const requestOrigin = request.headers.get("origin") || "";
        const allowedOrigin = getAllowedAuthDataOrigin(requestOrigin);
        const makeHeaders = /* @__PURE__ */ __name((statusCode) => {
          const base = {
            "Content-Type": "application/json",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization"
          };
          if (allowedOrigin) {
            base["Access-Control-Allow-Origin"] = allowedOrigin;
          }
          if (statusCode === 401) {
            base["WWW-Authenticate"] = "Bearer";
          }
          return base;
        }, "makeHeaders");
        if (!siteId) {
          return new Response(JSON.stringify({ error: "Missing siteId parameter" }), {
            status: 400,
            headers: makeHeaders(400)
          });
        }
        const ip = getClientIp(request);
        const ipOk = await checkRateLimit(env, "auth-data-ip", ip, 10, 1);
        const siteOk = await checkRateLimit(env, "auth-data-site", siteId, 30, 60);
        if (!ipOk || !siteOk) {
          const h = { ...makeHeaders(429), "Retry-After": "60" };
          return new Response(JSON.stringify({ error: "Too many requests", retryAfter: 60 }), { status: 429, headers: h });
        }
        const authResult = await verifyAuth(request, env);
        if (!authResult) {
          return new Response(JSON.stringify({ error: "Unauthorized", message: "Valid Authorization header required" }), {
            status: 401,
            headers: makeHeaders(401)
          });
        }
        if (authResult.siteId !== siteId) {
          return new Response(JSON.stringify({ error: "Forbidden", message: "Not authorized to access this site" }), {
            status: 403,
            headers: makeHeaders(403)
          });
        }
        const authData = await env.ACCESSIBILITY_AUTH.get(`auth-data:${siteId}`);
        if (!authData) {
          return new Response(JSON.stringify({ error: "Authorization data not found" }), {
            status: 404,
            headers: makeHeaders(404)
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
          status: 200,
          headers: makeHeaders(200)
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: "Failed to get authorization data" }), {
          status: 500,
          headers: {
            "Content-Type": "application/json"
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
  },
  async scheduled(event, env, ctx) {
    try {
      await handle7DayReminderCron(env);
    } catch (e) {
      console.error("[CRON] scheduled handler error:", e);
    }
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
var ACCESSBIT_APP_ORIGIN = "https://app.accessbit.io";
function buildOAuthPopupHtml(messagePayload, targetOrigin) {
  const payload = JSON.stringify(messagePayload);
  const safeOrigin = targetOrigin || ACCESSBIT_APP_ORIGIN;
  return `<!doctype html>
<meta charset="utf-8" />
<title>Authorizing...</title>
<script>
(function () {
  try {
    var preferredOrigin = ${JSON.stringify(safeOrigin)};
    var payload = ${payload};
    function resolveTargetOrigin(target) {
      try {
        if (target && target.location && target.location.origin) {
          return target.location.origin;
        }
      } catch (e) {
        // cross-origin access will throw \u2014 fall through to wildcard
      }
      return '*';
    }
    function sendTo(target) {
      if (!target) return;
      try {
        var to = resolveTargetOrigin(target);
        target.postMessage(payload, to);
      } catch (e) {}
    }
    if (window.opener && !window.opener.closed) {
      sendTo(window.opener);
    }
    if (window.parent && window.parent !== window) {
      sendTo(window.parent);
    }
    // Best-effort retries in case the parent script hasn't attached its
    // listener yet when the popup lands (mirrors the old handleAuthSuccess
    // behaviour).
    setTimeout(function () {
      if (window.opener && !window.opener.closed) sendTo(window.opener);
      if (window.parent && window.parent !== window) sendTo(window.parent);
    }, 100);
    setTimeout(function () {
      if (window.opener && !window.opener.closed) sendTo(window.opener);
      if (window.parent && window.parent !== window) sendTo(window.parent);
    }, 500);
  } catch (e) {}
  setTimeout(function () { try { window.close(); } catch (e) {} }, 1000);
})();
<\/script>
<noscript>Authorization complete. You can close this window.</noscript>`;
}
__name(buildOAuthPopupHtml, "buildOAuthPopupHtml");
function oauthPopupResponse(messagePayload, status = 200) {
  const body = buildOAuthPopupHtml(messagePayload, ACCESSBIT_APP_ORIGIN);
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
      "Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"
    }
  });
}
__name(oauthPopupResponse, "oauthPopupResponse");
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
  const redirectUri = "https://app.accessbit.io/api/auth/callback";
  const authUrl = new URL("https://webflow.com/oauth/authorize");
  authUrl.searchParams.set("client_id", env.WEBFLOW_CLIENT_ID);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", scopes.join(" "));
  if (isDesigner) {
    const authFlowId = crypto.randomUUID();
    let siteIdFromState = null;
    siteIdFromState = siteId || (incomingState && incomingState.includes("_") ? incomingState.split("_")[1] : null);
    const currentSiteId = siteIdFromState;
    if (currentSiteId) {
      siteIdFromState = currentSiteId;
    }
    const statePayload = {
      v: 1,
      flowType: "designer",
      authFlowId,
      siteId: siteIdFromState,
      siteHint: null,
      // NEW (Fix B): persist the client's original state so we can echo it
      // back inside the AUTH_SUCCESS postMessage. Legacy clients that do
      // not check the echoed state simply ignore this field; new clients
      // bind the received message to their locally-stored nonce via it.
      clientState: incomingState || null,
      issuedAt: Date.now()
    };
    const generatedState = `ab_oauth_${base64UrlEncode(JSON.stringify(statePayload))}`;
    authUrl.searchParams.set("state", generatedState);
    await env.ACCESSIBILITY_AUTH.put(`oauth-flow:${authFlowId}`, JSON.stringify({
      state: generatedState,
      flowType: "designer",
      siteId: siteIdFromState || null,
      siteHint: null,
      // NEW (Fix B): mirror the client's original state into KV so it
      // survives the OAuth redirect chain and is recoverable in the
      // callback handler when building the AUTH_SUCCESS message.
      clientState: incomingState || null,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    }), { expirationTtl: 15 * 60 });
  } else {
    const referrer = request.headers.get("referer") || "";
    let siteInfo = "";
    if (referrer.includes(".design.webflow.com")) {
      const match = referrer.match(/([^.]+)\.design\.webflow\.com/);
      if (match) {
        siteInfo = `_${match[1]}`;
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
    return oauthPopupResponse({ type: "AUTH_ERROR", code: "missing_code" }, 400);
  }
  try {
    const isSecureDesignerFlow = !!(state && state.startsWith("ab_oauth_"));
    let parsedState = null;
    let authFlowId = null;
    let isDesigner = false;
    let isAppsIntegrations = false;
    if (isSecureDesignerFlow) {
      try {
        parsedState = JSON.parse(base64UrlDecode(state.replace("ab_oauth_", "")));
      } catch (e) {
        return oauthPopupResponse({ type: "AUTH_ERROR", code: "state_mismatch" }, 400);
      }
      authFlowId = parsedState?.authFlowId || null;
      if (!authFlowId) {
        return oauthPopupResponse({ type: "AUTH_ERROR", code: "state_mismatch" }, 400);
      }
      const storedFlowRaw = await env.ACCESSIBILITY_AUTH.get(`oauth-flow:${authFlowId}`);
      if (!storedFlowRaw) {
        return oauthPopupResponse({ type: "AUTH_ERROR", code: "state_mismatch" }, 400);
      }
      let storedFlow = null;
      try {
        storedFlow = JSON.parse(storedFlowRaw);
      } catch (e) {
        return oauthPopupResponse({ type: "AUTH_ERROR", code: "state_mismatch" }, 400);
      }
      if (!storedFlow || storedFlow.state !== state) {
        return oauthPopupResponse({ type: "AUTH_ERROR", code: "state_mismatch" }, 400);
      }
      isDesigner = true;
    } else {
      isDesigner = state && state.startsWith("webflow_designer");
      isAppsIntegrations = !isDesigner && (!state || state.startsWith("accessibility_widget"));
    }
    const redirectUri = "https://app.accessbit.io/api/auth/callback";
    let appsIntegrationsSiteInfo = null;
    if (isSecureDesignerFlow) {
      appsIntegrationsSiteInfo = isAppsIntegrations ? parsedState.siteHint || null : null;
    } else if (isAppsIntegrations && state && state.includes("_")) {
      const parts = state.split("_");
      if (parts.length >= 3) {
        appsIntegrationsSiteInfo = parts.slice(2).join("_");
      }
    }
    const urlSiteId = url.searchParams.get("siteId");
    const tokenRequestBody = {
      client_id: env.WEBFLOW_CLIENT_ID,
      client_secret: env.WEBFLOW_CLIENT_SECRET,
      code,
      grant_type: "authorization_code"
    };
    if (isDesigner) {
      tokenRequestBody.redirect_uri = redirectUri;
    }
    const tokenResponse = await fetch("https://api.webflow.com/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(tokenRequestBody)
    });
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${tokenResponse.status} - ${errorText}`);
    }
    const tokenData = await tokenResponse.json();
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
      const siteIdFromState = isSecureDesignerFlow ? parsedState.siteId || null : state && state.includes("_") ? state.split("_")[1] : null;
      if (siteIdFromState) {
        const matchedSite = sites.find((site) => site.id === siteIdFromState);
        if (!matchedSite) {
          return oauthPopupResponse({ type: "AUTH_ERROR", code: "site_mismatch" }, 400);
        }
        currentSite = matchedSite;
      } else {
        currentSite = sites[0];
      }
    } else {
      if (urlSiteId) {
        const foundSite = sites.find((site) => site.id === urlSiteId);
        if (foundSite) {
          currentSite = foundSite;
        } else {
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
      if (userData.email) {
        await env.ACCESSIBILITY_AUTH.put(`email-siteid:${userData.email.toLowerCase()}`, currentSite.id);
      }
      const settingsKey = `accessibility-settings:${currentSite.id}`;
      const existingSettingsRaw = await env.ACCESSIBILITY_AUTH.get(settingsKey);
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      if (existingSettingsRaw) {
        try {
          const existingSettings = JSON.parse(existingSettingsRaw);
          await env.ACCESSIBILITY_AUTH.put(settingsKey, JSON.stringify({
            ...existingSettings,
            siteId: currentSite.id,
            lastUsed: nowIso
          }));
        } catch {
          await env.ACCESSIBILITY_AUTH.put(settingsKey, JSON.stringify({
            siteId: currentSite.id,
            customization: {},
            accessibilityProfiles: {},
            customDomain: null,
            lastUpdated: nowIso,
            lastUsed: nowIso
          }));
        }
      } else {
        await env.ACCESSIBILITY_AUTH.put(settingsKey, JSON.stringify({
          siteId: currentSite.id,
          customization: {},
          accessibilityProfiles: {},
          customDomain: null,
          lastUpdated: nowIso,
          lastUsed: nowIso
        }));
      }
      if (authFlowId) {
        await env.ACCESSIBILITY_AUTH.delete(`oauth-flow:${authFlowId}`);
      }
      let designerSessionTokenValue = "";
      try {
        const sessionTokenObj = await createSessionToken(
          { ...userData, id: userData.id || userData.email },
          env,
          currentSite.id
        );
        designerSessionTokenValue = sessionTokenObj?.token || "";
      } catch (sessionTokenErr) {
        console.warn("Failed to create session token for designer AUTH_SUCCESS:", sessionTokenErr);
      }
      return oauthPopupResponse({
        type: "AUTH_SUCCESS",
        sessionToken: designerSessionTokenValue,
        user: {
          firstName: userData?.firstName || userData?.name || "User",
          email: userData?.email || ""
        },
        siteInfo: {
          siteId: currentSite.id,
          siteName: currentSite.name || currentSite.shortName || "",
          shortName: currentSite.shortName || ""
        },
        siteId: currentSite.id,
        authFlowId,
        state: parsedState?.clientState || null
      });
    }
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
    if (userData.email) {
      await env.ACCESSIBILITY_AUTH.put(`email-siteid:${userData.email.toLowerCase()}`, currentSite.id);
    }
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
      }
    } catch (domainError) {
    }
    if (authFlowId) {
      await env.ACCESSIBILITY_AUTH.delete(`oauth-flow:${authFlowId}`);
    }
    const designerDeepLink = `https://${currentSite.shortName}.design.webflow.com?app=${encodeURIComponent(env.WEBFLOW_CLIENT_ID)}`;
    return new Response(null, {
      status: 302,
      headers: {
        "Location": designerDeepLink
      }
    });
  } catch (error) {
    const normalizedCode = String(error?.message || "").includes("Token exchange failed") ? "token_exchange_failed" : "authorization_failed";
    if (state && state.startsWith("ab_oauth_")) {
      return oauthPopupResponse({ type: "AUTH_ERROR", code: normalizedCode }, 500);
    }
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
async function handleAuthSuccess(_request, _env) {
  return oauthPopupResponse({ type: "AUTH_SUCCESS" }, 200);
}
__name(handleAuthSuccess, "handleAuthSuccess");
async function handlePublishSettings(request, env) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const ip = getClientIp(request);
  const ipOk = await checkRateLimit(env, "publish-ip", ip, 10, 1);
  if (!ipOk) {
    const origin2 = request.headers.get("origin") || "";
    const corsOrigin2 = getPublishCorsOrigin(origin2);
    const h = { "Content-Type": "application/json", "Retry-After": "60", "Access-Control-Allow-Origin": corsOrigin2 };
    return new Response(JSON.stringify({ error: "Too many requests", retryAfter: 60 }), { status: 429, headers: h });
  }
  const origin = request.headers.get("origin") || "";
  const corsOrigin = getPublishCorsOrigin(origin);
  const makeHeaders = /* @__PURE__ */ __name((statusCode) => {
    const headers = new Headers();
    Object.entries(securityHeaders).forEach(([key, value]) => headers.set(key, value));
    headers.set("Content-Type", "application/json");
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    headers.set("Access-Control-Allow-Origin", corsOrigin);
    if (statusCode === 401) headers.set("WWW-Authenticate", "Bearer");
    return headers;
  }, "makeHeaders");
  try {
    const authResult = await verifyAuth(request, env);
    if (!authResult) {
      return new Response(JSON.stringify({ error: "Unauthorized", requestId }), {
        status: 401,
        headers: makeHeaders(401)
      });
    }
    const url = new URL(request.url);
    const urlSiteId = url.searchParams.get("siteId");
    const siteId = urlSiteId || authResult.siteId;
    console.log(`[PUBLISH] ${requestId} Using siteId: ${siteId} (from ${urlSiteId ? "URL parameter" : "auth result"})`);
    if (!siteId) {
      console.log(`[PUBLISH] ${requestId} No siteId available`);
      return new Response(JSON.stringify({ error: "No siteId provided", requestId }), {
        status: 400,
        headers: makeHeaders(400)
      });
    }
    const siteOk = await checkRateLimit(env, "publish-site", siteId, 15, 60);
    if (!siteOk) {
      const h = makeHeaders(429);
      h.set("Retry-After", "60");
      return new Response(JSON.stringify({ error: "Too many requests", retryAfter: 60 }), { status: 429, headers: h });
    }
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      return new Response(JSON.stringify({ error: "Invalid JSON body", requestId }), {
        status: 400,
        headers: makeHeaders(400)
      });
    }
    if (typeof body !== "object" || body === null) {
      return new Response(JSON.stringify({ error: "Request body must be a JSON object", requestId }), {
        status: 400,
        headers: makeHeaders(400)
      });
    }
    const {
      customization,
      accessibilityProfiles,
      customDomain: customDomain2,
      publishedAt,
      interfaceLanguage
    } = body;
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
    let safeCustomization = customization || {};
    if (safeCustomization && typeof safeCustomization.accessibilityStatementLink === "string") {
      safeCustomization = {
        ...safeCustomization,
        accessibilityStatementLink: sanitizeAccessibilityStatementLink(safeCustomization.accessibilityStatementLink)
      };
    }
    const accessibilityData = {
      siteId,
      customization: {
        ...existingSettings.customization,
        // Preserve existing customization
        ...safeCustomization,
        // Override with new (sanitized) customization
        interfaceLanguage: interfaceLanguage || customization?.interfaceLanguage || existingSettings.customization?.interfaceLanguage
      },
      accessibilityProfiles: accessibilityProfiles || existingSettings.accessibilityProfiles,
      customDomain: customDomain2 || existingSettings.customDomain,
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
    if (customDomain2) {
      const domainKey = `domain:${customDomain2}`;
      await env.ACCESSIBILITY_AUTH.put(domainKey, JSON.stringify({
        siteId,
        customDomain: customDomain2,
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
      headers: makeHeaders(200)
    });
  } catch (error) {
    console.error(`[PUBLISH] ${requestId} Error in publish handler:`, error);
    return new Response(JSON.stringify({
      error: "Failed to publish accessibility settings",
      details: String(error.message || error),
      requestId
    }), {
      status: 500,
      headers: makeHeaders(500)
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
  const ip = getClientIp(request);
  const ok = await checkRateLimit(env, "auth-token-ip", ip, 20, 60);
  if (!ok) {
    return new Response(JSON.stringify({ error: "Too many requests", retryAfter: 60 }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": "60",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
      }
    });
  }
  try {
    console.log("=== TOKEN AUTH DEBUG START ===");
    console.log("Request method:", request.method);
    console.log("Request URL:", request.url);
    const requestBody = await request.json();
    const { siteId, idToken } = requestBody;

    // === ID TOKEN RESOLUTION (NEW PATH) ===
    // Per Webflow Hybrid App Authentication docs:
    //   https://developers.webflow.com/apps/docs/authenticating-users-with-id-tokens
    // The Designer Extension sends an ID Token (from webflow.getIdToken())
    // alongside the siteId. The backend uses the stored access_token to
    // call Webflow's Resolve ID Token endpoint, which verifies the token
    // and returns the authenticated user's identity (id, email, firstName,
    // lastName).
    //
    // The idToken is received via POST body (not URL params), is held only
    // for the duration of this request, never stored, and never forwarded
    // to any third-party endpoint. It is used solely to call Webflow's own
    // /token/resolve API.
    //
    // BACKWARD COMPATIBILITY: if the request does NOT include an idToken
    // (old extension bundles still in production), we skip this block and
    // fall through to the legacy KV-lookup flow below. Old bundles keep
    // working unchanged.
    let resolvedUserFromIdToken = null;
    if (idToken && siteId) {
      try {
        const storedAuthForResolve = await env.ACCESSIBILITY_AUTH.get(`auth-data:${siteId}`);
        if (storedAuthForResolve) {
          const parsedAuthForResolve = JSON.parse(storedAuthForResolve);
          const accessTokenForResolve = parsedAuthForResolve?.accessToken;
          if (accessTokenForResolve) {
            const resolveResp = await fetch("https://api.webflow.com/beta/token/resolve", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${accessTokenForResolve}`,
                "Content-Type": "application/json",
                "accept-version": "2.0.0"
              },
              body: JSON.stringify({ idToken })
            });
            if (resolveResp.ok) {
              const resolved = await resolveResp.json();
              resolvedUserFromIdToken = {
                id: resolved.id,
                email: resolved.email || "",
                firstName: resolved.firstName || resolved.first_name || "User",
                lastName: resolved.lastName || resolved.last_name || ""
              };
              console.log("ID token resolved successfully via Webflow:", {
                hasId: !!resolvedUserFromIdToken.id,
                hasEmail: !!resolvedUserFromIdToken.email
              });
            } else {
              console.warn("ID token resolve failed:", resolveResp.status, "— falling back to stored auth-data");
            }
          } else {
            console.warn("No accessToken in auth-data — cannot call /token/resolve, falling back to stored auth-data");
          }
        } else {
          console.warn("No auth-data:${siteId} in KV — cannot call /token/resolve, falling back to stored auth-data");
        }
      } catch (resolveErr) {
        console.warn("ID token resolve threw, falling back to stored auth-data:", resolveErr);
      }
    }

    if (!siteId) {
      console.error("Missing required parameter: siteId");
      return new Response(JSON.stringify({ error: "Missing siteId parameter" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization"
        }
      });
    }
    console.log("Getting user data from stored OAuth access_token...");
    let userData;
    try {
      const storedAuthData2 = await env.ACCESSIBILITY_AUTH.get(`auth-data:${siteId}`);
      if (!storedAuthData2) {
        console.error("No stored auth data found for siteId:", siteId);
        return new Response(JSON.stringify({
          error: "No authentication data found. Please complete OAuth flow first."
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
      const parsed = JSON.parse(storedAuthData2);
      const user = parsed.user || {};
      // Prefer the verified user from the resolved idToken when available
      // (NEW path). Otherwise fall back to user data stored during OAuth
      // (LEGACY path — keeps old extension bundles working).
      if (resolvedUserFromIdToken && resolvedUserFromIdToken.id) {
        userData = {
          id: resolvedUserFromIdToken.id,
          email: resolvedUserFromIdToken.email || user.email || parsed.email || "",
          firstName: resolvedUserFromIdToken.firstName || user.firstName || user.name || "User"
        };
        console.log("Using verified user data from resolved idToken");
      } else {
        userData = {
          id: user.id || siteId,
          // Use siteId as fallback if no user ID
          email: user.email || parsed.email || "",
          firstName: user.firstName || user.name || "User"
        };
        console.log("Using stored OAuth user data (legacy path)");
      }
      console.log("Retrieved user data:", {
        hasId: !!userData.id,
        hasEmail: !!userData.email,
        verifiedViaIdToken: !!(resolvedUserFromIdToken && resolvedUserFromIdToken.id)
      });
      if (!userData.id) {
        console.error("Missing required user ID in stored auth data");
        return new Response(JSON.stringify({ error: "Invalid user data in stored auth" }), {
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
      console.error("Failed to retrieve stored auth data:", error);
      return new Response(JSON.stringify({ error: "Failed to retrieve authentication data" }), {
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
  if (sanitizedSettings.customization && typeof sanitizedSettings.customization.accessibilityStatementLink === "string") {
    sanitizedSettings.customization.accessibilityStatementLink = sanitizeAccessibilityStatementLink(sanitizedSettings.customization.accessibilityStatementLink);
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
  try {
    const domainFromSettings = settings?.customization?.customDomain || settings?.customDomain;
    if (domainFromSettings) {
      const host = normalizeHost(domainFromSettings);
      const baseHost = host.replace(/^www\./, "");
      const mapping = JSON.stringify({ siteId, domain: domainFromSettings, isPrimary: true, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() });
      await env.ACCESSIBILITY_AUTH.put(`site:domain:${baseHost}`, mapping);
      await env.ACCESSIBILITY_AUTH.put(`site:domain:www.${baseHost}`, mapping);
    }
    try {
      const authDataRaw = await env.ACCESSIBILITY_AUTH.get(`auth-data:${siteId}`);
      if (authDataRaw) {
        const authData = JSON.parse(authDataRaw);
        const shortName = authData?.currentSite?.shortName || authData?.site?.shortName;
        if (shortName) {
          const stagingDomain = `${shortName}.webflow.io`;
          const sHost = normalizeHost(stagingDomain);
          const sBase = sHost.replace(/^www\./, "");
          const sMapping = JSON.stringify({ siteId, domain: stagingDomain, isPrimary: true, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() });
          await env.ACCESSIBILITY_AUTH.put(`site:domain:${sBase}`, sMapping);
          await env.ACCESSIBILITY_AUTH.put(`site:domain:www.${sBase}`, sMapping);
        }
      }
    } catch {
    }
  } catch {
  }
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
    let shortName = "";
    try {
      const authDataRawForSite = await env.ACCESSIBILITY_AUTH.get(`auth-data:${siteIdFromUrl}`);
      if (authDataRawForSite) {
        const parsedAuth = JSON.parse(authDataRawForSite);
        shortName = parsedAuth?.currentSite?.shortName || parsedAuth?.site?.shortName || "";
      }
    } catch {
    }
    shortName = shortName || "";
    if (!shortName) {
      try {
        const siteResp = await fetch(`https://api.webflow.com/v2/sites/${siteIdFromUrl}`, {
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "accept-version": "2.0.0"
          }
        });
        if (siteResp.ok) {
          const siteJson = await siteResp.json();
          shortName = siteJson?.shortName || siteJson?.subdomain || "";
        }
      } catch {
      }
    }
    let siteToken = await env.ACCESSIBILITY_AUTH.get(`siteToken:${siteIdFromUrl}`);
    if (!siteToken) {
      const raw = crypto.getRandomValues(new Uint8Array(32));
      siteToken = btoa(String.fromCharCode(...raw)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      await env.ACCESSIBILITY_AUTH.put(`siteToken:${siteIdFromUrl}`, siteToken);
      console.log("\u{1F510} siteToken PUT", { key: `siteToken:${siteIdFromUrl}` });
    }
    const scriptUrl = `https://accessbit.pages.dev/widget.js?siteId=${encodeURIComponent(siteIdFromUrl || authResult.siteId || "")}&siteToken=${encodeURIComponent(siteToken)}`;
    const normalizeCdnBase = /* @__PURE__ */ __name((urlStr) => {
      try {
        const u = new URL(urlStr);
        const noQuery = `${u.origin}${u.pathname}`;
        return noQuery.replace(/@[^/]+/, "");
      } catch {
        return urlStr;
      }
    }, "normalizeCdnBase");
    const expectedBase = normalizeCdnBase(scriptUrl);
    console.log(accessToken);
    const existingScriptsResponse = await fetch(`https://api.webflow.com/v2/sites/${siteIdFromUrl}/registered_scripts`, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "accept-version": "2.0.0"
      }
    });
    if (existingScriptsResponse.ok) {
      const existingScripts = await existingScriptsResponse.json();
      const registeredList = existingScripts.registeredScripts || [];
      const idsToDelete = registeredList.filter(
        (s) => normalizeCdnBase(s.hostedLocation || "") === expectedBase || typeof s.displayName === "string" && s.displayName.startsWith("appscript")
      ).map((s) => s.id).filter(Boolean);
      await Promise.all(idsToDelete.map(async (id) => {
        try {
          await fetch(`https://api.webflow.com/v2/sites/${siteIdFromUrl}/registered_scripts/${id}`, {
            method: "DELETE",
            headers: {
              "Authorization": `Bearer ${accessToken}`,
              "accept-version": "2.0.0"
            }
          });
        } catch {
        }
      }));
    }
    const inlineScriptCode = `(function(){try{var h=document.head||document.getElementsByTagName('head')[0];if(h){var p=document.createElement('link');p.rel='preconnect';p.href='https://accessbit.pages.dev';p.crossOrigin='anonymous';h.appendChild(p);}var s=document.createElement('script');s.src='${scriptUrl}';s.async=true;s.defer=true;s.crossOrigin='anonymous';(document.body||document.documentElement).appendChild(s);}catch(e){console.error('AccessBit inline loader failed',e);}})();`;
    const registerResponse = await fetch(`https://api.webflow.com/v2/sites/${siteIdFromUrl}/registered_scripts/inline`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "accept-version": "2.0.0"
      },
      body: JSON.stringify({
        displayName: `appscript${Date.now()}`,
        sourceCode: inlineScriptCode,
        version: "1.0.0",
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
    let requestBody;
    try {
      requestBody = await request.json();
    } catch (parseError) {
      console.error("Failed to parse request body:", parseError);
      return new Response(JSON.stringify({
        error: "Invalid request body",
        details: parseError.message
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
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
    let shortName = "";
    try {
      const authRaw = await env.ACCESSIBILITY_AUTH.get(`auth-data:${siteId}`);
      if (authRaw) {
        const parsed = JSON.parse(authRaw);
        shortName = parsed?.currentSite?.shortName || parsed?.site?.shortName || "";
      }
    } catch {
    }
    if (!shortName) {
      try {
        const siteResp = await fetch(`https://api.webflow.com/v2/sites/${siteId}`, {
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "accept-version": "2.0.0"
          }
        });
        if (siteResp.ok) {
          const siteJson = await siteResp.json();
          shortName = siteJson?.shortName || siteJson?.subdomain || "";
        }
      } catch {
      }
    }
    let siteToken = await env.ACCESSIBILITY_AUTH.get(`siteToken:${siteId}`);
    if (!siteToken) {
      const raw = crypto.getRandomValues(new Uint8Array(32));
      siteToken = btoa(String.fromCharCode(...raw)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      await env.ACCESSIBILITY_AUTH.put(`siteToken:${siteId}`, siteToken);
      console.log(" siteToken PUT", { key: `siteToken:${siteId}` });
    }
    if (!siteId || !siteToken) {
      console.error("Missing siteId or siteToken:", { siteId, siteToken });
      return new Response(JSON.stringify({
        error: "Missing required parameters",
        details: `siteId: ${siteId ? "present" : "missing"}, siteToken: ${siteToken ? "present" : "missing"}`
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
    const scriptUrl = `https://accessbit.pages.dev/widget.js?siteId=${encodeURIComponent(siteId)}&siteToken=${encodeURIComponent(siteToken)}`;
    const normalizeCdnBase = /* @__PURE__ */ __name((urlStr) => {
      try {
        const u = new URL(urlStr);
        const noQuery = `${u.origin}${u.pathname}`;
        return noQuery.replace(/@[^/]+/, "");
      } catch {
        return urlStr;
      }
    }, "normalizeCdnBase");
    const expectedBase = normalizeCdnBase(scriptUrl);
    const regResp = await fetch(`https://api.webflow.com/v2/sites/${siteId}/registered_scripts`, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "accept-version": "2.0.0"
      }
    });
    if (!regResp.ok) {
      const err = await regResp.text();
      throw new Error(`Failed to read registered scripts: ${regResp.status} - ${err}`);
    }
    const regJson = await regResp.json();
    const registered = regJson.registeredScripts || [];
    const inlineScripts = registered.filter((s) => typeof s.displayName === "string" && s.displayName.startsWith("appscript"));
    const matchByBase = inlineScripts.length ? inlineScripts[inlineScripts.length - 1] : null;
    if (matchByBase) {
      const existingResponse2 = await fetch(`https://api.webflow.com/v2/sites/${siteId}/custom_code`, {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "accept-version": "2.0.0"
        }
      });
      let scriptsArr2 = [];
      if (existingResponse2.ok) {
        const existingData = await existingResponse2.json();
        scriptsArr2 = existingData.scripts || [];
      }
      let regListForClean2 = [];
      try {
        const reg = await fetch(`https://api.webflow.com/v2/sites/${siteId}/registered_scripts`, {
          headers: { "Authorization": `Bearer ${accessToken}`, "accept-version": "2.0.0" }
        });
        if (reg.ok) {
          const rj = await reg.json();
          regListForClean2 = rj.registeredScripts || [];
        }
      } catch {
      }
      const idsToRemove2 = regListForClean2.filter((r) => normalizeCdnBase(r.hostedLocation) === expectedBase && r.id !== matchByBase.id).map((r) => r.id);
      const targetLocation = "footer";
      const existingApplied = scriptsArr2.find(
        (s) => s.id === matchByBase.id && s.location === targetLocation && s.version === (version || "1.0.0")
      );
      if (existingApplied) {
        return new Response(JSON.stringify({
          success: true,
          message: "Script already registered and applied",
          result: matchByBase,
          alreadyApplied: true
        }), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        });
      }
      const pruned2 = scriptsArr2.filter((s) => s.id !== matchByBase.id && !idsToRemove2.includes(s.id)).map((s) => {
        if (s.location && s.location !== "header" && s.location !== "footer") {
          console.warn(`Invalid location '${s.location}' found in existing script, defaulting to 'header'`);
          return { ...s, location: "header" };
        }
        return s;
      });
      const validLocation2 = targetLocation === "header" || targetLocation === "footer" ? targetLocation : "footer";
      console.log(`Adding script with location: ${validLocation2} (targetLocation was: ${targetLocation})`);
      pruned2.push({ id: matchByBase.id, version: version || matchByBase.version || "1.0.0", location: validLocation2 });
      console.log("Sending scripts array to Webflow:", JSON.stringify(pruned2, null, 2));
      const updateResponse2 = await fetch(`https://api.webflow.com/v2/sites/${siteId}/custom_code`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "accept-version": "2.0.0"
        },
        body: JSON.stringify({ scripts: pruned2 })
      });
      if (!updateResponse2.ok) {
        const err = await updateResponse2.text();
        throw new Error(`Failed to apply custom code: ${updateResponse2.status} - ${err}`);
      }
      return new Response(JSON.stringify({
        success: true,
        message: "Script already registered, now applied",
        result: matchByBase,
        alreadyApplied: false
      }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
    if (matchByBase) {
    }
    const inlineScriptCode = `(function(){try{var h=document.head||document.getElementsByTagName('head')[0];if(h){var p=document.createElement('link');p.rel='preconnect';p.href='https://accessbit.pages.dev';p.crossOrigin='anonymous';h.appendChild(p);}var s=document.createElement('script');s.src='${scriptUrl}';s.async=true;s.defer=true;s.crossOrigin='anonymous';(document.body||document.documentElement).appendChild(s);}catch(e){console.error('AccessBit inline loader failed',e);}})();`;
    const postResp = await fetch(`https://api.webflow.com/v2/sites/${siteId}/registered_scripts/inline`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "accept-version": "2.0.0"
      },
      body: JSON.stringify({
        displayName: `appscript${Date.now()}`,
        sourceCode: inlineScriptCode,
        version: "1.0.0",
        canCopy: false,
        isRequired: false
      })
    });
    if (!postResp.ok) {
      const errorText = await postResp.text();
      throw new Error(`Script application failed: ${postResp.status} - ${errorText}`);
    }
    const postJson = await postResp.json();
    const existingResponse = await fetch(`https://api.webflow.com/v2/sites/${siteId}/custom_code`, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "accept-version": "2.0.0"
      }
    });
    let scriptsArr = [];
    if (existingResponse.ok) {
      const existingData = await existingResponse.json();
      scriptsArr = existingData.scripts || [];
    }
    let regListForClean = [];
    try {
      const reg = await fetch(`https://api.webflow.com/v2/sites/${siteId}/registered_scripts`, {
        headers: { "Authorization": `Bearer ${accessToken}`, "accept-version": "2.0.0" }
      });
      if (reg.ok) {
        const rj = await reg.json();
        regListForClean = rj.registeredScripts || [];
      }
    } catch {
    }
    const idsToRemove = regListForClean.filter((r) => normalizeCdnBase(r.hostedLocation) === expectedBase && r.id !== postJson.id).map((r) => r.id);
    const pruned = scriptsArr.filter((s) => s.id !== postJson.id && !idsToRemove.includes(s.id)).map((s) => {
      if (s.location && s.location !== "header" && s.location !== "footer") {
        console.warn(`Invalid location '${s.location}' found in existing script, defaulting to 'header'`);
        return { ...s, location: "header" };
      }
      return s;
    });
    const validLocation = "footer";
    console.log(`Adding new script with location: ${validLocation} (requested location was: ${location})`);
    pruned.push({ id: postJson.id, version: postJson.version || "1.0.0", location: validLocation });
    console.log("Sending scripts array to Webflow:", JSON.stringify(pruned, null, 2));
    const updateResponse = await fetch(`https://api.webflow.com/v2/sites/${siteId}/custom_code`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "accept-version": "2.0.0"
      },
      body: JSON.stringify({ scripts: pruned })
    });
    if (!updateResponse.ok) {
      const err = await updateResponse.text();
      throw new Error(`Failed to apply custom code: ${updateResponse.status} - ${err}`);
    }
    return new Response(JSON.stringify({
      success: true,
      result: postJson,
      alreadyApplied: false
    }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (error) {
    console.error("Apply script error:", error);
    const errorMessage = error?.message || String(error);
    const errorStack = error?.stack || "";
    console.error("Apply script error details:", {
      message: errorMessage,
      stack: errorStack,
      name: error?.name
    });
    return new Response(JSON.stringify({
      error: "Failed to apply script",
      details: errorMessage,
      stack: errorStack
    }), {
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
    const customization = settings.customization || {};
    if (typeof customization.accessibilityStatementLink === "string") {
      customization.accessibilityStatementLink = sanitizeAccessibilityStatementLink(customization.accessibilityStatementLink);
    }
    const config = {
      customization,
      accessibilityProfiles: settings.accessibilityProfiles,
      siteId,
      publishedAt: settings.publishedAt,
      widgetVersion: authInfo.widgetVersion || "1.0.0"
    };
    const successResponse = secureJsonResponse(config);
    const responseWithHeaders = addSecurityAndCorsHeaders(successResponse, origin);
    const headers = new Headers(responseWithHeaders.headers);
    headers.set("Cache-Control", "public, max-age=60");
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
  const url = new URL(request.url);
  let domain = url.searchParams.get("domain");
  if (!domain) {
    return addSecurityAndCorsHeaders(secureJsonResponse({ error: "Domain parameter is missing" }, 400), origin);
  }
  const normalizedDomain = domain.toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "").split(":")[0];
  console.log("\u{1F50D} Looking up siteId for domain:", normalizedDomain);
  try {
    const installationRecord = await env.ACCESSIBILITY_AUTH.get(`installation-domain:${normalizedDomain}`);
    if (!installationRecord) {
      console.log("\u274C No installation record found for domain:", normalizedDomain);
      return addSecurityAndCorsHeaders(secureJsonResponse({ error: "Domain not registered" }, 404), origin);
    }
    const data = JSON.parse(installationRecord);
    console.log("\u2705 Found siteId:", data.siteId, "for domain:", normalizedDomain);
    return addSecurityAndCorsHeaders(secureJsonResponse({
      success: true,
      siteId: data.siteId
    }), origin);
  } catch (error) {
    console.error("\u274C Database error during domain lookup:", error);
    return addSecurityAndCorsHeaders(secureJsonResponse({ error: "Internal server error" }, 500), origin);
  }
}
__name(handleDomainLookup, "handleDomainLookup");
async function handleSaveSettings(request, env) {
  const ip = getClientIp(request);
  const ipOk = await checkRateLimit(env, "save-settings-ip", ip, 10, 1);
  if (!ipOk) {
    const origin2 = request.headers.get("origin") || "";
    const allowedOrigin2 = getAllowedAuthDataOrigin(origin2);
    const h = new Headers();
    h.set("Content-Type", "application/json");
    h.set("Retry-After", "60");
    if (allowedOrigin2) h.set("Access-Control-Allow-Origin", allowedOrigin2);
    return new Response(JSON.stringify({ error: "Too many requests", retryAfter: 60 }), { status: 429, headers: h });
  }
  const origin = request.headers.get("origin") || "";
  const allowedOrigin = getAllowedAuthDataOrigin(origin);
  const makeHeaders = /* @__PURE__ */ __name((statusCode) => {
    const headers = new Headers();
    Object.entries(securityHeaders).forEach(([key, value]) => {
      headers.set(key, value);
    });
    headers.set("Content-Type", "application/json");
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin, X-CSRF-Token");
    headers.set("Access-Control-Allow-Credentials", "true");
    headers.set("Access-Control-Max-Age", "86400");
    headers.set("Vary", "Origin");
    if (allowedOrigin) {
      headers.set("Access-Control-Allow-Origin", allowedOrigin);
    }
    return headers;
  }, "makeHeaders");
  try {
    const body = await request.json();
    const { siteId, settings } = body;
    if (!siteId || !settings) {
      const errorResponse = secureJsonResponse({ error: "Missing siteId or settings" }, 400);
      return new Response(errorResponse.body, {
        status: errorResponse.status,
        statusText: errorResponse.statusText,
        headers: makeHeaders(400)
      });
    }
    const siteOk = await checkRateLimit(env, "save-settings-site", siteId, 30, 60);
    if (!siteOk) {
      const h = makeHeaders(429);
      h.set("Retry-After", "60");
      return new Response(JSON.stringify({ error: "Too many requests", retryAfter: 60 }), { status: 429, headers: h });
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
    if (sanitizedSettings.customization && typeof sanitizedSettings.customization.accessibilityStatementLink === "string") {
      sanitizedSettings.customization.accessibilityStatementLink = sanitizeAccessibilityStatementLink(sanitizedSettings.customization.accessibilityStatementLink);
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
    try {
      const domainFromBody = customDomain || updatedSettings?.customization?.customDomain || updatedSettings?.customDomain;
      if (domainFromBody) {
        const host = normalizeHost(domainFromBody);
        const baseHost = host.replace(/^www\./, "");
        const mapping = JSON.stringify({ siteId, domain: domainFromBody, isPrimary: true, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() });
        await env.ACCESSIBILITY_AUTH.put(`site:domain:${baseHost}`, mapping);
        await env.ACCESSIBILITY_AUTH.put(`site:domain:www.${baseHost}`, mapping);
      }
      try {
        const authDataRaw = await env.ACCESSIBILITY_AUTH.get(`auth-data:${siteId}`);
        if (authDataRaw) {
          const authData = JSON.parse(authDataRaw);
          const shortName = authData?.currentSite?.shortName || authData?.site?.shortName;
          if (shortName) {
            const stagingDomain = `${shortName}.webflow.io`;
            const sHost = normalizeHost(stagingDomain);
            const sBase = sHost.replace(/^www\./, "");
            const sMapping = JSON.stringify({ siteId, domain: stagingDomain, isPrimary: true, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() });
            await env.ACCESSIBILITY_AUTH.put(`site:domain:${sBase}`, sMapping);
            await env.ACCESSIBILITY_AUTH.put(`site:domain:www.${sBase}`, sMapping);
          }
        }
      } catch {
      }
    } catch {
    }
    const successResponse = secureJsonResponse({
      success: true,
      message: "Settings saved successfully",
      settings: updatedSettings
    });
    return new Response(successResponse.body, {
      status: successResponse.status,
      statusText: successResponse.statusText,
      headers: makeHeaders(200)
    });
  } catch (error) {
    console.error("Save settings error:", error);
    const errorResponse = secureJsonResponse({
      error: "Failed to save settings",
      details: error.message
    }, 500);
    return new Response(errorResponse.body, {
      status: errorResponse.status,
      statusText: errorResponse.statusText,
      headers: makeHeaders(500)
    });
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
async function handleGetWidgetUrl(request, env) {
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
    const siteId = url.searchParams.get("siteId") || authResult.siteId;
    if (!siteId) {
      return new Response(JSON.stringify({ error: "Missing siteId parameter" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
    let siteToken = await env.ACCESSIBILITY_AUTH.get(`siteToken:${siteId}`);
    if (!siteToken) {
      const raw = crypto.getRandomValues(new Uint8Array(32));
      siteToken = btoa(String.fromCharCode(...raw)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      await env.ACCESSIBILITY_AUTH.put(`siteToken:${siteId}`, siteToken);
    }
    const scriptUrl = `https://accessbit.pages.dev/widget.js?siteId=${encodeURIComponent(siteId)}&siteToken=${encodeURIComponent(siteToken)}`;
    return new Response(JSON.stringify({
      scriptUrl,
      siteId
    }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (error) {
    console.error("Get widget URL error:", error);
    return new Response(JSON.stringify({ error: "Failed to get widget URL" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}
__name(handleGetWidgetUrl, "handleGetWidgetUrl");
async function handlePaymentStatus(request, env) {
  const origin = request.headers.get("origin");
  return addSecurityAndCorsHeaders(secureJsonResponse({
    error: "This endpoint is deprecated. Use /api/stripe/customer-data-by-domain instead."
  }, 410), origin);
}
__name(handlePaymentStatus, "handlePaymentStatus");
async function handleValidateDomain(request, env) {
  const origin = request.headers.get("origin");
  try {
    const { domain, siteId, siteToken, visitorId } = await request.json();
    console.log("\u{1F510} validate-domain: incoming", {
      siteId,
      domain,
      hasToken: !!siteToken,
      visitorIdPresent: !!visitorId
    });
    if (!siteId) {
      const errorResponse = secureJsonResponse({ error: "siteId required" }, 400);
      return addSecurityAndCorsHeaders(errorResponse, origin);
    }
    const isStagingDomain = domain && (domain.includes(".webflow.io") || domain.includes(".webflow.com") || domain.includes("localhost") || domain.includes("127.0.0.1") || domain.includes("staging"));
    if (isStagingDomain) {
      console.log("\u{1F510} validate-domain: staging domain detected, allowing without token:", domain);
      const successResponse2 = secureJsonResponse({ isValid: true, visitorId: visitorId || void 0, isStaging: true });
      return addSecurityAndCorsHeaders(successResponse2, origin);
    }
    if (!siteToken) {
      console.log("\u{1F510} validate-domain: missing siteToken");
      const errorResponse = secureJsonResponse({ isValid: false, error: "token missing" }, 400);
      return addSecurityAndCorsHeaders(errorResponse, origin);
    }
    const stored = await env.ACCESSIBILITY_AUTH.get(`siteToken:${siteId}`);
    if (!stored || stored !== siteToken) {
      console.log("\u{1F510} validate-domain: siteToken mismatch");
      const errorResponse = secureJsonResponse({ isValid: false, error: "token invalid" }, 401);
      return addSecurityAndCorsHeaders(errorResponse, origin);
    }
    console.log("\u{1F510} validate-domain: success", { siteId, domain });
    const successResponse = secureJsonResponse({ isValid: true, visitorId: visitorId || void 0 });
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
  return addSecurityAndCorsHeaders(secureJsonResponse({
    error: "This endpoint is deprecated. Use /api/stripe/customer-data-by-domain instead."
  }, 410), origin);
}
__name(handleUserData, "handleUserData");
async function handleUpdatePayment(request, env) {
  try {
    const { siteId, paymentStatus, subscriptionId, customerId } = await request.json();
    console.log("Updating payment status:", { siteId, paymentStatus, subscriptionId, customerId });
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
      customerId,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    await env.ACCESSIBILITY_AUTH.put(`user-data:${siteId}`, JSON.stringify(userData));
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
    let customerId;
    if (email) {
      const customersResponse = await fetch(`https://api.stripe.com/v1/customers?email=${encodeURIComponent(email)}&limit=1`, {
        headers: {
          Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`
        }
      });
      if (customersResponse.ok) {
        const customers = await customersResponse.json();
        if (customers.data.length > 0) {
          customerId = customers.data[0].id;
          console.log("Found existing customer:", customerId);
        }
      }
    }
    if (!customerId) {
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
      customerId = customer.id;
      console.log("Created new customer:", customerId);
    }
    const setupIntentData = new URLSearchParams();
    setupIntentData.append("customer", customerId);
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
      customerId,
      setupIntentId: setupIntent.id,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    }));
    const successResponse = secureJsonResponse({
      success: true,
      clientSecret: setupIntent.client_secret,
      customerId,
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
    let customerId = providedCustomerId || "";
    if (!customerId && email) {
      console.log("Checking for existing customer with email:", email);
      const existingCustomersResponse = await fetch(`https://api.stripe.com/v1/customers?email=${encodeURIComponent(email)}&limit=1`, {
        headers: {
          Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`
        }
      });
      if (existingCustomersResponse.ok) {
        const existingCustomers = await existingCustomersResponse.json();
        if (existingCustomers.data && existingCustomers.data.length > 0) {
          customerId = existingCustomers.data[0].id;
          console.log("Found existing customer:", customerId);
        }
      }
    }
    if (!customerId) {
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
      customerId = customer.id;
      console.log("Created new customer:", customerId);
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
    subscriptionData.append("customer", customerId);
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
    console.log("Customer ID being used:", customerId);
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
    const subscription = await subscriptionResponse.json();
    console.log("Subscription created successfully:", subscription);
    console.log("Subscription status:", subscription.status);
    console.log("Subscription payment method:", subscription.default_payment_method);
    console.log("Subscription latest invoice:", subscription.latest_invoice);
    console.log("Subscription items:", subscription.items?.data?.[0]);
    const userData = {
      siteId,
      domain: sanitizedDomain,
      customerId,
      subscriptionId: subscription.id,
      paymentStatus: subscription.status,
      firstName: firstName || "",
      currentPeriodStart: subscription.current_period_start,
      currentPeriodEnd: subscription.current_period_end,
      cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    try {
      const paymentSnapshot = {
        id: subscription.id,
        siteId,
        type: "subscription_created",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        status: subscription.status,
        currency: subscription.currency || null,
        amount: subscription.items?.data?.[0]?.price?.unit_amount || null,
        customerId,
        subscriptionId: subscription.id,
        invoiceId: subscription.latest_invoice || null,
        paymentIntentId: subscription.latest_invoice?.payment_intent || null,
        paymentMethodId: paymentMethodId || null,
        firstName: firstName || "",
        currentPeriodStart: subscription.current_period_start || null,
        currentPeriodEnd: subscription.current_period_end || null,
        metadata: subscription.metadata || {}
      };
      await env.ACCESSIBILITY_AUTH.put(`payment:${siteId}`, JSON.stringify(paymentSnapshot));
      if (customerId) {
        await env.ACCESSIBILITY_AUTH.put(`customer_to_site:${customerId}`, siteId);
      }
    } catch (snapErr) {
      console.warn("Failed to save payment snapshot:", snapErr);
    }
    if (subscription.status === "incomplete") {
      console.log("Subscription created in incomplete status - will be completed by SetupIntent webhook");
      if (paymentMethodId) {
        console.log("Attempting to activate incomplete subscription with payment method:", paymentMethodId);
        try {
          const activateParams = new URLSearchParams();
          activateParams.append("default_payment_method", paymentMethodId);
          const activateResponse = await fetch(`https://api.stripe.com/v1/subscriptions/${subscription.id}`, {
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
            return addSecurityAndCorsHeaders(secureJsonResponse({
              subscriptionId: subscription.id,
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
        subscriptionId: subscription.id,
        status: subscription.status,
        requiresAction: false,
        // No action needed - webhook will complete it
        message: "Subscription created successfully. Payment will be processed automatically."
      }), origin);
    } else if (subscription.status === "active") {
      await env.ACCESSIBILITY_AUTH.put(`domain_${sanitizedDomain}`, JSON.stringify({
        siteId,
        verified: true
      }));
      return addSecurityAndCorsHeaders(secureJsonResponse({
        subscriptionId: subscription.id,
        status: subscription.status,
        requiresAction: false
      }), origin);
    } else {
      return addSecurityAndCorsHeaders(secureJsonResponse({
        subscriptionId: subscription.id,
        status: subscription.status,
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
    let customerId = "";
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
      customerId = cust.id || "";
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
        ...customerId ? { customer: customerId } : {},
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
    await processStripeEvent(env, event);
    return addSecurityAndCorsHeaders(secureJsonResponse({ success: true, event: event.type }, 200), origin);
  } catch (error) {
    console.error("Webhook error:", error);
    const errorResponse = secureJsonResponse({ error: "Webhook processing failed" }, 500);
    return addSecurityAndCorsHeaders(errorResponse, origin);
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
    return addSecurityAndCorsHeaders(secureJsonResponse({ success: true }, 200), origin);
  } catch (error) {
    console.error("Error in handleActivateSubscription:", error);
    const errorResponse = secureJsonResponse({ error: "Activation failed" }, 500);
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
    const subscription = await subscriptionResponse.json();
    return addSecurityAndCorsHeaders(secureJsonResponse({
      status: subscription.status,
      subscriptionId: subscription.id,
      current_period_end: subscription.current_period_end,
      current_period_start: subscription.current_period_start,
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: subscription.canceled_at,
      access_details: {
        has_access: subscription.status === "active",
        access_until: subscription.current_period_end,
        access_start: subscription.current_period_start,
        will_cancel: subscription.cancel_at_period_end,
        canceled_at: subscription.canceled_at
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
    const subscription = await subscriptionResponse.json();
    let planType = "monthly";
    if (subscription.items && subscription.items.data && subscription.items.data.length > 0) {
      const priceId = subscription.items.data[0].price.id;
      if (priceId === "price_1SL2ZQRh1lS9W4XK8QJqJzKx" || priceId.includes("annual")) {
        planType = "annual";
      } else if (priceId === "price_1SL2ZQRh1lS9W4XK8QJqJzKy" || priceId.includes("monthly")) {
        planType = "monthly";
      }
    }
    const validUntil = new Date(subscription.current_period_end * 1e3).toISOString();
    return addSecurityAndCorsHeaders(secureJsonResponse({
      planType,
      validUntil,
      subscriptionId: subscription.id,
      status: subscription.status,
      current_period_end: subscription.current_period_end,
      current_period_start: subscription.current_period_start
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
    const customerId = setupIntent.customer;
    console.log("Payment method attached:", paymentMethodId);
    console.log("Customer ID:", customerId);
    const customerUpdateData = new URLSearchParams();
    customerUpdateData.append("invoice_settings[default_payment_method]", paymentMethodId);
    const customerUpdateResponse = await fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
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
    const customerResponse = await fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
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
      customerId,
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
  const siteId = url.searchParams.get("siteId");
  const domain = url.searchParams.get("domain");
  try {
    console.log("Checking payment status for siteId:", siteId, "domain:", domain);
    if (domain) {
      const isStagingDomain = domain.includes(".webflow.io") || domain.includes(".webflow.com") || domain.includes("localhost") || domain.includes("127.0.0.1") || domain.includes("staging");
      if (isStagingDomain) {
        console.log("Staging domain detected, allowing access:", domain);
        return addSecurityAndCorsHeaders(secureJsonResponse({
          hasAccess: true,
          isStaging: true
        }), origin);
      }
    }
    let customerId = null;
    let customerData = null;
    if (siteId) {
      console.log("Checking payment status by siteId:", siteId);
      const installationKey = `installation_${siteId}`;
      const installationDataStr = await env.ACCESSIBILITY_AUTH.get(installationKey);
      if (installationDataStr) {
        try {
          const installationData = JSON.parse(installationDataStr);
          const installationDomain = installationData.customDomain;
          if (installationDomain) {
            const domainKey = `domain:${installationDomain}`;
            let domainData = await env.ACCESSIBILITY_AUTH.get(domainKey);
            if (!domainData && !installationDomain.startsWith("http")) {
              const domainKeyWithHttps = `domain:https://${installationDomain}`;
              domainData = await env.ACCESSIBILITY_AUTH.get(domainKeyWithHttps);
            }
            if (!domainData) {
              const normalizedDomain = normalizeHost(installationDomain);
              if (normalizedDomain && normalizedDomain !== installationDomain) {
                const normalizedDomainKey = `domain:${normalizedDomain}`;
                domainData = await env.ACCESSIBILITY_AUTH.get(normalizedDomainKey);
              }
            }
            if (domainData) {
              if (!domainData.startsWith("{")) {
                customerId = domainData;
                console.log("Found customerId from siteId->installation->domain mapping:", customerId);
              } else {
                try {
                  const domainInfo = JSON.parse(domainData);
                  customerId = domainInfo.customerId || domainInfo.stripeCustomerId;
                  console.log("Found customerId from siteId->installation->domain mapping (JSON):", customerId);
                } catch (e) {
                  console.warn("Failed to parse domain data from installation:", e);
                }
              }
            }
          }
        } catch (e) {
          console.warn("Failed to parse installation data:", e);
        }
      }
    }
    if (!customerId && domain) {
      console.log("Falling back to domain lookup:", domain);
      const domainKey = `domain:${domain}`;
      let domainData = await env.ACCESSIBILITY_AUTH.get(domainKey);
      if (!domainData && !domain.startsWith("http")) {
        const domainKeyWithHttps = `domain:https://${domain}`;
        domainData = await env.ACCESSIBILITY_AUTH.get(domainKeyWithHttps);
      }
      if (!domainData) {
        const normalizedDomain = normalizeHost(domain);
        if (normalizedDomain && normalizedDomain !== domain) {
          const normalizedDomainKey = `domain:${normalizedDomain}`;
          domainData = await env.ACCESSIBILITY_AUTH.get(normalizedDomainKey);
        }
      }
      if (domainData) {
        if (!domainData.startsWith("{")) {
          customerId = domainData;
          console.log("Found customerId from domain mapping:", customerId);
        } else {
          try {
            const domainInfo = JSON.parse(domainData);
            customerId = domainInfo.customerId || domainInfo.stripeCustomerId;
            console.log("Found customerId from domain mapping (JSON):", customerId);
          } catch (e) {
            console.warn("Failed to parse domain data:", e);
          }
        }
      }
    }
    if (!customerId) {
      console.log("No customerId found for siteId:", siteId, "domain:", domain);
      return addSecurityAndCorsHeaders(secureJsonResponse({
        hasAccess: false,
        isStaging: false
      }), origin);
    }
    const customerKey = `customer:${customerId}`;
    const customerDataStr = await env.ACCESSIBILITY_AUTH.get(customerKey);
    if (!customerDataStr) {
      console.log("No customer data found for customerId:", customerId);
      return addSecurityAndCorsHeaders(secureJsonResponse({
        hasAccess: false,
        isStaging: false
      }), origin);
    }
    try {
      customerData = JSON.parse(customerDataStr);
      console.log("Found customer data:", {
        email: customerData.email,
        customDomain: customerData.customDomain,
        paymentStatus: customerData.paymentStatus,
        subscriptionStatus: customerData.subscriptionStatus,
        isSubscribed: customerData.isSubscribed
      });
    } catch (e) {
      console.error("Failed to parse customer data:", e);
      return addSecurityAndCorsHeaders(secureJsonResponse({
        hasAccess: false,
        isStaging: false
      }), origin);
    }
    const paymentData = {
      email: customerData.email,
      customDomain: customerData.customDomain,
      paymentStatus: customerData.paymentStatus,
      subscriptionStatus: customerData.subscriptionStatus,
      isSubscribed: customerData.isSubscribed,
      stripeSubscriptionId: customerData.stripeSubscriptionId,
      stripeCustomerId: customerData.stripeCustomerId,
      planType: customerData.planType,
      validUntil: customerData.validUntil
    };
    const isActive = paymentData.isSubscribed === true && paymentData.paymentStatus === "paid";
    console.log("Payment validation:", {
      isSubscribed: paymentData.isSubscribed,
      paymentStatus: paymentData.paymentStatus,
      subscriptionStatus: paymentData.subscriptionStatus,
      isActive
    });
    if (isActive) {
      console.log("Payment is active for siteId:", siteId, "domain:", domain);
      let validUntil = paymentData.validUntil || null;
      if (validUntil) {
        try {
          const validUntilDate = new Date(validUntil);
          if (!isNaN(validUntilDate.getTime())) {
            validUntil = validUntilDate.toISOString();
          }
        } catch (e) {
          console.warn("Failed to format validUntil:", e);
        }
      }
      return addSecurityAndCorsHeaders(secureJsonResponse({
        hasAccess: true,
        isStaging: false
      }), origin);
    } else {
      console.log("Payment is not active for siteId:", siteId, "domain:", domain, "paymentStatus:", paymentData.paymentStatus, "isSubscribed:", paymentData.isSubscribed);
      let validUntil = paymentData.validUntil || null;
      if (validUntil) {
        try {
          const validUntilDate = new Date(validUntil);
          if (!isNaN(validUntilDate.getTime())) {
            validUntil = validUntilDate.toISOString();
          }
        } catch (e) {
          console.warn("Failed to format validUntil:", e);
        }
      }
      return addSecurityAndCorsHeaders(secureJsonResponse({
        hasAccess: false,
        isStaging: false
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
    let currentPeriodEnd = paymentData.currentPeriodEnd;
    if (currentPeriodEnd == null && paymentData.invoiceId?.lines?.data?.[0]?.period?.end != null) {
      currentPeriodEnd = paymentData.invoiceId.lines.data[0].period.end;
    }
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
  
  
  
  // Accessibility Widget Implementation
  const ContrastKitWidget = {
    isInitialized: false,
    
    init: function() {
      if (this.isInitialized) return;
      this.isInitialized = true;
      
     
      
      // Create accessibility toolbar
      this.createToolbar();
      
      // Add keyboard navigation support
      this.addKeyboardSupport();
      
      // Add screen reader support
      this.addScreenReaderSupport();
      
     
    },
    
    createToolbar: function() {
    
      const toolbar = document.createElement('div');
      toolbar.id = 'accessbit-toolbar';
      
      const toolbarContent = document.createElement('div');
      toolbarContent.style.cssText = 'position: fixed; top: 20px; left: 20px; background: #1a1a1a; color: white; padding: 12px; border-radius: 8px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 14px; z-index: 9999; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); max-width: 200px;';
      
      const title = document.createElement('div');
      title.style.cssText = 'font-weight: 600; margin-bottom: 8px;';
      title.textContent = 'Accessibility Tools';
      toolbarContent.appendChild(title);
      
      const btnIncrease = document.createElement('button');
      btnIncrease.textContent = 'A+';
      btnIncrease.style.cssText = 'background: #3b82f6; color: white; border: none; padding: 6px 12px; border-radius: 4px; margin: 2px; cursor: pointer; font-size: 12px;';
      btnIncrease.addEventListener('click', ContrastKitWidget.increaseFontSize);
      toolbarContent.appendChild(btnIncrease);
      
      const btnDecrease = document.createElement('button');
      btnDecrease.textContent = 'A-';
      btnDecrease.style.cssText = 'background: #3b82f6; color: white; border: none; padding: 6px 12px; border-radius: 4px; margin: 2px; cursor: pointer; font-size: 12px;';
      btnDecrease.addEventListener('click', ContrastKitWidget.decreaseFontSize);
      toolbarContent.appendChild(btnDecrease);
      
      const btnContrast = document.createElement('button');
      btnContrast.textContent = 'High Contrast';
      btnContrast.style.cssText = 'background: #3b82f6; color: white; border: none; padding: 6px 12px; border-radius: 4px; margin: 2px; cursor: pointer; font-size: 12px;';
      btnContrast.addEventListener('click', ContrastKitWidget.toggleHighContrast);
      toolbarContent.appendChild(btnContrast);
      
      toolbar.appendChild(toolbarContent);
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
  
  
  const showPaymentMessage = function() {
    const message = document.createElement('div');
    message.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #f59e0b; color: white; padding: 12px 16px; border-radius: 8px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 14px; z-index: 9999; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); max-width: 300px;';
    
    const strong = document.createElement('strong');
    strong.textContent = 'Accessibility Widget';
    message.appendChild(strong);
    
    message.appendChild(document.createElement('br'));
    
    const text = document.createTextNode('Payment required to activate features. ');
    message.appendChild(text);
    
    const link = document.createElement('a');
    link.href = 'https://accessibility-widget.web-8fb.workers.dev';
    link.textContent = 'Subscribe Now';
    link.style.cssText = 'color: white; text-decoration: underline; margin-left: 4px;';
    message.appendChild(link);
    
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
    let subscription;
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
      subscription = await subscriptionResponse.json();
      console.log("Stripe cancellation response (period end):", subscription);
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
      subscription = await subscriptionResponse.json();
      console.log("Stripe cancellation response (immediate):", subscription);
    }
    if (siteId) {
      console.log("Updating KV store for cancellation:", { siteId, cancelAtPeriodEnd });
      if (userDataStr) {
        const userData = JSON.parse(userDataStr);
        userData.paymentStatus = cancelAtPeriodEnd ? "canceling" : "canceled";
        userData.cancelAtPeriodEnd = subscription.cancel_at_period_end;
        userData.currentPeriodEnd = subscription.current_period_end;
        userData.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
        userData.cancellationDate = (/* @__PURE__ */ new Date()).toISOString();
        userData.canceled_at = (/* @__PURE__ */ new Date()).toISOString();
        console.log("Updated customer data with cancellation status");
      }
      const paymentSnapshotStr = await env.ACCESSIBILITY_AUTH.get(`payment:${siteId}`);
      if (paymentSnapshotStr) {
        const paymentSnapshot = JSON.parse(paymentSnapshotStr);
        paymentSnapshot.status = cancelAtPeriodEnd ? "canceling" : "canceled";
        paymentSnapshot.cancelAtPeriodEnd = subscription.cancel_at_period_end;
        paymentSnapshot.currentPeriodEnd = subscription.current_period_end;
        paymentSnapshot.cancellationDate = (/* @__PURE__ */ new Date()).toISOString();
        paymentSnapshot.canceled_at = (/* @__PURE__ */ new Date()).toISOString();
        paymentSnapshot.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
        await env.ACCESSIBILITY_AUTH.put(`payment:${siteId}`, JSON.stringify(paymentSnapshot));
        console.log("Updated payment:${siteId} with cancellation status");
      }
      await mergeSiteSettings(env, siteId, {
        siteId,
        paymentStatus: cancelAtPeriodEnd ? "canceling" : "canceled",
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        currentPeriodEnd: subscription.current_period_end,
        cancellationDate: (/* @__PURE__ */ new Date()).toISOString(),
        lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
      });
      console.log("Updated site settings with cancellation status");
    }
    const successResponse = secureJsonResponse({
      success: true,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        cancel_at_period_end: subscription.cancel_at_period_end,
        current_period_end: subscription.current_period_end,
        canceled_at: subscription.canceled_at,
        access_details: {
          has_access: subscription.status === "active",
          access_until: subscription.current_period_end,
          access_start: subscription.current_period_start,
          will_cancel: subscription.cancel_at_period_end,
          canceled_at: subscription.canceled_at
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
      if (userDataStr) {
        const userData = JSON.parse(userDataStr);
        userData.domain = metadata.domain || userData.domain;
        userData.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
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
    if (userDataStr) {
      const userData = JSON.parse(userDataStr);
      userData.previousDomain = userData.domain;
      userData.domain = null;
      userData.widgetRemovedAt = (/* @__PURE__ */ new Date()).toISOString();
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
    if (userDataStr) {
      const userData = JSON.parse(userDataStr);
      userData.previousDomain = userData.domain;
      userData.domain = domain;
      userData.widgetInstalledAt = (/* @__PURE__ */ new Date()).toISOString();
      userData.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
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
    const paymentDataStr = await env.ACCESSIBILITY_AUTH.get(paymentKey);
    let paymentData = null;
    if (paymentDataStr) {
      try {
        paymentData = JSON.parse(paymentDataStr);
      } catch (e) {
        paymentData = { _raw: paymentDataStr, _parseError: String(e) };
      }
    }
    const debugInfo = {
      siteId,
      paymentData,
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
    if (userDataStr) {
      const userData = JSON.parse(userDataStr);
      userData.paymentStatus = "active";
      userData.lastPaymentDate = (/* @__PURE__ */ new Date()).toISOString();
      userData.currentPeriodStart = Math.floor(Date.now() / 1e3);
      userData.currentPeriodEnd = Math.floor(Date.now() / 1e3) + 365 * 24 * 60 * 60;
      userData.cancelAtPeriodEnd = false;
      userData.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
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
    const errorResponse = secureJsonResponse({ error: "Failed to reactivate subscription" }, 500);
    return addSecurityAndCorsHeaders(errorResponse, origin);
  }
}
__name(handleReactivateSubscription, "handleReactivateSubscription");
async function fetchCustomerDetails(env, customerId, customerData) {
  try {
    const response = await fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
      headers: {
        "Authorization": `Bearer ${env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded"
      }
    });
    if (response.ok) {
      const customer = await response.json();
      console.log("\u{1F50D} Fetched customer details:", {
        customerId,
        email: customer.email,
        domain: customer.metadata?.domain,
        metadata: customer.metadata
      });
      if (customer.email && !customerData.email) {
        customerData.email = customer.email;
      }
      if (!customerData.customDomain) {
        const domain = customer.metadata?.domain || customer.metadata?.customDomain || customer.metadata?.website || customer.metadata?.site_url || customer.metadata?.yourwebsiteurllivedomain;
        if (domain) {
          customerData.customDomain = domain;
        }
      }
    }
  } catch (error) {
    console.error("Error fetching customer details:", error);
  }
}
__name(fetchCustomerDetails, "fetchCustomerDetails");
async function getLatestSubscription(env, customerId) {
  if (!customerId) return null;
  const res = await fetch(`https://api.stripe.com/v1/subscriptions?customer=${customerId}&limit=1`, {
    headers: {
      "Authorization": `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded"
    }
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.data?.[0] || null;
}
__name(getLatestSubscription, "getLatestSubscription");
async function getSubscriptionById(env, subscriptionId) {
  if (!subscriptionId) return null;
  const res = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
    headers: {
      "Authorization": `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded"
    }
  });
  if (!res.ok) return null;
  return await res.json();
}
__name(getSubscriptionById, "getSubscriptionById");
async function processStripeEvent(env, event) {
  try {
    const obj = event?.data?.object || {};
    const type = event?.type || "";
    console.log("\u{1F50D} Processing Stripe event:", { type, eventId: event.id });
    const customerId = obj.customer || obj.subscription?.customer || null;
    if (!customerId) {
      console.log("No customer ID found in event:", type);
      return;
    }
    console.log("\u{1F50D} Found customer ID:", customerId);
    const customerKey = `customer:${customerId}`;
    const existingStr = await env.ACCESSIBILITY_AUTH.get(customerKey);
    let customerData = existingStr ? JSON.parse(existingStr) : {
      email: "",
      customDomain: "",
      isSubscribed: false,
      stripeCustomerId: customerId,
      stripeSubscriptionId: "",
      subscriptionStatus: "incomplete",
      paymentStatus: "unpaid",
      planType: "",
      validUntil: "",
      created: (/* @__PURE__ */ new Date()).toISOString(),
      lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
    };
    console.log("\u{1F50D} Event type:", type, "Processing...");
    switch (type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(env, obj, customerData, customerKey);
        break;
      case "customer.subscription.created":
        await handleSubscriptionCreated(env, obj, customerData, customerKey);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(env, obj, customerData, customerKey);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(env, obj, customerData, customerKey);
        break;
      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(env, obj, customerData, customerKey);
        break;
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(env, obj, customerData, customerKey);
        break;
      default:
        console.log("\u26A0\uFE0F Unhandled event type:", type);
        break;
    }
  } catch (error) {
    console.error("Error processing Stripe event:", error);
  }
}
__name(processStripeEvent, "processStripeEvent");
async function handleCheckoutSessionCompleted(env, session, customerData, customerKey) {
  console.log("\u{1F50D} Processing checkout.session.completed:", session.id);
  const email = session.customer_details?.email || session.customer_email || customerData.email;
  console.log("\u{1F50D} Extracted email from checkout session:", email);
  let customDomain2 = customerData.customDomain;
  if (session.custom_fields && Array.isArray(session.custom_fields)) {
    const domainField = session.custom_fields.find(
      (field) => field.key === "yourwebsiteurllivedomain" || field.text?.label === "Your Website URL (Live Domain)"
    );
    if (domainField?.text?.value) {
      customDomain2 = domainField.text.value;
      console.log("\u{1F50D} Extracted domain from checkout session:", customDomain2);
    }
  }
  customerData.email = email;
  customerData.customDomain = customDomain2;
  customerData.paymentStatus = session.payment_status === "paid" ? "paid" : "unpaid";
  customerData.subscriptionStatus = "complete";
  customerData.isSubscribed = true;
  customerData.stripeSubscriptionId = session.subscription || customerData.stripeSubscriptionId;
  customerData.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
  if (!customerData.stripeSubscriptionId || !customerData.planType || !customerData.validUntil) {
    try {
      const sub = await getLatestSubscription(env, customerData.stripeCustomerId);
      if (sub) {
        customerData.stripeSubscriptionId = customerData.stripeSubscriptionId || sub.id;
        const price = sub.items?.data?.[0]?.price;
        if (!customerData.planType && price?.recurring?.interval) {
          customerData.planType = price.recurring.interval === "year" ? "annual" : "monthly";
        }
        if (!customerData.validUntil && sub.current_period_end) {
          customerData.validUntil = new Date(sub.current_period_end * 1e3).toISOString();
        }
      }
    } catch (e) {
      console.log("\u26A0\uFE0F Backfill in checkout.session.completed failed:", String(e));
    }
  }
  const updatedCustomerData = await upsertCustomerRecord(env, customerData.stripeCustomerId, {
    email,
    customDomain: customDomain2,
    isSubscribed: true,
    paymentStatus: customerData.paymentStatus,
    subscriptionStatus: customerData.subscriptionStatus,
    stripeSubscriptionId: customerData.stripeSubscriptionId,
    planType: customerData.planType,
    validUntil: customerData.validUntil,
    created: customerData.created
  });
  try {
    let siteId = session.metadata?.siteId || await env.ACCESSIBILITY_AUTH.get(`customer_to_site:${customerData.stripeCustomerId}`);
    if (siteId && session.subscription) {
      const sub = await getSubscriptionById(env, session.subscription);
      if (sub) {
        const periodEnd = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end;
        if (periodEnd) {
          await updatePaymentSnapshotForSite(env, siteId, { status: "active", currentPeriodEnd: periodEnd });
        }
      }
    }
  } catch (e) {
    console.log("\u26A0\uFE0F Update payment snapshot in checkout.session.completed failed:", e);
  }
  if (customerData.paymentStatus === "paid" && customerData.isSubscribed) {
    await sendPaymentCompletedClickUpWebhook(env, updatedCustomerData || customerData, "checkout.session.completed", session);
  }
}
__name(handleCheckoutSessionCompleted, "handleCheckoutSessionCompleted");
async function handleSubscriptionCreated(env, subscription, customerData, customerKey) {
  console.log("\u{1F50D} Processing subscription.created:", subscription.id);
  customerData.stripeSubscriptionId = subscription.id;
  customerData.subscriptionStatus = subscription.status === "active" ? "complete" : "incomplete";
  customerData.paymentStatus = subscription.status === "active" ? "paid" : "unpaid";
  customerData.isSubscribed = subscription.status === "active";
  customerData.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
  if (subscription.items?.data?.[0]?.price) {
    const price = subscription.items.data[0].price;
    console.log("\u{1F50D} Price details:", {
      unit_amount: price.unit_amount,
      interval: price.recurring?.interval,
      currency: price.currency
    });
    customerData.planType = price.recurring?.interval === "year" ? "annual" : "monthly";
    if (subscription.current_period_end) {
      customerData.validUntil = new Date(subscription.current_period_end * 1e3).toISOString();
      console.log("\u{1F50D} Valid until:", customerData.validUntil);
    }
  }
  await fetchCustomerDetails(env, customerData.stripeCustomerId, customerData);
  const updatedCustomerData = await upsertCustomerRecord(env, customerData.stripeCustomerId, {
    email: customerData.email,
    customDomain: customerData.customDomain,
    isSubscribed: customerData.isSubscribed,
    paymentStatus: customerData.paymentStatus,
    subscriptionStatus: customerData.subscriptionStatus,
    stripeSubscriptionId: customerData.stripeSubscriptionId,
    planType: customerData.planType,
    validUntil: customerData.validUntil,
    created: customerData.created
  });
}
__name(handleSubscriptionCreated, "handleSubscriptionCreated");
async function handleSubscriptionUpdated(env, subscription, customerData, customerKey) {
  customerData.stripeSubscriptionId = subscription.id;
  if (subscription.status === "canceled" || subscription.canceled_at) {
    customerData.subscriptionStatus = "cancelled";
    customerData.paymentStatus = "cancelled";
    customerData.isSubscribed = false;
  } else if (subscription.cancel_at || subscription.cancel_at_period_end) {
    customerData.subscriptionStatus = "scheduled_cancellation";
    customerData.paymentStatus = "paid";
    customerData.isSubscribed = true;
    const endTs = subscription.cancel_at || subscription.current_period_end;
    if (endTs) {
      customerData.validUntil = new Date(endTs * 1e3).toISOString();
    }
  } else {
    customerData.subscriptionStatus = subscription.status === "active" ? "complete" : "incomplete";
    customerData.paymentStatus = subscription.status === "active" ? "paid" : "unpaid";
    customerData.isSubscribed = subscription.status === "active";
  }
  customerData.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
  if (subscription.items?.data?.[0]?.price) {
    const price = subscription.items.data[0].price;
    customerData.planType = price.unit_amount > 1e3 ? "annual" : "monthly";
    if (subscription.current_period_end) {
      customerData.validUntil = new Date(subscription.current_period_end * 1e3).toISOString();
    }
  }
  await upsertCustomerRecord(env, customerData.stripeCustomerId, {
    email: customerData.email,
    customDomain: customerData.customDomain,
    isSubscribed: customerData.isSubscribed,
    paymentStatus: customerData.paymentStatus,
    subscriptionStatus: customerData.subscriptionStatus,
    stripeSubscriptionId: customerData.stripeSubscriptionId,
    planType: customerData.planType,
    validUntil: customerData.validUntil,
    created: customerData.created
  });
  try {
    const siteId = await env.ACCESSIBILITY_AUTH.get(`customer_to_site:${customerData.stripeCustomerId}`);
    if (siteId) {
      const periodEnd = subscription.current_period_end ?? subscription.items?.data?.[0]?.current_period_end;
      const status = subscription.status === "active" ? "active" : subscription.status === "canceled" || subscription.canceled_at ? "canceled" : subscription.status;
      await updatePaymentSnapshotForSite(env, siteId, { status, currentPeriodEnd: periodEnd ?? void 0 });
    }
  } catch (e) {
    console.log("\u26A0\uFE0F Update payment snapshot in subscription.updated failed:", e);
  }
}
__name(handleSubscriptionUpdated, "handleSubscriptionUpdated");
async function handleSubscriptionDeleted(env, subscription, customerData, customerKey) {
  customerData.stripeSubscriptionId = subscription.id;
  customerData.subscriptionStatus = "cancelled";
  customerData.paymentStatus = "cancelled";
  customerData.isSubscribed = false;
  customerData.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
  await upsertCustomerRecord(env, customerData.stripeCustomerId, {
    email: customerData.email,
    customDomain: customerData.customDomain,
    isSubscribed: false,
    paymentStatus: "cancelled",
    subscriptionStatus: "cancelled",
    stripeSubscriptionId: customerData.stripeSubscriptionId,
    planType: customerData.planType,
    validUntil: customerData.validUntil,
    created: customerData.created
  });
  try {
    const siteId = await env.ACCESSIBILITY_AUTH.get(`customer_to_site:${customerData.stripeCustomerId}`);
    if (siteId) {
      await updatePaymentSnapshotForSite(env, siteId, { status: "canceled" });
    }
  } catch (e) {
    console.log("\u26A0\uFE0F Update payment snapshot in subscription.deleted failed:", e);
  }
}
__name(handleSubscriptionDeleted, "handleSubscriptionDeleted");
async function handleInvoicePaymentSucceeded(env, invoice, customerData, customerKey) {
  await fetchCustomerDetails(env, customerData.stripeCustomerId, customerData);
  customerData.paymentStatus = "paid";
  customerData.subscriptionStatus = "complete";
  customerData.isSubscribed = true;
  customerData.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
  try {
    let subscriptionId = invoice.subscription || invoice.parent?.subscription_details?.subscription || customerData.stripeSubscriptionId;
    if (!subscriptionId) {
      const sub = await getLatestSubscription(env, customerData.stripeCustomerId);
      if (sub) subscriptionId = sub.id;
    }
    if (subscriptionId) {
      if (!customerData.stripeSubscriptionId) customerData.stripeSubscriptionId = subscriptionId;
      if (!customerData.planType || !customerData.validUntil) {
        const sub = await getSubscriptionById(env, subscriptionId);
        if (sub) {
          const price = sub.items?.data?.[0]?.price;
          if (!customerData.planType && price?.recurring?.interval) {
            customerData.planType = price.recurring.interval === "year" ? "annual" : "monthly";
          }
          if (!customerData.validUntil && sub.current_period_end) {
            customerData.validUntil = new Date(sub.current_period_end * 1e3).toISOString();
          }
        }
      }
    }
  } catch (e) {
    console.log("\u26A0\uFE0F Backfill in invoice.payment_succeeded failed:", String(e));
  }
  const updatedCustomerData = await upsertCustomerRecord(env, customerData.stripeCustomerId, {
    email: customerData.email,
    customDomain: customerData.customDomain,
    isSubscribed: customerData.isSubscribed,
    paymentStatus: customerData.paymentStatus,
    subscriptionStatus: customerData.subscriptionStatus,
    stripeSubscriptionId: customerData.stripeSubscriptionId,
    planType: customerData.planType,
    validUntil: customerData.validUntil,
    created: customerData.created
  });
  try {
    const siteId = await env.ACCESSIBILITY_AUTH.get(`customer_to_site:${customerData.stripeCustomerId}`);
    if (siteId && customerData.validUntil) {
      const periodEndSec = Math.floor(new Date(customerData.validUntil).getTime() / 1e3);
      await updatePaymentSnapshotForSite(env, siteId, { status: "active", currentPeriodEnd: periodEndSec });
    }
  } catch (e) {
    console.log("\u26A0\uFE0F Update payment snapshot in invoice.payment_succeeded failed:", e);
  }
  if (customerData.customDomain) {
    const keys = buildDomainIndexKeys(customerData.customDomain);
    for (const k of keys) {
      await env.ACCESSIBILITY_AUTH.put(k, customerData.stripeCustomerId);
    }
  }
  if (customerData.email) {
    await env.ACCESSIBILITY_AUTH.put(`email:${customerData.email.toLowerCase()}`, customerData.stripeCustomerId);
  }
}
__name(handleInvoicePaymentSucceeded, "handleInvoicePaymentSucceeded");
async function handlePaymentIntentSucceeded(env, paymentIntent, customerData, customerKey) {
  await fetchCustomerDetails(env, customerData.stripeCustomerId, customerData);
  customerData.paymentStatus = "paid";
  customerData.subscriptionStatus = "complete";
  customerData.isSubscribed = true;
  customerData.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
  try {
    let subscriptionId = paymentIntent.subscription || customerData.stripeSubscriptionId;
    if (!subscriptionId) {
      const sub = await getLatestSubscription(env, customerData.stripeCustomerId);
      if (sub) subscriptionId = sub.id;
    }
    if (subscriptionId) {
      if (!customerData.stripeSubscriptionId) customerData.stripeSubscriptionId = subscriptionId;
      if (!customerData.planType || !customerData.validUntil) {
        const sub = await getSubscriptionById(env, subscriptionId);
        if (sub) {
          const price = sub.items?.data?.[0]?.price;
          if (!customerData.planType && price?.recurring?.interval) {
            customerData.planType = price.recurring.interval === "year" ? "annual" : "monthly";
          }
          if (!customerData.validUntil && sub.current_period_end) {
            customerData.validUntil = new Date(sub.current_period_end * 1e3).toISOString();
          }
        }
      }
    }
  } catch (e) {
    console.log("\u26A0\uFE0F Backfill in payment_intent.succeeded failed:", String(e));
  }
  const updatedCustomerData = await upsertCustomerRecord(env, customerData.stripeCustomerId, {
    email: customerData.email,
    customDomain: customerData.customDomain,
    isSubscribed: customerData.isSubscribed,
    paymentStatus: customerData.paymentStatus,
    subscriptionStatus: customerData.subscriptionStatus,
    stripeSubscriptionId: customerData.stripeSubscriptionId,
    planType: customerData.planType,
    validUntil: customerData.validUntil,
    created: customerData.created
  });
  if (customerData.customDomain) {
    const domainKey1 = `domain:${customerData.customDomain}`;
    const domainKey2 = `domain:${customerData.customDomain.replace(/\/$/, "")}`;
    await env.ACCESSIBILITY_AUTH.put(domainKey1, customerData.stripeCustomerId);
    await env.ACCESSIBILITY_AUTH.put(domainKey2, customerData.stripeCustomerId);
  }
  if (customerData.email) {
    await env.ACCESSIBILITY_AUTH.put(`email:${customerData.email.toLowerCase()}`, customerData.stripeCustomerId);
  }
}
__name(handlePaymentIntentSucceeded, "handlePaymentIntentSucceeded");
function normalizeHost(domain) {
  if (!domain) return "";
  try {
    const url = new URL(domain.startsWith("http") ? domain : `https://${domain}`);
    return url.hostname.toLowerCase();
  } catch {
    return String(domain).replace(/^https?:\/\//, "").replace(/\/$/, "").split("/")[0].toLowerCase();
  }
}
__name(normalizeHost, "normalizeHost");
function buildDomainIndexKeys(domain) {
  const host = normalizeHost(domain);
  if (!host) return [];
  const noWww = host.replace(/^www\./, "");
  const withWww = noWww === host ? `www.${noWww}` : host;
  const keys = /* @__PURE__ */ new Set();
  keys.add(`domain:${noWww}`);
  keys.add(`domain:${withWww}`);
  return Array.from(keys);
}
__name(buildDomainIndexKeys, "buildDomainIndexKeys");
async function cleanupLegacyDomainKeys(env, domain) {
  const host = normalizeHost(domain);
  if (!host) return;
  const candidates = [
    `domain:https://${host}`,
    `domain:https://${host}/`,
    `domain:https://www.${host.replace(/^www\./, "")}`,
    `domain:${host}/`
  ];
  for (const k of candidates) {
    try {
      await env.ACCESSIBILITY_AUTH.delete(k);
    } catch {
    }
  }
}
__name(cleanupLegacyDomainKeys, "cleanupLegacyDomainKeys");
function mergeCustomerFields(existing, updates) {
  const result = { ...existing || {} };
  for (const [key, value] of Object.entries(updates || {})) {
    if (value === void 0) continue;
    if (typeof value === "string") {
      if (value.trim() === "" && typeof result[key] === "string" && result[key].trim() !== "") {
        continue;
      }
    }
    result[key] = value;
  }
  return result;
}
__name(mergeCustomerFields, "mergeCustomerFields");
async function sendPaymentEmail(env, email, firstName) {
  if (!email || !email.includes("@")) return false;
  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": env.BREVO_API_KEY,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        sender: {
          name: "AccessBit Team",
          email: "web@accessbit.io"
        },
        to: [{ email, name: firstName || (email.split("@")[0] || "Customer") }],
        subject: "Thank you for signing up with AccessBit and choosing our paid plan!",
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <p>Hi ${firstName || (email.split("@")[0] || "Customer")},</p>
            <p>We're excited to have you onboard and to help you build a more accessible, inclusive, and compliant website experience for all users.</p>
            <p>The next step is to install the AccessBit app on your Webflow website. Once installed, you'll be able to publish seamlessly to your custom domain and unlock all the premium accessibility features included in your plan.</p>
            <p><strong>Check out the installation videos:</strong></p>
            <ul>
              <li><a href="https://vimeo.com/1170089748" style="color:#007BFF; text-decoration:none;">AccessBit Installation part 1</a></li>
              <li><a href="https://vimeo.com/1170089799" style="color:#007BFF; text-decoration:none;">AccessBit Installation part 2</a></li>
              <li><a href="https://vimeo.com/1170089848" style="color:#007BFF; text-decoration:none;">AccessBit Installation part 3</a></li>
            </ul>
            <p>If you have any questions, visit our <a href="https://www.accessbit.io/help-center" style="color:#007BFF; text-decoration:none;">AccessBit Help Center</a> for guides and FAQs.</p>
            <p>Need assistance? We've got you covered:</p>
            <ul>
              <li>Email us anytime at <a href="mailto:web@accessbit.io" style="color:#007BFF;">web@accessbit.io</a></li>
              <li>Book a quick support call</li>
              <li>Fill out our contact form and we'll get back to you shortly</li>
            </ul>
            <p>If you have any questions, feature suggestions, or need help with installation, we're just a message away.</p>
            <p>Thanks again for choosing AccessBit.</p>
            <p>Best regards,<br><strong>The AccessBit Team</strong></p>
          </div>
        `,
        textContent: `Hi ${firstName || (email.split("@")[0] || "Customer")},

We're excited to have you onboard and to help you build a more accessible, inclusive, and compliant website experience for all users.

The next step is to install the AccessBit app on your Webflow website. Once installed, you'll be able to publish seamlessly to your custom domain and unlock all the premium accessibility features included in your plan.

Check out the installation videos:
- AccessBit Installation part 1
- AccessBit Installation part 2
- AccessBit Installation part 3

If you have any questions, visit our AccessBit Help Center for guides and FAQs: https://www.accessbit.io/help-center

Need assistance? We've got you covered:
- Email us anytime at web@accessbit.io
- Book a quick support call
- Fill out our contact form and we'll get back to you shortly

If you have any questions, feature suggestions, or need help with installation, we're just a message away.

Thanks again for choosing AccessBit.
Best regards,
The AccessBit Team`,
        tags: ["payment", "subscription"]
      })
    });
    if (response.ok) {
      const result = await response.json().catch(() => ({}));
      console.log(`[PAYMENT] Brevo payment email sent: ${email} \u2192 MessageId: ${result.messageId || "n/a"}`);
      return true;
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.warn(`[PAYMENT] Brevo payment email error (${response.status}):`, errorData);
      return false;
    }
  } catch (err) {
    console.error(`[PAYMENT] Brevo payment email failed for ${email}:`, err);
    return false;
  }
}
__name(sendPaymentEmail, "sendPaymentEmail");
async function sendPaymentCompletedClickUpWebhook(env, customerData, eventType = "payment_completed", stripeObject = null) {
  try {
    const hasActivePayment = customerData.isSubscribed && customerData.paymentStatus === "paid";
    if (!hasActivePayment) {
      console.log("\u23ED\uFE0F Skipping ClickUp webhook - payment not active (payment webhooks only for active payments)");
      return;
    }
    let dedupeKey = null;
    if (hasActivePayment && customerData.stripeCustomerId) {
      const dedupeDomain = customerData.customDomain ? normalizeHost(customerData.customDomain) : null;
      const dedupeScope = dedupeDomain || customerData.stripeSubscriptionId || customerData.stripeCustomerId;
      dedupeKey = `clickup-webhook-sent:${customerData.stripeCustomerId}:${dedupeScope}`;
      const existingWebhook = await env.ACCESSIBILITY_AUTH.get(dedupeKey);
      if (existingWebhook) {
        console.log("\u23ED\uFE0F Skipping ClickUp webhook - already sent for this customer payment (deduplication)");
        console.log("\u23ED\uFE0F Dedupe key:", dedupeKey);
        return;
      }
    }
    let installationData = null;
    if (customerData.email) {
      try {
        const emailLower = customerData.email.toLowerCase().trim();
        let installationDataStr = null;
        if (env.EMAIL_INDEX_KEY) {
          const emailHash = await computeHmacHex(emailLower, env.EMAIL_INDEX_KEY);
          const installationKey = `installation-email-hash:${emailHash}`;
          console.log("\u{1F50D} DEBUG: Fetching installation data by email hash:", installationKey);
          installationDataStr = await env.ACCESSIBILITY_AUTH.get(installationKey);
        }
        if (!installationDataStr) {
          const installationKeyLegacy = `installation-email:${emailLower}`;
          console.log("\u{1F50D} DEBUG: Fetching installation data by legacy email key:", installationKeyLegacy);
          installationDataStr = await env.ACCESSIBILITY_AUTH.get(installationKeyLegacy);
        }
        if (installationDataStr) {
          installationData = JSON.parse(installationDataStr);
          console.log("\u2705 DEBUG: Found installation data by email (or hash):", {
            firstName: installationData.firstName,
            siteName: installationData.siteName,
            customDomain: installationData.customDomain,
            stagingUrl: installationData.stagingUrl,
            siteId: installationData.siteId
          });
        } else {
          console.log("\u26A0\uFE0F DEBUG: No installation data found for email:", customerData.email);
        }
      } catch (e) {
        console.log("\u26A0\uFE0F Could not fetch installation data by email:", e);
      }
    }
    if (!installationData && customerData.customDomain) {
      try {
        const rawDomainKey = `installation-domain:${customerData.customDomain}`;
        console.log("\u{1F50D} DEBUG: Email lookup failed, trying domain lookup (raw):", rawDomainKey);
        console.log("\u{1F50D} DEBUG: Customer domain:", customerData.customDomain);
        let installationDataStr = await env.ACCESSIBILITY_AUTH.get(rawDomainKey);
        if (!installationDataStr) {
          const normalizedDomain = normalizeHost(customerData.customDomain);
          if (normalizedDomain && normalizedDomain !== customerData.customDomain) {
            const normalizedDomainKey = `installation-domain:${normalizedDomain}`;
            console.log("\u{1F50D} DEBUG: Raw lookup failed, trying normalized domain:", normalizedDomainKey);
            console.log("\u{1F50D} DEBUG: Normalized domain:", normalizedDomain);
            installationDataStr = await env.ACCESSIBILITY_AUTH.get(normalizedDomainKey);
          }
        }
        if (installationDataStr) {
          installationData = JSON.parse(installationDataStr);
          console.log("\u2705 DEBUG: Found installation data by domain:", {
            firstName: installationData.firstName,
            siteName: installationData.siteName,
            customDomain: installationData.customDomain,
            stagingUrl: installationData.stagingUrl,
            siteId: installationData.siteId
          });
        } else {
          console.log("\u26A0\uFE0F DEBUG: No installation data found for domain (tried raw and normalized):", customerData.customDomain);
        }
      } catch (e) {
        console.log("\u26A0\uFE0F Could not fetch installation data by domain:", e);
      }
    }
    if (!installationData) {
      console.log("\u26A0\uFE0F DEBUG: Installation data not found by email or domain");
      console.log("\u26A0\uFE0F DEBUG: Searched for email:", customerData.email);
      console.log("\u26A0\uFE0F DEBUG: Searched for domain:", customerData.customDomain);
      console.log("\u26A0\uFE0F DEBUG: customerData keys:", Object.keys(customerData || {}));
      console.log("\u26A0\uFE0F DEBUG: customerData:", JSON.stringify({
        email: customerData.email,
        customDomain: customerData.customDomain,
        stripeCustomerId: customerData.stripeCustomerId,
        stripeSubscriptionId: customerData.stripeSubscriptionId
      }, null, 2));
      console.log("\u26A0\uFE0F DEBUG: Attempted lookup keys:");
      if (customerData.email) {
        console.log("  - installation-email:" + customerData.email.toLowerCase());
      }
      if (customerData.customDomain) {
        const normalizedDomain = normalizeHost(customerData.customDomain);
        if (normalizedDomain) {
          console.log("  - installation-domain:" + normalizedDomain);
        }
      }
    }
    const firstName = installationData?.firstName || "User";
    const siteName = installationData?.siteName || null;
    const stripeCustomDomain = customerData?.customDomain || null;
    const customDomain2 = stripeCustomDomain || installationData?.customDomain || null;
    const stagingUrl = installationData?.stagingUrl || null;
    const shortName = installationData?.shortName || null;
    const isStaging = !hasActivePayment;
    console.log("\u{1F50D} DEBUG: Final values before webhook:", {
      firstName,
      siteName,
      customDomain: customDomain2,
      stagingUrl,
      hasActivePayment,
      isStaging,
      subscriptionId: customerData.stripeSubscriptionId,
      paymentStatus: customerData.paymentStatus
    });
    console.log("\u2705 CONFIRMED: Using installation data from frontend + adding payment info:", {
      fromInstallation: {
        firstName,
        siteName,
        customDomain: customDomain2,
        stagingUrl,
        siteId: installationData?.siteId
      },
      addedPaymentInfo: {
        paymentStatus: customerData.paymentStatus,
        subscriptionId: customerData.stripeSubscriptionId,
        customerId: customerData.stripeCustomerId,
        planType: customerData.planType
      },
      clickupFolder: "live"
      // Always live for payment webhooks
    });
    const clickupWebhookUrl = env.MAKE_CLICKUP_WEBHOOK_URL || "https://hook.us1.make.com/2nq5grcxerkoum85ibdhoayngay6j1hg";
    let payloadEmail = "";
    if (customerData.email) {
      payloadEmail = customerData.email;
    } else if (installationData?.encryptedEmail) {
      try {
        payloadEmail = await decryptEmailServerSide(installationData.encryptedEmail, env);
      } catch (e) {
        payloadEmail = installationData?.userEmail || "";
      }
    } else {
      payloadEmail = installationData?.userEmail || "";
    }
    const webhookPayload = {
      event: eventType,
      // Customer information at top level (same as installation - from frontend)
      email: payloadEmail,
      firstName,
      // From installation data
      siteId: installationData?.siteId || null,
      // From installation data
      siteName,
      // From installation data
      userId: installationData?.userId || null,
      // From installation data
      // Additional data from installation (same structure - from frontend)
      customDomain: customDomain2,
      // From installation data
      stagingUrl,
      // From installation data
      shortName,
      // From installation data
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      source: "payment_webhook",
      // ClickUp folder information
      // CRITICAL: Payment webhooks should ONLY fire for active payments
      // If hasActivePayment is true, ALWAYS use 'live' folder, NEVER 'staging'
      clickupFolder: "live",
      // Always 'live' for payment webhooks (payment is active)
      isStaging: false,
      // Always false for payment webhooks (payment is active)
      hasActivePayment: true,
      // Always true (we only send when payment is active)
      // Payment status details (ADDED to installation data - this is the new data)
      paymentStatus: customerData.paymentStatus || "paid",
      subscriptionStatus: customerData.subscriptionStatus || "complete",
      isSubscribed: customerData.isSubscribed || true,
      subscriptionId: customerData.stripeSubscriptionId || null,
      // Payment subscription ID
      customerId: customerData.stripeCustomerId,
      // Payment customer ID
      planType: customerData.planType || null,
      // Payment plan type
      // Keep nested structure for backward compatibility (same as installation)
      customer: {
        email: customerData.email || installationData?.userEmail || "",
        firstName,
        siteId: installationData?.siteId || null,
        siteName,
        userId: installationData?.userId || null
      },
      payment: {
        status: customerData.paymentStatus || "paid",
        subscriptionId: customerData.stripeSubscriptionId || null,
        planType: customerData.planType || null,
        validUntil: customerData.validUntil || null
      },
      // Full Stripe payload for downstream Make routing/mapping
      stripe: stripeObject || null
    };
    const maskedPaymentEmailLog = webhookPayload.email ? webhookPayload.email.replace(/([^@]).*(@.*)/, "$1****$2") : webhookPayload.email;
    console.log("\u{1F680} Sending payment confirmation email via Brevo (email masked):", maskedPaymentEmailLog);
    const paymentEmailSent = await sendPaymentEmail(env, webhookPayload.email, firstName);
    if (!paymentEmailSent) {
      console.warn("\u26A0\uFE0F Brevo payment email failed or returned false for:", maskedPaymentEmailLog);
    }
    console.log(`\u{1F4C1} Sending ClickUp webhook with folder: ${hasActivePayment ? "live" : "staging"}, isStaging: ${isStaging}`);
    const payloadToLog2 = Object.assign({}, webhookPayload, { email: maskedPaymentEmailLog });
    console.log("\u{1F4E4} DEBUG: Full webhook payload being sent to ClickUp (email masked):", JSON.stringify(payloadToLog2, null, 2));
    const clickupWebhookResponse = await fetch(clickupWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(webhookPayload)
    });
    const clickupWebhookResponseText = await clickupWebhookResponse.text();
    console.log("\u{1F4E8} Payment-completed ClickUp webhook response status:", clickupWebhookResponse.status);
    console.log("\u{1F4E8} Payment-completed ClickUp webhook response body:", clickupWebhookResponseText);
    if (!clickupWebhookResponse.ok) {
      console.error("\u274C Payment-completed ClickUp webhook failed:", clickupWebhookResponse.status, clickupWebhookResponseText);
    } else {
      console.log(`\u2705 ClickUp webhook sent successfully (folder: ${hasActivePayment ? "live" : "staging"})`);
      if (dedupeKey && hasActivePayment && customerData.stripeCustomerId) {
        await env.ACCESSIBILITY_AUTH.put(dedupeKey, JSON.stringify({
          sentAt: (/* @__PURE__ */ new Date()).toISOString(),
          eventType,
          customerId: customerData.stripeCustomerId,
          subscriptionId: customerData.stripeSubscriptionId || null,
          email: customerData.email || "",
          clickupFolder: "live",
          isStaging: false
        }), { expirationTtl: 90 * 24 * 60 * 60 });
        console.log("\u2705 Deduplication flag set for this customer payment (folder: live)");
        console.log("\u2705 Dedupe key:", dedupeKey);
      }
    }
  } catch (error) {
    console.error("\u274C Error sending payment-completed ClickUp webhook:", error);
  }
}
__name(sendPaymentCompletedClickUpWebhook, "sendPaymentCompletedClickUpWebhook");
async function updatePaymentSnapshotForSite(env, siteId, { status, currentPeriodEnd }) {
  if (!siteId || !status && currentPeriodEnd == null) return;
  const key = `payment:${siteId}`;
  const existingStr = await env.ACCESSIBILITY_AUTH.get(key);
  const existing = existingStr ? JSON.parse(existingStr) : {};
  const merged = {
    ...existing,
    status: status ?? existing.status,
    currentPeriodEnd: currentPeriodEnd ?? existing.currentPeriodEnd,
    lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
  };
  await env.ACCESSIBILITY_AUTH.put(key, JSON.stringify(merged));
}
__name(updatePaymentSnapshotForSite, "updatePaymentSnapshotForSite");
async function upsertCustomerRecord(env, customerId, updates) {
  if (!customerId) return null;
  const customerKey = `customer:${customerId}`;
  const existingStr = await env.ACCESSIBILITY_AUTH.get(customerKey);
  const existing = existingStr ? JSON.parse(existingStr) : {};
  const merged = mergeCustomerFields(existing, updates);
  merged.stripeCustomerId = customerId;
  merged.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
  if (!merged.created) merged.created = (/* @__PURE__ */ new Date()).toISOString();
  await env.ACCESSIBILITY_AUTH.put(customerKey, JSON.stringify(merged));
  if (merged.customDomain) {
    const keys = buildDomainIndexKeys(merged.customDomain);
    for (const k of keys) {
      const existing2 = await env.ACCESSIBILITY_AUTH.get(k);
      if (existing2 !== customerId) {
        await env.ACCESSIBILITY_AUTH.put(k, customerId);
      }
    }
    try {
      await cleanupLegacyDomainKeys(env, merged.customDomain);
    } catch {
    }
  }
  if (merged.email) {
    await env.ACCESSIBILITY_AUTH.put(`email:${merged.email.toLowerCase()}`, customerId);
  }
  await syncPaidCustomerRecord(env, merged);
  return merged;
}
__name(upsertCustomerRecord, "upsertCustomerRecord");
async function syncPaidCustomerRecord(env, customerData) {
  const paidKv = env.ACCESSBIT_PAID;
  if (!paidKv || !customerData?.stripeCustomerId) return;
  const hasActivePayment = customerData.isSubscribed === true && customerData.paymentStatus === "paid";
  const customerId = customerData.stripeCustomerId;
  const customerKey = `customer:${customerId}`;
  const subKey = customerData.stripeSubscriptionId ? `subscription:${customerData.stripeSubscriptionId}` : null;
  const siteKey = customerData.siteId ? `site:${customerData.siteId}` : null;
  if (hasActivePayment) {
    const paidRecord = {
      stripeCustomerId: customerId,
      stripeSubscriptionId: customerData.stripeSubscriptionId || null,
      siteId: customerData.siteId || null,
      email: customerData.email || null,
      customDomain: customerData.customDomain || null,
      paymentStatus: customerData.paymentStatus || null,
      subscriptionStatus: customerData.subscriptionStatus || null,
      isSubscribed: customerData.isSubscribed === true,
      planType: customerData.planType || null,
      validUntil: customerData.validUntil || null,
      created: customerData.created || (/* @__PURE__ */ new Date()).toISOString(),
      lastUpdated: customerData.lastUpdated || (/* @__PURE__ */ new Date()).toISOString()
    };
    await paidKv.put(customerKey, JSON.stringify(paidRecord));
    if (subKey) await paidKv.put(subKey, customerId);
    if (siteKey) await paidKv.put(siteKey, customerId);
    return;
  }
}
__name(syncPaidCustomerRecord, "syncPaidCustomerRecord");
async function handleFixDomainIndex(request, env) {
  const origin = request.headers.get("origin");
  try {
    const url = new URL(request.url);
    const customerId = url.searchParams.get("customerId");
    if (!customerId) {
      return addSecurityAndCorsHeaders(secureJsonResponse({
        error: "Missing customerId parameter"
      }), origin);
    }
    const customerKey = `customer:${customerId}`;
    const customerDataStr = await env.ACCESSIBILITY_AUTH.get(customerKey);
    if (!customerDataStr) {
      return addSecurityAndCorsHeaders(secureJsonResponse({
        error: "Customer data not found"
      }), origin);
    }
    const customerData = JSON.parse(customerDataStr);
    console.log("\u{1F50D} Found customer data:", customerData);
    if (customerData.customDomain) {
      const domainKey1 = `domain:${customerData.customDomain}`;
      const domainKey2 = `domain:${customerData.customDomain.replace(/\/$/, "")}`;
      console.log("\u{1F50D} Creating domain keys:", { domainKey1, domainKey2 });
      await env.ACCESSIBILITY_AUTH.put(domainKey1, customerId);
      await env.ACCESSIBILITY_AUTH.put(domainKey2, customerId);
      return addSecurityAndCorsHeaders(secureJsonResponse({
        success: true,
        domainKeys: [domainKey1, domainKey2],
        customerId,
        customDomain: customerData.customDomain
      }), origin);
    }
    return addSecurityAndCorsHeaders(secureJsonResponse({
      error: "No customDomain found in customer data"
    }), origin);
  } catch (error) {
    console.error("Error in handleFixDomainIndex:", error);
    return addSecurityAndCorsHeaders(secureJsonResponse({
      error: "Internal server error",
      details: String(error)
    }, 500), origin);
  }
}
__name(handleFixDomainIndex, "handleFixDomainIndex");
async function handleDebugKVKeys(request, env) {
  const origin = request.headers.get("origin");
  try {
    const url = new URL(request.url);
    const searchTerm = url.searchParams.get("search") || "";
    return addSecurityAndCorsHeaders(secureJsonResponse({
      message: "Debug KV keys check - use specific search terms",
      searchTerm,
      note: "This endpoint is for debugging only"
    }), origin);
  } catch (error) {
    console.error("Error in handleDebugKVKeys:", error);
    return addSecurityAndCorsHeaders(secureJsonResponse({
      error: "Internal server error",
      details: String(error)
    }, 500), origin);
  }
}
__name(handleDebugKVKeys, "handleDebugKVKeys");
async function handleCustomerDataByDomain(request, env) {
  const origin = request.headers.get("origin");
  try {
    const url = new URL(request.url);
    const domainParamRaw = url.searchParams.get("domain") || "";
    const host = normalizeHost(domainParamRaw);
    console.log("\u{1F50D} Domain lookup request:", { domainParam: domainParamRaw, normalizedHost: host, url: request.url });
    if (!host) {
      console.log("\u274C No domain parameter provided");
      return addSecurityAndCorsHeaders(secureJsonResponse({}), origin);
    }
    if (/\.webflow\.io$/i.test(host)) {
      return addSecurityAndCorsHeaders(secureJsonResponse({
        isSubscribed: true,
        subscriptionStatus: "active",
        paymentStatus: "paid",
        isStagingDomain: true,
        // Flag to indicate this is staging, not real payment
        stripeSubscriptionId: null,
        // Explicitly no subscription ID
        subscriptionId: null
      }), origin);
    }
    const hostNoWww = host.replace(/^www\./, "");
    const keysToTry = [`domain:${hostNoWww}`, `domain:www.${hostNoWww}`];
    console.log("\u{1F50D} Looking up domain keys:", keysToTry);
    let customerId = null;
    for (const k of keysToTry) {
      customerId = await env.ACCESSIBILITY_AUTH.get(k);
      if (customerId) {
        break;
      }
    }
    console.log("\u{1F50D} Found customer ID:", customerId);
    if (!customerId) {
      console.log("\u274C No customer ID found for domain");
      return addSecurityAndCorsHeaders(secureJsonResponse({}), origin);
    }
    const customerKey = `customer:${customerId}`;
    console.log("\u{1F50D} Looking up customer key:", customerKey);
    const customerDataStr = await env.ACCESSIBILITY_AUTH.get(customerKey);
    let customerData = customerDataStr ? JSON.parse(customerDataStr) : {};
    console.log("\u2705 Found customer data:", customerData);
    let enriched = false;
    if (!customerData.customDomain && domainParamRaw) {
      customerData.customDomain = domainParamRaw;
      enriched = true;
    }
    if (customerData.stripeSubscriptionId && !customerData.validUntil) {
      try {
        const sub = await getSubscriptionById(env, customerData.stripeSubscriptionId);
        if (sub) {
          const periodEnd = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end;
          if (periodEnd) {
            customerData.validUntil = new Date(periodEnd * 1e3).toISOString();
            if (!customerData.planType && sub.items?.data?.[0]?.price) {
              const price = sub.items.data[0].price;
              customerData.planType = price.recurring?.interval === "year" ? "annual" : "monthly";
            }
            customerData.subscriptionStatus = sub.status === "active" ? "complete" : customerData.subscriptionStatus || "incomplete";
            customerData.paymentStatus = sub.status === "active" ? "paid" : customerData.paymentStatus || "unpaid";
            customerData.isSubscribed = sub.status === "active" ? true : !!customerData.isSubscribed;
            enriched = true;
          }
        }
      } catch (e) {
        console.log("\u26A0\uFE0F Enrichment by subscription ID failed:", e);
      }
    }
    if ((!customerData.stripeSubscriptionId || !customerData.planType || !customerData.validUntil) && customerId) {
      try {
        const subsRes = await fetch(`https://api.stripe.com/v1/subscriptions?customer=${customerId}&limit=1`, {
          headers: {
            "Authorization": `Bearer ${env.STRIPE_SECRET_KEY}`,
            "Content-Type": "application/x-www-form-urlencoded"
          }
        });
        if (subsRes.ok) {
          const subs = await subsRes.json();
          if (subs.data && subs.data.length > 0) {
            const sub = subs.data[0];
            if (!customerData.stripeSubscriptionId) customerData.stripeSubscriptionId = sub.id;
            const price = sub.items?.data?.[0]?.price;
            if (!customerData.planType && price?.recurring?.interval) {
              customerData.planType = price.recurring.interval === "year" ? "annual" : "monthly";
            }
            if (!customerData.validUntil && sub.current_period_end) {
              customerData.validUntil = new Date(sub.current_period_end * 1e3).toISOString();
            }
            customerData.subscriptionStatus = sub.status === "active" ? "complete" : customerData.subscriptionStatus || "incomplete";
            customerData.paymentStatus = sub.status === "active" ? "paid" : customerData.paymentStatus || "unpaid";
            customerData.isSubscribed = sub.status === "active" ? true : !!customerData.isSubscribed;
            enriched = true;
          }
        }
      } catch (e) {
        console.log("\u26A0\uFE0F Enrichment fetch error:", e);
      }
    }
    if (enriched) {
      customerData.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
      await env.ACCESSIBILITY_AUTH.put(customerKey, JSON.stringify(customerData));
      console.log("\u2705 Enriched and saved customer data:", customerData);
    }
    const resp = secureJsonResponse(customerData);
    try {
      resp.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    } catch {
    }
    return addSecurityAndCorsHeaders(resp, origin);
  } catch (error) {
    console.error("Error in handleCustomerDataByDomain:", error);
    return addSecurityAndCorsHeaders(secureJsonResponse({
      error: "Internal server error"
    }, 500), origin);
  }
}
__name(handleCustomerDataByDomain, "handleCustomerDataByDomain");
async function handleCreateCheckoutSession(request, env) {
  const origin = request.headers.get("origin");
  try {
    const { siteId, planType, successUrl, cancelUrl } = await request.json();
    if (!siteId || !planType) {
      return addSecurityAndCorsHeaders(secureJsonResponse({
        error: "Missing required parameters: siteId and planType"
      }, 400), origin);
    }
    const priceId = planType === "annual" ? "price_1QXXXXXX" : "price_1QXXXXXX";
    const session = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        "mode": "subscription",
        "line_items[0][price]": priceId,
        "line_items[0][quantity]": "1",
        "success_url": successUrl,
        "cancel_url": cancelUrl,
        "metadata[siteId]": siteId,
        "metadata[planType]": planType,
        "subscription_data[metadata][siteId]": siteId,
        "subscription_data[metadata][planType]": planType,
        "customer_email": ""
        // Will be collected during checkout
      })
    });
    if (!session.ok) {
      const error = await session.text();
      return addSecurityAndCorsHeaders(secureJsonResponse({
        error: "Failed to create checkout session",
        details: error
      }, 500), origin);
    }
    const sessionData = await session.json();
    return addSecurityAndCorsHeaders(secureJsonResponse({
      success: true,
      url: sessionData.url,
      sessionId: sessionData.id
    }, 200), origin);
  } catch (error) {
    return addSecurityAndCorsHeaders(secureJsonResponse({
      error: "Internal server error",
      message: error.message
    }, 500), origin);
  }
}
__name(handleCreateCheckoutSession, "handleCreateCheckoutSession");
var REMINDER_MESSAGES = {
  7: {
    subject: "Welcome to AccessBit; Your Setup Is Ready",
    tag: "7day"
  },
  30: {
    subject: "Any help needed with AccessBit?",
    tag: "30day"
  },
  60: {
    subject: "Ready to launch AccessBit on your live site?",
    tag: "60day"
  },
  90: {
    subject: "We\u2019re here whenever you\u2019re ready",
    tag: "90day"
  }
};
async function sendReminderEmail(env, email, firstName, day) {
  if (!env.BREVO_API_KEY || !email || !email.includes("@")) return false;
  const msg = REMINDER_MESSAGES[day] || REMINDER_MESSAGES[7];
  const name = firstName || (email.split("@")[0] || "there");
  let htmlBody;
  let textBody;
  if (day === 7) {
    htmlBody = `
      <p>Hello ${name},</p>
      <p>Thank you for installing AccessBit on your Webflow site!</p>
      <p>The AccessBit Support Team is excited to help you manage accessibility user consent smoothly and efficiently.</p>
      <p>We noticed that AccessBit is currently set up on your staging site. To activate it on your live domain, please upgrade your plan.</p>
      <p><strong>Check out the installation videos:</strong></p>
      <ul>
        <li><a href="https://vimeo.com/1170089748" style="color:#007BFF; text-decoration:none;">AccessBit Installation part 1</a></li>
        <li><a href="https://vimeo.com/1170089799" style="color:#007BFF; text-decoration:none;">AccessBit Installation part 2</a></li>
        <li><a href="https://vimeo.com/1170089848" style="color:#007BFF; text-decoration:none;">AccessBit Installation part 3</a></li>
      </ul>
      <p>If you have any questions, visit our <a href="https://www.accessbit.io/help-center" style="color:#007BFF; text-decoration:none;">AccessBit Help Center</a> for guides and FAQs.</p>
      <p>We\u2019d also love to hear your feedback:</p>
      <ul>
        <li>Is there anything you\u2019d like us to add?</li>
        <li>How easy was the setup process?</li>
        <li>Do you need help moving to your live site?</li>
        <li>Are there any features you miss from other apps?</li>
      </ul>
      <p>Please feel free to reply to this email with your thoughts or any questions; we\u2019re happy to assist you with the upgrade and setup.</p>
      <p>Thank you again for choosing AccessBit!</p>
      <p>Best regards,<br>AccessBit Support Team</p>
      <p>
        <a href="https://www.accessbit.io/" style="color:#007BFF; text-decoration:none;">accessbit.io</a><br>
        Office: (206) 414-9687
      </p>
    `;
    textBody = `Hello ${name},

Thank you for installing AccessBit on your Webflow site!

The AccessBit Support Team is excited to help you manage accessibility user consent smoothly and efficiently.

We noticed that AccessBit is currently set up on your staging site. To activate it on your live domain, please upgrade your plan.

Check out the installation videos:
- AccessBit Installation part 1
- AccessBit Installation part 2
- AccessBit Installation part 3

If you have any questions, visit our AccessBit Help Center for guides and FAQs: https://www.accessbit.io/help-center

We\u2019d also love to hear your feedback:
- \u2022 Is there anything you\u2019d like us to add?
- \u2022 How easy was the setup process?
- \u2022 Do you need help moving to your live site?
- \u2022 Are there any features you miss from other apps?

Please feel free to reply to this email with your thoughts or any questions; we\u2019re happy to assist you with the upgrade and setup.

Thank you again for choosing AccessBit!

Best regards,
AccessBit Support Team

accessbit.io
Office: (206) 414-9687`;
  } else if (day === 30) {
    htmlBody = `
      <p>Hello ${name},</p>
      <p>We are following up regarding your AccessBit setup. We noticed it\u2019s currently running on your staging site; you can upgrade your plan anytime to activate it on your live domain.</p>
      <p><strong>Check out the installation videos:</strong></p>
      <ul>
        <li><a href="https://vimeo.com/1170089748" style="color:#007BFF; text-decoration:none;">AccessBit Installation part 1</a></li>
        <li><a href="https://vimeo.com/1170089799" style="color:#007BFF; text-decoration:none;">AccessBit Installation part 2</a></li>
        <li><a href="https://vimeo.com/1170089848" style="color:#007BFF; text-decoration:none;">AccessBit Installation part 3</a></li>
      </ul>
      <p>If you have any questions, visit our <a href="https://www.accessbit.io/help-center" style="color:#007BFF; text-decoration:none;">AccessBit Help Center</a> for guides and FAQs.</p>
      <p>If you need any help or have feedback, feel free to reply to this email. We\u2019re happy to assist!</p>
      <p>Best regards,<br>AccessBit Support Team</p>
      <p>
        <a href="https://www.accessbit.io/" style="color:#007BFF; text-decoration:none;">accessbit.io</a><br>
        Office: (206) 414-9687
      </p>
    `;
    textBody = `Hello ${name},

We are following up regarding your AccessBit setup. We noticed it\u2019s currently running on your staging site; you can upgrade your plan anytime to activate it on your live domain.

Check out the installation videos:
- AccessBit Installation part 1
- AccessBit Installation part 2
- AccessBit Installation part 3

If you have any questions, visit our AccessBit Help Center for guides and FAQs: https://www.accessbit.io/help-center

If you need any help or have feedback, feel free to reply to this email. We\u2019re happy to assist!

Best regards,
AccessBit Support Team

accessbit.io
Office: (206) 414-9687`;
  } else if (day === 60) {
    htmlBody = `
      <p>Hello ${name},</p>
      <p>We wanted to quickly follow up and see how things are going with AccessBit. If you\u2019re planning to move it to your live site, you can upgrade your plan anytime to get started.</p>
      <p><strong>Check out the installation videos:</strong></p>
      <ul>
        <li><a href="https://vimeo.com/1170089748" style="color:#007BFF; text-decoration:none;">AccessBit Installation part 1</a></li>
        <li><a href="https://vimeo.com/1170089799" style="color:#007BFF; text-decoration:none;">AccessBit Installation part 2</a></li>
        <li><a href="https://vimeo.com/1170089848" style="color:#007BFF; text-decoration:none;">AccessBit Installation part 3</a></li>
      </ul>
      <p>If you have any questions, visit our <a href="https://www.accessbit.io/help-center" style="color:#007BFF; text-decoration:none;">AccessBit Help Center</a> for guides and FAQs.</p>
      <p>Let us know if you need assistance or have any questions; we\u2019re here to help!</p>
      <p>Best regards,<br>AccessBit Support Team</p>
      <p>
        <a href="https://www.accessbit.io/" style="color:#007BFF; text-decoration:none;">accessbit.io</a><br>
        Office: (206) 414-9687
      </p>
    `;
    textBody = `Hello ${name},

We wanted to quickly follow up and see how things are going with AccessBit. If you\u2019re planning to move it to your live site, you can upgrade your plan anytime to get started.

Check out the installation videos:
- AccessBit Installation part 1
- AccessBit Installation part 2
- AccessBit Installation part 3

If you have any questions, visit our AccessBit Help Center for guides and FAQs: https://www.accessbit.io/help-center

Let us know if you need assistance or have any questions; we\u2019re here to help!

Best regards,
AccessBit Support Team

accessbit.io
Office: (206) 414-9687`;
  } else {
    htmlBody = `
      <p>Hello ${name},</p>
      <p>This is a quick final follow-up regarding your AccessBit setup. If you\u2019re still planning to use AccessBit on your live site, you can upgrade your plan anytime to activate it.</p>
      <p><strong>Check out the installation videos:</strong></p>
      <ul>
        <li><a href="https://vimeo.com/1170089748" style="color:#007BFF; text-decoration:none;">AccessBit Installation part 1</a></li>
        <li><a href="https://vimeo.com/1170089799" style="color:#007BFF; text-decoration:none;">AccessBit Installation part 2</a></li>
        <li><a href="https://vimeo.com/1170089848" style="color:#007BFF; text-decoration:none;">AccessBit Installation part 3</a></li>
      </ul>
      <p>If you have any questions, visit our <a href="https://www.accessbit.io/help-center" style="color:#007BFF; text-decoration:none;">AccessBit Help Center</a> for guides and FAQs.</p>
      <p>If now isn\u2019t the right time, no worries; feel free to reach out whenever you\u2019re ready or if you need any assistance.</p>
      <p>Thank you for trying AccessBit, and we\u2019re always here if you need help.</p>
      <p>Best regards,<br>AccessBit Support Team</p>
      <p>
        <a href="https://www.accessbit.io/" style="color:#007BFF; text-decoration:none;">accessbit.io</a><br>
        Office: (206) 414-9687
      </p>
    `;
    textBody = `Hello ${name},

This is a quick final follow-up regarding your AccessBit setup. If you\u2019re still planning to use AccessBit on your live site, you can upgrade your plan anytime to activate it.

Check out the installation videos:
- AccessBit Installation part 1
- AccessBit Installation part 2
- AccessBit Installation part 3

If you have any questions, visit our AccessBit Help Center for guides and FAQs: https://www.accessbit.io/help-center

If now isn\u2019t the right time, no worries; feel free to reach out whenever you\u2019re ready or if you need any assistance.

Thank you for trying AccessBit, and we\u2019re always here if you need help.

Best regards,
AccessBit Support Team

accessbit.io
Office: (206) 414-9687`;
  }
  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": env.BREVO_API_KEY,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        sender: { name: "AccessBit Team", email: "web@accessbit.io" },
        to: [{ email, name: firstName || "User" }],
        subject: msg.subject,
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            ${htmlBody}
          </div>
        `,
        textContent: textBody,
        tags: ["reminder", msg.tag]
      })
    });
    if (response.ok) {
      console.log(`[CRON] ${day}-day reminder sent: ${email}`);
      return true;
    }
    console.warn(`[CRON] Brevo reminder failed (${response.status}):`, await response.text());
    return false;
  } catch (err) {
    console.error(`[CRON] Brevo reminder send failed for ${email}:`, err);
    return false;
  }
}
__name(sendReminderEmail, "sendReminderEmail");
var REMINDER_DAYS = [90, 60, 30, 7];
var MS_PER_DAY = 24 * 60 * 60 * 1e3;
async function handle7DayReminderCron(env) {
  const now = Date.now();
  let cursor;
  let sent = 0;
  let skipped = 0;
  let errors = 0;
  const sentByDay = { 7: 0, 30: 0, 60: 0, 90: 0 };
  const prefix = "installation_";
  try {
    do {
      const list = await env.ACCESSIBILITY_AUTH.list({ prefix, limit: 100, cursor });
      cursor = list.cursor;
      for (const key of list.keys || []) {
        const siteId = key.name.startsWith(prefix) ? key.name.slice(prefix.length) : key.name;
        if (!siteId) continue;
        try {
          const installationStr = await env.ACCESSIBILITY_AUTH.get(key.name);
          if (!installationStr) continue;
          const installation = JSON.parse(installationStr);
          const installedAt = installation.installedAt ? new Date(installation.installedAt).getTime() : 0;
          if (!installedAt) {
            skipped++;
            continue;
          }
          const daysSinceInstall = Math.floor((now - installedAt) / MS_PER_DAY);
          if (daysSinceInstall < 7) {
            skipped++;
            continue;
          }
          const paymentStr = await env.ACCESSIBILITY_AUTH.get(`payment:${siteId}`);
          if (paymentStr) {
            try {
              const payment = JSON.parse(paymentStr);
              const paid = payment.paymentStatus === "paid" || payment.status === "active";
              if (paid) {
                skipped++;
                continue;
              }
            } catch (_) {
            }
          }
          const email = installation.userEmail || installation.installationData?.email;
          if (!email || !email.includes("@")) {
            skipped++;
            continue;
          }
          let reminderDay = null;
          for (const day of REMINDER_DAYS) {
            if (daysSinceInstall >= day) {
              const alreadySent = await env.ACCESSIBILITY_AUTH.get(`reminder_${day}day_sent:${siteId}`);
              if (!alreadySent) {
                reminderDay = day;
                break;
              }
            }
          }
          if (reminderDay === null) {
            skipped++;
            continue;
          }
          const firstName = installation.firstName || installation.installationData?.firstName || email && email.split("@")[0] || "User";
          const ok = await sendReminderEmail(env, email, firstName, reminderDay);
          if (ok) {
            await env.ACCESSIBILITY_AUTH.put(
              `reminder_${reminderDay}day_sent:${siteId}`,
              Date.now().toString(),
              { expirationTtl: 86400 * 365 }
            );
            sent++;
            sentByDay[reminderDay] = (sentByDay[reminderDay] || 0) + 1;
          } else {
            errors++;
          }
        } catch (e) {
          console.error(`[CRON] Error processing ${key.name}:`, e);
          errors++;
        }
      }
    } while (cursor);
    console.log(
      `[CRON] Reminder cron finished: sent=${sent} (7d=${sentByDay[7] || 0} 30d=${sentByDay[30] || 0} 60d=${sentByDay[60] || 0} 90d=${sentByDay[90] || 0}) skipped=${skipped} errors=${errors}`
    );
  } catch (e) {
    console.error("[CRON] Reminder cron failed:", e);
    throw e;
  }
}
__name(handle7DayReminderCron, "handle7DayReminderCron");
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map
