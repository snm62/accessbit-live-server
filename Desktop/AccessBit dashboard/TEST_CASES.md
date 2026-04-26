# AccessBit — Full Test Cases

## How to read this doc
- **Expected** = what should happen if everything works correctly
- **Check** = where to verify the result (Dashboard / KV / D1 / Widget)
- ✅ Pass / ❌ Fail

---

## 1. Flow 1 — Purchase from Webflow App (Payment Link)

### TC-1.1 — Successful purchase with domain entered
**Steps:**
1. Open Webflow App inside Webflow Designer
2. Click the Stripe payment link
3. Fill in your domain (e.g. `team-snm.com`) in the custom field
4. Complete payment with a test card (`4242 4242 4242 4242`)

**Expected:**
- Stripe webhook fires within 5 seconds
- Memberstack account auto-created with the purchase email
- Site appears in **My Sites** with domain `team-snm.com` and status **Active**
- License key appears in **License Keys → Active tab** with domain `team-snm.com`
- KV entry `domain:team-snm.com` = `{ status: "active", licenseKey: "AB-...", email: "..." }`
- Widget loads on `team-snm.com` after site is published

**Check:** Dashboard → My Sites, Dashboard → License Keys → Active tab, Cloudflare KV viewer

---

### TC-1.2 — Purchase WITHOUT entering a domain
**Steps:**
1. Complete payment but leave the domain custom field blank

**Expected:**
- Site appears in **My Sites** with domain **N/A** and status **Not Assigned**
- License key appears in **License Keys → Not Assigned tab**
- No KV entry written (widget stays off)
- User can later use "Assign Domain" from dots menu to fix this

**Check:** Dashboard → My Sites → domain shows N/A

---

### TC-1.3 — Purchase with domain entered with https:// prefix
**Steps:**
1. Enter `https://team-snm.com/` in the domain field (with protocol and slash)
2. Complete payment

**Expected:**
- Domain is cleaned and saved as `team-snm.com` (no protocol, no trailing slash)
- Widget works correctly on `team-snm.com`

---

### TC-1.4 — Purchase with the same email that already has an account
**Steps:**
1. Purchase again using an email that already has a Memberstack account

**Expected:**
- Memberstack does NOT create a duplicate account
- New site and license key are added to the existing account
- Both appear in the dashboard when logged in

---

### TC-1.5 — Purchase with a different email than Webflow account
**Steps:**
1. User's Webflow account email: `webflow@test.com`
2. Purchase using a different email: `billing@test.com`

**Expected:**
- Memberstack account created for `billing@test.com`
- User logs in to dashboard with `billing@test.com`
- Site and license key visible
- User can still activate via Webflow App popup (key-only lookup, no email required)

---

## 2. Flow 2 — Single Site Purchase from Dashboard

### TC-2.1 — Successful single site purchase
**Steps:**
1. Log in to dashboard
2. Go to **My Sites**
3. Click **Add Site**
4. Enter domain `mysite.com`
5. Select **Monthly** billing
6. Click **Purchase — $24/mo**
7. Complete Stripe checkout with test card

**Expected:**
- Redirected back to dashboard after payment
- Site appears in My Sites with domain `mysite.com` and status **Active**
- License key in License Keys → Active tab with domain `mysite.com`
- KV entry written: `domain:mysite.com → active`
- Widget loads on `mysite.com`

---

### TC-2.2 — Single site purchase with Annual billing
**Steps:**
1. Same as TC-2.1 but select **Annually — $19/mo**

**Expected:**
- Stripe checkout shows annual plan price
- After payment, site shows billing period as **Annually**
- License key shows billing period as **Annually**

---

### TC-2.3 — Clicking Purchase without entering a domain
**Steps:**
1. Open Add Site modal
2. Leave domain blank
3. Try to click Purchase button

**Expected:**
- Purchase button is **disabled** — cannot click
- No Stripe redirect happens

---

### TC-2.4 — Closing the modal during checkout (abandonment)
**Steps:**
1. Click Purchase → redirected to Stripe
2. Click Cancel/Back on the Stripe page

**Expected:**
- Redirected back to My Sites page with no new site added
- No charge made
- No record created in database

---

## 3. Flow 3 — Bulk Purchase from Dashboard

