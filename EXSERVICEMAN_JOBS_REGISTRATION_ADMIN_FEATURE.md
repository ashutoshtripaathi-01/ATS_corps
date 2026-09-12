# Ex-Serviceman Jobs — Registration Tracking & Pending Payment Feature

## Claude Code Instructions

Modify the **existing Ex-Serviceman Jobs project** to add registration tracking, pending-payment persistence, and Admin Panel visibility.

### IMPORTANT

This is an existing project.

- Do NOT rebuild the application.
- Do NOT replace the existing authentication system.
- Do NOT merge candidate and company registration flows.
- Do NOT create a separate unrelated database.
- Do NOT remove the existing Razorpay integration.
- Do NOT redesign unrelated parts of the application.
- First inspect the existing codebase, PostgreSQL schema, authentication, candidate registration, company registration, document upload system, Razorpay integration, and Admin Panel.
- Then make the minimum architectural changes required.

---

# 1. Existing Business Workflow

There are TWO completely separate registration flows.

They must remain separate:

```text
HOMEPAGE
    |
    +-------------------+
    |                   |
    v                   v
CANDIDATE            COMPANY
REGISTER             REGISTER
    |                   |
    v                   v
Candidate            Company
Account              Account
    |                   |
    v                   v
Candidate            Company
Profile              Profile
    |                   |
    v                   v
Documents            Documents
    |                   |
    v                   v
Razorpay             Razorpay
    |                   |
    v                   v
Payment              Payment
    |                   |
    v                   v
ACTIVE               ACTIVE
```

The requirement is NOT to change these separate flows.

The requirement is to ensure that all information entered before Razorpay is persisted in PostgreSQL, even if payment is not completed.

---

# 2. Candidate Registration Flow

The candidate registration flow is:

### Step 1 — Candidate Account Registration

From the homepage:

**Candidate → Register**

The candidate registers using:

- Email
- Password

This creates the candidate authentication/account record.

After successful account creation, redirect to the candidate profile/information form.

### Step 2 — Candidate Information

The candidate fills:

#### Personal Information
- Full Name
- Phone Number

#### Military/Service Information
- Rank
- Unit / Regiment

#### Documents
- Ex-Serviceman ID Card
- Police Verification
- Discharge Book

#### Employment Preferences
- Preferred Placement Location
- Preferred Job Role

Preserve any additional candidate fields already present in the project.

### Step 3 — Payment

After all candidate information and documents are successfully submitted:

```text
Candidate Profile Submitted
        ↓
Save to PostgreSQL
        ↓
Create Registration Record
        ↓
Create Razorpay Order
        ↓
Redirect to Razorpay
```

---

# 3. Company Registration Flow

Company registration is completely separate.

From the homepage:

**Company → Register**

The company registers using:

- Email
- Password

After account creation, redirect to the company registration form.

### Company Information

At minimum:

- Company Name
- GST Number
- PAN Number
- CIN Number

### Company Documents

Upload the company registration/business documents already required by the existing application.

Preserve all additional existing company fields.

### Payment

After company information and documents are successfully submitted:

```text
Company Registration Submitted
        ↓
Save Company Information
        ↓
Save Uploaded Documents
        ↓
Create Company Registration Record
        ↓
Create Razorpay Order
        ↓
Redirect to Razorpay
```

---

# 4. Core Architectural Change

Currently, registration appears to be treated as complete only after Razorpay payment.

Change this behavior.

## Registration must be stored BEFORE payment.

When the user submits the profile/registration form:

- Save the account
- Save the profile information
- Save the uploaded document references
- Save employment/company details
- Create a registration record
- Create payment/order information
- Then redirect to Razorpay

Payment completion should determine whether the registration becomes **active**, not whether the registration record exists.

---

# 5. Registration Status vs Payment Status

Do NOT use a single field for both concepts.

A registration can exist even if payment is pending.

Use separate logical states.

### Registration status

At minimum:

```text
pending_payment
active
```

Additional states may be added only if they fit the existing architecture:

```text
payment_failed
cancelled
expired
suspended
```

