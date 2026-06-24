# GroceryManager — Store Privacy Disclosure Worksheet

**Version:** June 2026  
**Contact:** subh.mukherjee1996@gmail.com  
**Privacy policy URL:** https://grocerymanager.app/privacy

This document is the source of truth for the App Privacy labels (Apple App Store Connect) and the
Data Safety section (Google Play Console). Fill in the store forms using the exact values below.
Update this file and the `/privacy` page together whenever data practices change.

---

## 1. Apple App Store — App Privacy Labels

Apple requires disclosure for each data type the app collects, whether it is linked to the user's
identity, and whether it is used for tracking across apps/sites. Work through each category in
App Store Connect → **App** → **App Privacy** → **Add/Edit Data Types**.

> **Tracking definition (Apple):** data linked with third-party data for advertising or shared with
> data brokers. GroceryManager does **none** of this — the "Used for Tracking" answer is **NO** for
> every category.

### 1.1 Contact Info

| Field | Answer |
|---|---|
| Email address | **YES — collected** |
| Linked to identity | **YES** |
| Used for tracking | **NO** |
| Purpose | Account creation and authentication; optional Gmail OAuth connection |

**Notes:** Email is nullable at sign-up (credentials users supply only a username; email is
populated when the user later connects Gmail via OAuth). Once set it is stored in the `users.email`
column (unique, not shared externally for advertising). Phone number is optional and collected only
when the user explicitly opts in to SMS digests (`users.phone`).

| Field | Answer |
|---|---|
| Phone number | **YES — collected (optional, user-initiated)** |
| Linked to identity | **YES** |
| Used for tracking | **NO** |
| Purpose | SMS digest notifications (opt-in only) |

### 1.2 Identifiers

| Field | Answer |
|---|---|
| User ID | **YES — collected** |
| Linked to identity | **YES** |
| Used for tracking | **NO** |
| Purpose | Internal database primary key (UUID); used for row-level security and data association |

**Notes:** This is an internal random UUID (`users.id`), never exposed to third parties.

### 1.3 Usage Data

| Field | Answer |
|---|---|
| Product interaction | **YES — collected** |
| Linked to identity | **YES** |
| Used for tracking | **NO** |
| Purpose | Pantry management (stock ledger events: purchases, consumption, corrections), cooking history (meal logs), preference signals from recipe interactions (swipes, ratings, skips), and reorder predictions |

**Notes:** Interaction data is stored in `stock_ledger`, `meal_logs`, `preference_signals`, and
`consumption_events`. These records drive in-app personalization (recipe suggestions, reorder
alerts) and are never used for cross-app advertising.

### 1.4 Purchases

| Field | Answer |
|---|---|
| Purchase history (in-app transactions) | **NO** |

**Notes:** GroceryManager does not process in-app purchases or subscriptions. The app stores
records of *grocery receipts* parsed from Gmail — but these are classified under "Other Data"
(section 1.10) rather than Apple's "Purchase History" category, which covers in-app transactions.

### 1.5 Financial Info

| Field | Answer |
|---|---|
| Financial info | **NO** |

**Notes:** The app extracts and stores line-item prices from grocery receipts
(`purchase_line_items.unit_price_cents`, `line_total_cents`, `purchases.total_cents`) and a weekly
budget preference (`user_models.weekly_budget_cents`). These are grocery spend estimates used to
power shopping list suggestions. The app does NOT collect bank account details, credit/debit card
numbers, or payment credentials of any kind.

> **Owner decision required:** Apple may classify grocery receipt totals/prices as "Financial Info."
> Review Apple's current guidance. If Apple categorises it as such, answer **YES, linked to
> identity, NOT for tracking, purpose: pantry/budget management**.

### 1.6 Location

| Field | Answer |
|---|---|
| Location | **NO** |

**Notes:** GroceryManager does not request or store device location (GPS or coarse). The
`pantry_scans.location` field is a user-selected label ("fridge", "pantry", "freezer") — not a
geographic coordinate.