### TC-3.1 — Bulk purchase with minimum 2 keys (Monthly)
**Steps:**
1. Go to **License Keys** page
2. Click **Purchase License Key**
3. Set quantity to **2**
4. Select **Monthly — $24/mo per key**
5. Click **Pay Now**
6. Complete Stripe checkout

**Expected:**
- Total shown in modal: **$48** before clicking Pay Now
- After payment: 2 license keys appear in **License Keys → Not Assigned tab**
- Both keys have no domain assigned
- No KV entry written yet
- Both keys show billing period **Monthly**

---

### TC-3.2 — Bulk purchase with 5 keys (Annual)
**Steps:**
1. Set quantity to 5
2. Select **Annually — $19/mo per key**
3. Click Pay Now → complete payment

**Expected:**
- Total shown: **$95**
- After payment: 5 license keys in Not Assigned tab
- All show billing period **Annually**

---

### TC-3.3 — Try to purchase with quantity below minimum (1 key)
**Steps:**
1. Open Purchase modal
2. Click the minus button to reduce quantity below 2

**Expected:**
- Quantity stops at **2** — cannot go below minimum
- Pay Now button remains active at minimum of 2

---

### TC-3.4 — Try to purchase above maximum (25 keys)
**Steps:**
1. Try to increase quantity above 25

**Expected:**
- Quantity caps at **25** — cannot go higher

---

## 4. Option 1 — Assign to Domain from Dashboard

### TC-4.1 — Assign a Not Assigned key to a domain
**Steps:**
1. Go to License Keys → **Not Assigned tab**
2. Click dots menu (···) on a key
3. Click **Option 1 — Assign to Domain**
4. Enter `mysite.com`
5. Click **Assign Key**

**Expected:**
- Key moves from **Not Assigned** tab to **Active tab**
- Key shows domain `mysite.com` in the Active tab
- KV entry written: `domain:mysite.com → active`
- Widget loads on `mysite.com` after publish

---

### TC-4.2 — Assign with empty domain
**Steps:**
1. Open Assign to Domain modal
2. Leave domain field blank
3. Click Assign Key

**Expected:**
- Button is **disabled** — cannot assign with blank domain

---

### TC-4.3 — Assign domain with https:// prefix
**Steps:**
1. Enter `https://mysite.com/` in domain field
2. Click Assign Key

**Expected:**
- Domain cleaned and saved as `mysite.com`
- Widget validates correctly on `mysite.com`

---

## 5. Option 2 — Activate via Webflow App Popup

### TC-5.1 — Activate with a valid license key (domain already in dashboard)
**Steps:**
1. User has purchased from dashboard — domain `mysite.com` is listed
2. Open Webflow App in Webflow Designer
3. Click **Activate License Key** button
4. Domain field auto-fills with `mysite.com` (fetched from dashboard)
5. Paste license key `AB-XXXXX-XXXXX-XXXXX`
6. Click **Save**

**Expected:**
- Success message: "Widget activated for mysite.com. Publish your site to apply."
- Modal closes after 2.5 seconds
- KV entry written: `domain:mysite.com → active`
- Widget loads after Webflow publish

---

### TC-5.2 — Activate with a valid key (no domain in dashboard yet)
**Steps:**
1. User has a Not Assigned key — no domain purchased yet
2. Open Webflow App → Activate License Key
3. Domain field is **empty** (no purchased domain to fetch)
4. Manually type `mysite.com`
5. Paste license key
6. Click Save

**Expected:**
- Same success flow as TC-5.1
- Domain field does NOT auto-fill the `.webflow.io` staging domain

---

### TC-5.3 — Activate with an invalid/wrong license key
**Steps:**
1. Enter domain `mysite.com`
2. Enter a made-up key `AB-WRONG-WRONG-WRONG`
3. Click Save

**Expected:**
- Error message: "License not found or not owned by this account."
- Save button re-enabled so user can try again

---

### TC-5.4 — Activate with a cancelled license key
**Steps:**
1. Use a key that has been previously cancelled
2. Enter domain and paste cancelled key
3. Click Save

**Expected:**
- Error message: "This license is cancelled and cannot be activated."
- Save button re-enabled

---

### TC-5.5 — Activate with blank license key field
**Steps:**
1. Enter a domain
2. Leave license key field blank
3. Click Save

**Expected:**
- Error message: "Please enter your license key."
- No API call made