### Payment status

At minimum:

```text
pending
paid
failed
```

If the existing Razorpay implementation requires additional states, support them appropriately.

Example:

```text
Candidate:
John Doe

registration_status = pending_payment
payment_status = pending
```

After successful payment:

```text
registration_status = active
payment_status = paid
```

---

# 6. Candidate Who Does Not Complete Payment

This is a critical requirement.

Example:

```text
Candidate:
John Doe

Email:
john@example.com

Phone:
98XXXXXXXX

Rank:
JCO

Unit/Regiment:
XYZ Regiment

Preferred Location:
Assam

Preferred Job:
Security Supervisor

Documents:
- Ex-Serviceman ID Card
- Police Verification
- Discharge Book

Payment:
PENDING

Registration:
PENDING_PAYMENT
```

This candidate MUST remain stored in PostgreSQL.

The Admin Panel must be able to see this candidate.

The candidate's contact information, submitted information, and uploaded documents must remain associated with the registration.

---

# 7. Company Who Does Not Complete Payment

Same principle for companies.

Example:

```text
Company:
ABC Security Pvt Ltd

Email:
company@example.com

GST:
...

PAN:
...

CIN:
...

Documents:
- Existing company registration documents

Payment:
PENDING

Registration:
PENDING_PAYMENT
```

The company must remain stored and visible in the Admin Panel.

---

# 8. Do Not Create Duplicate Records on Payment Retry

This is extremely important.

If a candidate registers, reaches Razorpay, does not pay, and later retries:

```text
Existing Registration
        ↓
Login
        ↓
Retry Payment
        ↓
Razorpay
        ↓
Payment Successful
        ↓
Existing Registration Updated
        ↓
payment_status = paid
registration_status = active
```

DO NOT create another candidate.

The same applies to companies.

If the existing Razorpay architecture supports multiple payment attempts/orders, maintain the relationship:

```text
Registration
    |
    +-- Payment Attempt 1
    +-- Payment Attempt 2
    +-- Payment Attempt 3
```

Do not unnecessarily overwrite payment history.

---

# 9. Razorpay Integration

Keep the existing Razorpay integration.

Payment success must be verified server-side.

Never trust only a frontend response.

Expected behavior:

```text
Razorpay
    ↓
Payment response / webhook
    ↓
Backend verification
    ↓
Payment verified?
    |
    +-- YES
    |     |
    |     +-- payment_status = paid
    |     +-- registration_status = active
    |
    +-- NO
          |
          +-- payment_status = pending/failed
          +-- Registration remains stored
```

Webhook processing must be idempotent.

Duplicate webhooks must not create duplicate:

- candidates
- companies
- registrations
- activations
- payment records

Follow the existing Razorpay implementation and conventions.

---

# 10. Resume Incomplete Registration

If feasible within the current architecture, a user whose payment is pending should be able to log back in and continue.

Example:

```text
Candidate Login
      ↓
Existing Registration Found
      ↓
Payment Pending
      ↓
Show Continue / Complete Registration
      ↓
Continue to Razorpay
```

Do NOT force the user to create a second account.

If the current application already has a resume-registration mechanism, reuse it.

---

# 11. Uploaded Documents

Documents uploaded before payment must remain stored even when payment is pending or failed.

For candidates:

- Ex-Serviceman ID Card
- Police Verification
- Discharge Book
- Any other existing candidate documents

For companies:

- Existing company registration documents

Do not delete documents merely because payment was not completed.

Continue using the existing secure file storage mechanism.

Identity and company documents must not become publicly accessible.

Only authorized administrators and the appropriate user should be able to access them according to the existing permissions.

---

# 12. Database Architecture

First inspect the existing PostgreSQL schema.

Do not assume table names.

Prefer extending existing models/tables rather than creating unnecessary duplicates.

Conceptually, the architecture should be:

```text
CANDIDATE

Account
  |
  +-- email
  +-- password/auth reference
  |
  +-- Candidate Profile
          |
          +-- name
          +-- phone
          +-- rank
          +-- unit/regiment
          +-- documents
          +-- preferred location
          +-- preferred job role
          |
          +-- Registration
                  |
                  +-- registration_status
                  +-- payment_status
```