### 1.7 Sensitive Info

| Field | Answer |
|---|---|
| Sensitive info | **NO** |

**Notes:** No racial/ethnic origin, political opinions, religious beliefs, biometric data, or
precise geolocation are collected.

### 1.8 Contacts

| Field | Answer |
|---|---|
| Contacts | **NO** |

**Notes:** The app does not access the device address book.

### 1.9 Photos and Videos

| Field | Answer |
|---|---|
| Photos or videos | **YES — collected** |
| Linked to identity | **YES** |
| Used for tracking | **NO** |
| Purpose | Fridge/pantry scans: the user photographs their fridge or pantry; the image is sent to the Gemini Vision API for item detection and the blob URL is stored linked to the user's account (`pantry_scans.image_blob_urls`) |

**Notes:** Images are used solely to identify food items and update pantry stock. They are not
analyzed for biometric or advertising purposes and are deleted on account deletion.

### 1.10 Health and Fitness

| Field | Answer |
|---|---|
| Health and fitness | **NO** |

**Notes:** The app logs macros (kcal, protein, carbs, fat) per cooked meal in `meal_logs` as a
nutritional aide for the user. Apple's "Health and Fitness" category typically covers data synced
with HealthKit or used for medical purposes. GroceryManager does not integrate with HealthKit and
the macro data is a cooking log, not a medical record.

> **Owner decision required:** If Apple's reviewer considers meal macro logs as health data,
> answer **YES, linked to identity, NOT for tracking, purpose: nutritional cooking log**.

### 1.11 Other Data

| Field | Answer |
|---|---|
| Other data types | **YES — collected** |
| Linked to identity | **YES** |
| Used for tracking | **NO** |
| Purpose | Gmail grocery receipt content; dietary preferences and taste signals |

**Details:**

**Gmail receipt data**  
When the user connects Gmail, the app reads purchase-confirmation emails from Amazon, Whole Foods,
and Instacart. The following receipt fields are stored:

- Gmail message ID (`purchases.gmail_message_id`) — used for idempotency only
- Retailer, order ID, purchase date, order total
- Individual line items: product name raw text, quantity, unit, price per unit, line total

The raw email body is NOT retained as a persistent record. The `purchases.raw_blob_url` field is a
temporary S3 pointer used during parsing — it is not a long-term copy of the email body. Only the
structured extraction result is kept.

**Dietary and food preferences**  
The app collects dietary restrictions (allergens, diets), cuisine preferences, cooking skill level,
household size, and kitchen equipment (`user_models` table) to personalise recipe recommendations.
These signals also accumulate as an append-only `preference_signals` ledger.

### 1.12 Diagnostics

| Field | Answer |
|---|---|
| Diagnostics | **NO** |

**Notes:** No crash logs or performance metrics are collected and sent to third-party analytics
platforms. Standard server logs (IP, browser string, timestamps) are retained for up to 30 days —
these are infrastructure logs, not app diagnostics.

---

## 2. Google Play — Data Safety Section

In Play Console → **Policy** → **App content** → **Data safety**, fill in each section below.

Google distinguishes between **data collected** (sent off the device to your servers) and **data
shared** (transferred to third parties). It also asks whether data is **required** or **optional**
and whether **users can request deletion**.

> **User data deletion:** YES. Users can delete all data from the `/profile` page (or by emailing
> the developer). Deletion is immediate and irreversible.

### 2.1 Data collected and shared

#### Personal info

| Data type | Collected | Shared | Required/Optional | Purpose(s) | User can delete? |
|---|---|---|---|---|---|
| Name | YES | NO | Optional | Display name shown in the UI | YES |
| Email address | YES | NO | Optional at signup; required to connect Gmail | Account authentication; Gmail OAuth | YES |
| Phone number | YES | NO | Optional | SMS digest notifications | YES |
| User IDs | YES | NO | Required | Internal row-level security; account identity | YES (deletes account) |

#### Financial info