---

### TC-5.6 — Activate with blank domain field
**Steps:**
1. Leave domain blank
2. Enter a license key
3. Click Save

**Expected:**
- Error message: "Please enter your site domain."

---

## 6. Transfer Domain

### TC-6.1 — Transfer an active key to a new domain
**Steps:**
1. Go to License Keys → **Active tab**
2. Dots menu on a key assigned to `oldsite.com`
3. Click **Transfer to Another Domain**
4. Enter `newsite.com`
5. Click Transfer Key

**Expected:**
- Key now shows domain `newsite.com` in Active tab (updated)
- KV for `domain:newsite.com` = `{ status: "active" }`
- KV for `domain:oldsite.com` = `{ status: "inactive" }`
- Widget turns OFF on `oldsite.com`, turns ON on `newsite.com` after publish

---

### TC-6.2 — Transfer to the same domain (no change)
**Steps:**
1. Transfer key from `mysite.com` to `mysite.com` (same domain)

**Expected:**
- No error, domain stays the same
- KV not changed (or re-written as active — same result)

---

### TC-6.3 — Transfer with empty domain
**Steps:**
1. Open Transfer modal, leave new domain blank

**Expected:**
- Transfer button is **disabled**

---

## 7. Cancel License Key

### TC-7.1 — Cancel an active key
**Steps:**
1. Go to License Keys → **Active tab**
2. Dots menu → **Cancel Key**
3. Confirm the browser dialog

**Expected:**
- Key moves to **Cancelled tab**
- KV for `domain:mysite.com` = `{ status: "cancelled" }`
- Widget **hides immediately** on the domain (no publish needed)
- Stripe subscription set to cancel at period end

---

### TC-7.2 — Cancel a Not Assigned key
**Steps:**
1. Go to License Keys → **Not Assigned tab**
2. Dots menu → **Cancel Key**
3. Confirm

**Expected:**
- Key moves to **Cancelled tab**
- No KV change needed (domain was never assigned)
- Stripe subscription cancelled

---

### TC-7.3 — Dismiss the cancel confirmation dialog
**Steps:**
1. Click Cancel Key
2. Click **Cancel** on the browser confirm dialog

**Expected:**
- Nothing happens — key stays in its current tab
- No API call made

---

### TC-7.4 — Cancelled key cannot be re-activated
**Steps:**
1. Take a cancelled key
2. Try to activate it via Webflow App popup

**Expected:**
- Error: "This license is cancelled and cannot be activated."

---

## 8. Remove Site (My Sites page)

### TC-8.1 — Remove an active site
**Steps:**
1. Go to **My Sites**
2. Dots menu on an active site → **Remove Site**
3. Confirm the dialog

**Expected:**
- Site status changes to **Cancelled** (red pill)
- Corresponding license key moves to **Cancelled tab** in License Keys
- KV for that domain = `{ status: "cancelled" }`
- Widget hides immediately
- Stripe subscription cancelled at period end

---

### TC-8.2 — Remove a Not Assigned site (no domain)
**Steps:**
1. My Sites → dots menu on a site with domain N/A → Remove Site

**Expected:**
- Site moves to Cancelled status
- License key (if linked) moves to Cancelled tab
- No KV change (no domain was ever set)

---

### TC-8.3 — Remove Site not available for already-cancelled sites
**Steps:**
1. Find a site with status **Cancelled**
2. Open dots menu

**Expected:**
- **Remove Site** option does NOT appear in the menu

---

## 9. Assign Domain (My Sites page)

### TC-9.1 — Assign domain to a site that has none
**Steps:**
1. My Sites → find a site with domain N/A and status Not Assigned
2. Dots menu → **Assign Domain**
3. Enter `mysite.com`
4. Click Assign Domain

**Expected:**
- Domain column updates to `mysite.com`
- Status changes to **Active**
- KV written: `domain:mysite.com → active`
- Widget loads after publish

---

### TC-9.2 — Assign Domain option not shown for sites that already have a domain
**Steps:**
1. Find a site with a domain already set

**Expected:**
- Dots menu does **not** show "Assign Domain" option

---

## 10. Widget Validation

### TC-10.1 — Widget on an active domain
**Setup:** KV has `domain:mysite.com → { status: "active" }`

**Steps:**
1. Load `mysite.com` in the browser (with widget script installed)