And separately:

```text
COMPANY

Account
  |
  +-- email
  +-- password/auth reference
  |
  +-- Company Profile
          |
          +-- company name
          +-- GST
          +-- PAN
          +-- CIN
          +-- documents
          |
          +-- Registration
                  |
                  +-- registration_status
                  +-- payment_status
```

Do NOT merge candidate and company profiles.

A unified Admin registration view is fine, but the underlying business models should remain separate if they are already separate.

---

# 13. Suggested Registration Data

Use the existing schema wherever possible.

A registration concept should contain information such as:

```text
id
registration_id
candidate_id OR company_id
registration_status
payment_status
created_at
updated_at
submitted_at
activated_at
```

Do not blindly create these exact fields if equivalent fields already exist.

Use the project's existing naming conventions.

---

# 14. Payment Data

Reuse the existing payment/order model if available.

If a new payment table is required, logically it may contain:

```text
id
registration_id
razorpay_order_id
razorpay_payment_id
amount
currency
status
created_at
updated_at
paid_at
```

Do not store:

- card numbers
- CVV
- UPI credentials
- passwords
- other sensitive payment credentials

Only store payment identifiers and metadata required by the existing Razorpay integration.

---

# 15. Admin Panel — Registration Management

Add a new section to the existing Admin Panel:

## Registrations

The Admin Panel must show all registrations, regardless of payment completion.

Provide filters/tabs such as:

```text
All
Candidates
Companies
Pending Payment
Paid
Payment Failed
Active
```

Use the existing Admin Panel UI/design system.

---

# 16. Candidate Admin List

For candidates, show:

```text
Registration ID
Name
Email
Phone
Rank
Unit / Regiment
Preferred Location
Preferred Job Role
Registration Date
Payment Status
Registration Status
Actions
```

Do not display all uploaded documents directly in the table.

Provide a **View Details** action.

---

# 17. Company Admin List

For companies, show:

```text
Registration ID
Company Name
Email
Phone
GST
PAN
CIN
Registration Date
Payment Status
Registration Status
Actions
```

Documents should be accessible through the detail view.

---

# 18. Registration Detail Page

Admin should be able to click **View Details**.

### Candidate Details

Show:

- Name
- Email
- Phone
- Rank
- Unit / Regiment
- Preferred Location
- Preferred Job Role
- All other existing candidate fields

### Candidate Documents

Show securely:

- Ex-Serviceman ID Card
- Police Verification
- Discharge Book
- Other existing documents

### Registration Information

Show:

```text
Registration ID
Registration Date
Registration Status
Last Updated
```

### Payment Information

Show:

```text
Payment Status
Amount
Razorpay Order ID
Razorpay Payment ID / Transaction ID
Payment Date
```

Only show safe payment information supported by the existing integration.

---

# 19. Company Detail Page

Admin should be able to see:

### Company Information

- Company Name
- Email
- Phone
- GST
- PAN
- CIN
- All other existing company fields

### Company Documents

Securely view/download existing uploaded company documents.

### Registration

- Registration ID
- Registration Date
- Registration Status
- Last Updated

### Payment

- Payment Status
- Amount
- Razorpay Order ID
- Payment ID
- Payment Date

---

# 20. Pending Payment View

The Admin Panel must make pending registrations easy to identify.

Example:

```text
John Doe
Candidate

Registration:
EXJ-CAN-2026-00125

Payment:
PENDING

Registration:
PENDING_PAYMENT

[ View Details ]
```

The administrator must be able to see:

- Name
- Contact information
- Registration information
- Submitted profile information
- Uploaded documents
- Payment status

Do not add internal notes about why the admin wants to contact the user. The requirement is only to provide the data and status in the Admin Panel.

---

# 21. Search

Admin should be able to search by:

### Candidate

- Name
- Email
- Phone
- Registration ID
- Rank
- Unit / Regiment

### Company