| Data type | Collected | Shared | Required/Optional | Purpose(s) | User can delete? |
|---|---|---|---|---|---|
| Purchase history (grocery receipt totals, line-item prices) | YES | NO | Optional (Gmail-connected users only) | Pantry stock projection; shopping list generation; budget management | YES |

#### App activity

| Data type | Collected | Shared | Required/Optional | Purpose(s) | User can delete? |
|---|---|---|---|---|---|
| App interactions (pantry events, meal logs, recipe swipes) | YES | NO | Required for core features | Personalised recipe suggestions; reorder predictions; push notifications | YES |
| Other user-generated content (free-text meal descriptions, dietary preferences) | YES | NO | Optional | Nutritional log; preference personalisation | YES |

#### Photos and videos

| Data type | Collected | Shared | Required/Optional | Purpose(s) | User can delete? |
|---|---|---|---|---|---|
| Photos (fridge/pantry scans) | YES | YES — sent to Gemini API for item detection | Optional | Pantry stock identification via vision AI | YES |

#### Emails

| Data type | Collected | Shared | Required/Optional | Purpose(s) | User can delete? |
|---|---|---|---|---|---|
| Emails (grocery receipt emails from Gmail) | YES — extracted fields only, not raw body | YES — receipt text sent to Gemini API for parsing | Optional (requires Gmail OAuth) | Populating pantry from purchase history | YES |

#### Other

| Data type | Collected | Shared | Required/Optional | Purpose(s) | User can delete? |
|---|---|---|---|---|---|
| Push notification tokens (web push endpoint + keys) | YES | NO | Optional (requires user permission) | Deliver pantry digest and reorder alert notifications | YES |

### 2.2 Security practices

| Practice | Answer |
|---|---|
| Data encrypted in transit | YES (HTTPS/TLS for all traffic) |
| Data encrypted at rest | YES (Supabase/Postgres with encryption at rest; OAuth tokens are envelope-encrypted before storage) |
| Users can request data deletion | YES |
| Committed to Play Families Policy | NO (app is not directed at children) |
| Independent security review | — (to be completed before launch) |

### 2.3 Third-party data sharing detail

Google asks you to explicitly name third parties. For each "Shared: YES" row above:

| Third party | Data shared | Purpose | Limited use? |
|---|---|---|---|
| Google Gemini API | Receipt text extracted from Gmail emails; fridge/pantry photo content | AI-assisted item name extraction and ingredient normalisation | YES — used solely for inference/parsing; subject to Google's API terms |

**Open Food Facts:** Only UPC barcodes are sent — no personal identifiers. This is a public
database lookup and is not considered personal data sharing.

**Instacart:** Shopping list links open Instacart's website in the user's browser. No account
credentials or personal data are sent by GroceryManager to Instacart.

**Supabase:** GroceryManager's database host. All user data resides in Supabase-managed Postgres.
Supabase is a data processor, not a third-party data recipient for disclosure purposes.

---

## 3. Gmail API — Limited Use Policy Disclosure

GroceryManager uses the Gmail API with the scope `https://www.googleapis.com/auth/gmail.readonly`.
By Google policy, apps using restricted Gmail scopes must comply with the
[Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy)
and its Limited Use requirements. The following statements are true and must also appear in
the `/privacy` page (already covered as of June 2026):

1. **Use is limited:** Gmail data (email content and metadata) is used solely to identify grocery
   purchase receipts and extract item/price data to populate the user's pantry. It is used for no
   other purpose.

2. **No transfer to third parties (except for parsing):** Gmail data is not transferred, sold, or
   shared with any third party, except that receipt text is sent to the Google Gemini API solely to
   parse grocery items. This transfer is covered by Google's own API terms; no personal identifiers
   beyond the receipt content itself are included.

3. **No use for advertising:** Gmail data is never used for serving advertisements.

4. **No use for training AI models on user data:** Receipt content sent to Gemini is used for
   inference only, not to train or improve any model on user-identifiable data.