**Expected:**
- Widget loads and renders the accessibility toolbar

---

### TC-10.2 — Widget on a cancelled domain
**Setup:** KV has `domain:mysite.com → { status: "cancelled" }`

**Expected:**
- Widget does **not** load / is hidden

---

### TC-10.3 — Widget on a domain with no KV entry
**Setup:** Domain not in KV at all

**Expected:**
- Widget does **not** load

---

### TC-10.4 — Widget on a staging domain (.webflow.io)
**Setup:** Site is on `mysite.webflow.io` — no KV entry

**Expected:**
- Widget loads anyway (staging domains are always free / bypass validation)

---

### TC-10.5 — Widget on localhost
**Expected:**
- Widget loads (localhost always bypasses validation)

---

## 11. Dashboard Display

### TC-11.1 — Status pills show correct colours
| Status | Expected colour |
|--------|----------------|
| Active | 🟢 Green |
| Not Assigned | 🟡 Amber |
| Cancelled | 🔴 Red |

---

### TC-11.2 — License Keys tab counts are correct
**Steps:**
1. Have 2 Not Assigned, 3 Active, 1 Cancelled key

**Expected:**
- Not Assigned tab shows 2 rows
- Active tab shows 3 rows
- Cancelled tab shows 1 row

---

### TC-11.3 — Billing Period filter works
**Steps:**
1. License Keys page → click Billing Period dropdown → select **Monthly**

**Expected:**
- Only monthly keys shown in the current tab
- Annual keys hidden

---

### TC-11.4 — Copy license key button
**Steps:**
1. Click the copy icon next to any license key

**Expected:**
- Key copied to clipboard
- Copy icon briefly turns into a checkmark ✓

---

### TC-11.5 — View Details shows all site info
**Steps:**
1. My Sites → dots menu → **View Details**

**Expected:**
- Modal shows: Domain, Status, Billing Period, Created date, Expiration date, License Key, Subscription ID

---

## 12. Edge Cases

### TC-12.1 — Two users purchase the same domain
**Steps:**
1. User A activates `shared.com`
2. User B tries to activate `shared.com` with a different key

**Expected:**
- User B's activation overwrites KV for `shared.com` with their key
- Widget still works (last activation wins)
- Both dashboard accounts show their respective keys

---

### TC-12.2 — Network error during activation (Webflow App)
**Steps:**
1. Disconnect internet
2. Try to activate in the Webflow App popup

**Expected:**
- Error: "Connection error. Please check your internet and try again."
- Save button re-enabled

---

### TC-12.3 — Webhook fires but D1 is down
**Expected:**
- Worker catches the error and returns 500
- Stripe will retry the webhook up to 3 days
- No partial data saved

---

### TC-12.4 — User logs in with wrong email (not the purchase email)
**Steps:**
1. Purchased with `billing@company.com`
2. Tries to log in with `personal@gmail.com`

**Expected:**
- No sites or keys visible (empty dashboard)
- Must log in with the email used at purchase

---

### TC-12.5 — License key used across different accounts (email mismatch)
**Steps:**
1. Key was purchased by `billing@company.com`
2. User tries to activate it via Webflow App popup (logged in as `webflow@company.com`)

**Expected:**
- Activation succeeds (Webflow App uses key-only lookup, no email required)
- KV written, widget activates

---

### TC-12.6 — Activating the same key twice
**Steps:**
1. Activate key for `domain-a.com`
2. Activate the same key again for `domain-a.com`

**Expected:**
- Second activation succeeds silently (idempotent)
- No error, no duplicate entry

---

## Quick Test Checklist Before Going Live

- [ ] TC-1.1 — Buy from Webflow payment link with domain
- [ ] TC-2.1 — Buy from dashboard (Add Site)
- [ ] TC-3.1 — Bulk purchase 2 keys
- [ ] TC-4.1 — Assign Not Assigned key to domain
- [ ] TC-5.1 — Activate via Webflow App popup
- [ ] TC-6.1 — Transfer domain
- [ ] TC-7.1 — Cancel active key
- [ ] TC-8.1 — Remove site
- [ ] TC-10.1 — Widget loads on active domain
- [ ] TC-10.2 — Widget hidden on cancelled domain
- [ ] TC-10.4 — Widget loads on staging domain (free)
