# How to Test the Payment Flow (validUntil + payment snapshot updates)

After deploying the worker, use these steps to verify that:
1. **customer_to_site** index is written when a new subscription is created
2. **payment:${siteId}** is updated when Stripe sends renewal / pay-again / cancel webhooks
3. The widget sees the updated period and shows or hides correctly

---

## Prerequisites

- Worker deployed (e.g. to `https://app.accessbit.io`)
- Stripe webhook endpoint: `https://app.accessbit.io/api/stripe/webhook` (and configured in Stripe Dashboard with events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`)
- A test siteId and customerId (or use a real subscription)

---

## Test 1: New subscription → customer_to_site and payment snapshot

**Goal:** After a **new** subscription is created via your app (create-subscription with siteId), KV should have:
- `customer_to_site:${customerId}` = siteId
- `payment:${siteId}` with `currentPeriodEnd` and `status: 'active'`

**Steps:**

1. Create a new subscription through your app (so the create-subscription handler runs with a **siteId** and **customerId**).
2. Check KV (or use your debug endpoint):
   - **customer_to_site:** In Cloudflare KV, look up key `customer_to_site:cus_XXXXX` (use the Stripe customer ID from the subscription). Value should be the **siteId**.
   - **payment snapshot:** Call:
     ```bash
     curl.exe "https://app.accessbit.io/api/accessibility/debug-payment?siteId=YOUR_SITE_ID"
     ```
     Response should include `paymentData` with `currentPeriodEnd` (Unix seconds) and `status: "active"`.

**Pass:** You see `customer_to_site:cus_XXX` = siteId and `payment:${siteId}` has `currentPeriodEnd` and `status: 'active'`.

---

## Test 2: Automatic charging (renewal) → payment snapshot updated

**Goal:** When Stripe auto-charges (renewal), Stripe sends `invoice.payment_succeeded` (and often `customer.subscription.updated`). The worker should update **payment:${siteId}** with the **new** `currentPeriodEnd` so the widget shows full experience again.

**Option A – Wait for real renewal**

1. Use a test subscription that renews soon (or use Stripe test clock to advance time).
2. After renewal, call:
   ```bash
   curl.exe "https://app.accessbit.io/api/accessibility/debug-payment?siteId=YOUR_SITE_ID"
   ```
3. Check `paymentData.currentPeriodEnd` and `paymentData.lastUpdated` – they should reflect the **new** period (e.g. next month).

**Option B – Replay a Stripe event (recommended)**

1. In **Stripe Dashboard** → **Developers** → **Webhooks** → your webhook endpoint → **Recent deliveries**.
2. Find a successful **invoice.payment_succeeded** (or **customer.subscription.updated**) delivery for the customer/site you care about.
3. Click **Resend** (replay) the event.
4. After a few seconds, call the debug endpoint again:
   ```bash
   curl.exe "https://app.accessbit.io/api/accessibility/debug-payment?siteId=YOUR_SITE_ID"
   ```
5. Check `paymentData.currentPeriodEnd` and `paymentData.lastUpdated` – they should be updated to the period from the replayed event.

**Pass:** After the webhook runs, `payment:${siteId}` has a new `currentPeriodEnd` and recent `lastUpdated`.

---

## Test 3: User loses widget, then repays (checkout.session.completed)

**Goal:** When a user pays again (e.g. new Checkout Session) for the **same** site, the worker should update **payment:${siteId}** so the widget comes back.

**Option A – Real pay-again flow**

1. Use a customer/site that previously had a subscription that expired (or cancel a test subscription so the widget is limited).
2. Have the user (or you) go through Stripe Checkout again for the same site (same customer, same or new subscription).
3. After checkout completes, Stripe sends **checkout.session.completed**.
4. Call:
   ```bash
   curl.exe "https://app.accessbit.io/api/accessibility/debug-payment?siteId=YOUR_SITE_ID"
   ```
5. Check `paymentData.currentPeriodEnd` and `status` – they should reflect the new subscription period.

**Option B – Replay checkout.session.completed**

1. In Stripe Dashboard → Webhooks → Recent deliveries, find a **checkout.session.completed** event for your test customer/site.
2. **Resend** the event.
3. Check the debug endpoint again – **payment:${siteId}** should be updated **if** the worker can resolve **siteId** (from `session.metadata.siteId` or from `customer_to_site:${customerId}`).  
   - If this was the **first** subscription for that customer, **customer_to_site** was set at create-subscription, so replaying **checkout.session.completed** should still find siteId and update payment.
   - If the customer never went through create-subscription (e.g. Checkout-only flow), set **metadata.siteId** when creating the Checkout Session so the worker can update **payment:${siteId}**.

**Pass:** After checkout (or replay), `payment:${siteId}` has the new period and the widget shows full experience on next load.

---

## Test 4: Subscription canceled / deleted → widget stops

**Goal:** When a subscription is canceled or deleted, **payment:${siteId}** should get `status: 'canceled'` so the widget shows the limited experience.

**Steps:**

1. In Stripe Dashboard, **cancel** a test subscription (or wait for **customer.subscription.deleted** after non-payment).
2. Call:
   ```bash
   curl.exe "https://app.accessbit.io/api/accessibility/debug-payment?siteId=YOUR_SITE_ID"
   ```
3. Check `paymentData.status` – it should be **"canceled"** (and the widget script checks `status === 'active'`, so the widget will show limited).

**Pass:** `payment:${siteId}.status` is `"canceled"` and the widget shows limited on next load.

---

## Test 5: Widget behavior (end-to-end)

**Goal:** Confirm the widget shows full vs limited based on **payment:${siteId}** (status + currentPeriodEnd).

1. **Full widget:** Use a siteId that has **payment:${siteId}** with `status: 'active'` and `currentPeriodEnd` in the **future**. Load the site (with widget script URL including that siteId or domain). You should see the full widget.
2. **Limited widget:** Either:
   - Use a siteId with `status: 'canceled'`, or  
   - Use a siteId with `currentPeriodEnd` in the **past** (or temporarily change KV for testing).  
   Reload the site. You should see the limited (unpaid) experience.

**Pass:** Widget state matches `payment:${siteId}.status` and `now < currentPeriodEnd`.

---

## Quick reference: useful URLs (replace base URL if different)

- **Customer data by domain (validUntil):**  
  `GET https://app.accessbit.io/api/stripe/customer-data-by-domain?domain=team-snm.com`
- **Debug payment (payment snapshot for siteId):**  
  `GET https://app.accessbit.io/api/accessibility/debug-payment?siteId=YOUR_SITE_ID`

Use **curl.exe** on Windows to avoid PowerShell’s Invoke-WebRequest security prompt.