- Company Name
- Email
- Phone
- GST
- PAN
- CIN
- Registration ID

Use server-side search where appropriate.

---

# 22. Filters

Provide:

```text
Registration Type:
All / Candidate / Company

Payment:
All / Pending / Paid / Failed

Registration:
All / Pending Payment / Active

Date:
From / To
```

Use pagination.

Do not load the entire database into the browser.

---

# 23. Admin Dashboard Statistics

If the existing Admin Dashboard supports statistics, add database-driven metrics such as:

```text
Total Candidate Registrations
Total Company Registrations
Pending Candidate Payments
Pending Company Payments
Paid Registrations
Active Candidates
Active Companies
Today's Registrations
```

Never hardcode these values.

---

# 24. Account Status

The account is created during the initial email/password registration step.

Therefore:

### Candidate

```text
Register Email + Password
        ↓
Account Created
        ↓
Candidate Profile
        ↓
Documents
        ↓
Payment
```

### Company

```text
Register Email + Password
        ↓
Account Created
        ↓
Company Profile
        ↓
Documents
        ↓
Payment
```

If payment is pending, do not accidentally give the user the privileges/features of a fully paid/active account.

But do preserve the account and registration information.

---

# 25. Existing Users

Existing paid candidates and companies must continue to work.

After the migration:

- Existing candidates can login
- Existing companies can login
- Existing admins can login
- Existing active/paid users remain active
- Existing payment records remain intact
- Existing dashboards continue functioning
- Existing profile information remains intact

Do not break existing functionality.

---

# 26. Database Migration

Because this project uses PostgreSQL:

**DO NOT DROP OR RESET THE DATABASE.**

Create a proper migration.

Before changing the schema, inspect:

- users/accounts
- candidate tables
- company tables
- registration tables
- payment tables
- Razorpay orders/transactions
- document/file references
- admin relationships

Preserve all existing production data.

Do not use destructive commands such as:

```text
DROP DATABASE
DROP TABLE
TRUNCATE
```

unless explicitly required and approved.

---

# 27. Existing Data Migration

If existing paid candidates/companies already exist, ensure they remain valid.

Only based on actual existing data/payment information, establish appropriate values such as:

```text
payment_status = paid
registration_status = active
```

Do not blindly mark records as paid.

---

# 28. Homepage Registration Buttons

Keep the two separate buttons on the homepage:

```text
For Candidates → Candidate Registration
For Companies → Company Registration
```

Do not merge them.

Candidate flow:

```text
Candidate Register
      ↓
Email + Password
      ↓
Candidate Details
      ↓
Documents
      ↓
Job Preferences
      ↓
Razorpay
```

Company flow:

```text
Company Register
      ↓
Email + Password
      ↓
Company Details
      ↓
Documents
      ↓
Razorpay
```

Only the persistence and payment-state behavior changes.

---

# 29. Admin Security

Only authorized Admin users may access:

- candidate details
- company details
- phone numbers
- email addresses
- uploaded documents
- payment details
- registration statuses

Follow the existing authentication/RBAC architecture.

Do not expose admin registration APIs publicly.

---

# 30. API

Follow the existing backend/API conventions.

Potential capabilities include:

```text
GET    admin registrations
GET    registration details
GET    registration documents
GET    registration payments
GET    candidate registrations
GET    company registrations
GET    pending payments
```

Do not blindly use these exact endpoint names. Inspect the existing backend and follow its conventions.

All Admin APIs must enforce authentication and authorization.

Implement:

- validation
- pagination
- search
- filtering
- error handling
- proper authorization

---

# 31. Frontend

Use the existing Admin Panel components/design system.

Reuse:

- sidebar
- navbar
- typography
- cards
- tables
- buttons
- modals/dialogs
- icons
- responsive layout

Use clear status badges:

```text
PENDING PAYMENT
PAID
FAILED
ACTIVE
```

Do not redesign unrelated pages.

---

# 32. Testing

Test all of these scenarios.

## Test 1 — Candidate Pays