5. **Raw bodies are not retained:** The app does not store raw email bodies. Only the structured
   extraction result (item names, quantities, prices, retailer, order date) is persisted.

6. **Human access to Gmail data is restricted:** No GroceryManager employee reads user Gmail
   content. Automated pipelines only.

> **Action required — OAuth verification:** If GroceryManager exceeds 100 users, Google requires
> submission of the OAuth verification form to have the restricted `gmail.readonly` scope verified.
> Submit at
> [https://support.google.com/cloud/contact/oauth_app_verification](https://support.google.com/cloud/contact/oauth_app_verification)
> and include the Limited Use Policy text above. The `/privacy` page already contains the required
> privacy policy disclosures.

---

## 4. Owner Action Checklist

### Apple App Store Connect

- [ ] Navigate to **App Store Connect** → your app → **App Privacy**
- [ ] Click **Get Started** (or **Edit**) on the App Privacy page
- [ ] Under **Data Types**, add and configure each category using the values in Section 1:
  - [ ] Contact Info → Email address: YES, linked to identity, NOT for tracking
  - [ ] Contact Info → Phone number: YES (optional), linked to identity, NOT for tracking
  - [ ] Identifiers → User ID: YES, linked to identity, NOT for tracking
  - [ ] Usage Data → Product interaction: YES, linked to identity, NOT for tracking
  - [ ] Photos & Videos → Photos: YES, linked to identity, NOT for tracking
  - [ ] Other Data → Other data types: YES (Gmail receipt fields + food preferences), linked to identity, NOT for tracking
  - [ ] Financial Info → see Section 1.5 owner note; answer based on current Apple guidance
  - [ ] Health & Fitness → see Section 1.10 owner note; answer based on current Apple guidance
  - [ ] All remaining categories (Location, Sensitive Info, Contacts, Diagnostics, Purchases) → **NO**
- [ ] Confirm that **"Does this app use data for tracking?"** = **NO**
- [ ] Save and submit — privacy labels must be submitted alongside or before the first build upload
- [ ] Update these labels any time a new data type is introduced

### Google Play Console

- [ ] Navigate to **Play Console** → your app → **Policy** → **App content** → **Data safety**
- [ ] Click **Start** (or **Manage**) in the Data safety section
- [ ] Answer "Does your app collect or share any of the required user data types?" → **YES**
- [ ] Work through each data type using the values in Section 2.1:
  - [ ] Personal info (name, email, phone, user IDs) — collected, not shared
  - [ ] Financial info (grocery receipt prices) — collected, not shared
  - [ ] App activity (pantry events, meal logs, swipes) — collected, not shared
  - [ ] Photos (fridge scans) — collected AND shared with Gemini API
  - [ ] Emails (Gmail receipts) — collected (extracted fields only) AND shared with Gemini API
  - [ ] Other (push notification tokens) — collected, not shared
- [ ] For each "shared" entry, name **Google Gemini API** as the third party with purpose "App functionality"
- [ ] Under **Security practices**, check: encrypted in transit, encrypted at rest, users can request deletion
- [ ] Review the auto-generated **Data safety summary** and approve it
- [ ] Submit — must be complete before the app can be published
- [ ] Update and re-submit any time data practices change

### Gmail API OAuth Verification (required when > 100 users)

- [ ] Go to **Google Cloud Console** → APIs & Services → **OAuth consent screen**
- [ ] Click **Prepare for verification** / submit the OAuth verification request
- [ ] In the verification form, paste the Limited Use Policy text from Section 3
- [ ] Provide the URL to the `/privacy` page as the privacy policy link
- [ ] Provide a demo video showing exactly how `gmail.readonly` is used (receipt sync flow only)
- [ ] Expect a review period of several weeks; do not exceed 100 users until verified

---

*Last updated: June 2026. Derived from `packages/db/src/schema.ts`, `packages/core/src/ingestion/`, and `apps/web/app/privacy/page.tsx`. Update this file, the `/privacy` page, and both store listings together whenever data practices change.*