```text
Candidate registers
↓
Candidate account created
↓
Candidate profile submitted
↓
Documents uploaded
↓
Data stored in PostgreSQL
↓
Razorpay
↓
Payment successful
↓
Backend verifies payment
↓
payment_status = paid
registration_status = active
↓
Admin sees ACTIVE
```

## Test 2 — Candidate Abandons Razorpay

```text
Candidate registers
↓
Profile submitted
↓
Documents uploaded
↓
Data stored
↓
Razorpay opened
↓
Candidate closes payment
↓
payment_status = pending
registration_status = pending_payment
↓
Admin sees candidate
↓
Admin sees contact information
↓
Admin sees uploaded documents
```

## Test 3 — Candidate Payment Fails

```text
Candidate registration exists
↓
Razorpay payment fails
↓
Candidate remains stored
↓
payment_status = failed
↓
Admin can see candidate
```

## Test 4 — Candidate Retries

```text
Existing candidate
↓
Login
↓
Pending Payment
↓
Retry payment
↓
Razorpay succeeds
↓
Existing registration updated
↓
No duplicate candidate
↓
payment_status = paid
registration_status = active
```

## Test 5 — Company Pays

Verify the complete company workflow.

## Test 6 — Company Abandons Payment

Verify:

- Company account remains
- Company profile remains
- GST/PAN/CIN remain
- Documents remain
- Payment = pending
- Registration = pending_payment
- Admin can see the company

## Test 7 — Existing Users

Verify that existing users can still:

- Login
- Access dashboards
- View profiles
- Use existing features

---

# 33. Implementation Process

Before changing code, inspect the existing application and report:

```text
1. Existing Candidate Registration Flow
2. Existing Company Registration Flow
3. Existing Authentication
4. Existing Candidate Database Model
5. Existing Company Database Model
6. Existing Registration Model
7. Existing Payment Model
8. Existing Razorpay Integration
9. Existing Document Storage
10. Existing Admin Panel Architecture
11. Required Database Changes
12. Required Backend Changes
13. Required Frontend Changes
```

Then implement the feature.

Do not make unrelated architectural changes.

Do not redesign the homepage.

Do not change the candidate/company registration UI unless required.

---

# 34. Final Required Architecture

The final behavior should be:

```text
                    HOMEPAGE
                       |
             +---------+---------+
             |                   |
        CANDIDATE             COMPANY
        REGISTER              REGISTER
             |                   |
        Email/Password      Email/Password
             |                   |
       Candidate Form       Company Form
             |                   |
        Documents            Documents
             |                   |
             v                   v
        SAVE DATABASE       SAVE DATABASE
             |                   |
             v                   v
         RAZORPAY            RAZORPAY
             |                   |
       +-----+-----+       +-----+-----+
       |           |       |           |
      PAID      PENDING   PAID      PENDING
       |           |       |           |
       v           v       v           v
    ACTIVE      PENDING  ACTIVE      PENDING
```

## Core Rule

**Payment determines activation, not whether the registration record exists.**

Therefore:

### Candidate who pays

```text
Account: EXISTS
Profile: EXISTS
Documents: EXISTS
Payment: PAID
Registration: ACTIVE
```

### Candidate who does not pay

```text
Account: EXISTS
Profile: EXISTS
Documents: EXISTS
Payment: PENDING
Registration: PENDING_PAYMENT
```

### Company who pays

```text
Account: EXISTS
Company Profile: EXISTS
Documents: EXISTS
Payment: PAID
Registration: ACTIVE
```

### Company who does not pay

```text
Account: EXISTS
Company Profile: EXISTS
Documents: EXISTS
Payment: PENDING
Registration: PENDING_PAYMENT
```

---

# 35. Final Report

After implementation, report:

1. Files modified
2. Files created
3. Database migration created
4. Database schema changes
5. Candidate flow changes
6. Company flow changes
7. Razorpay changes
8. Admin Panel changes
9. API changes
10. Document-storage changes
11. Environment variables, if any
12. Migration commands
13. Tests performed
14. Any existing architecture issues discovered
15. Any assumptions made

Do not claim completion unless the candidate and company flows have been tested end-to-end.
