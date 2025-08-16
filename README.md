# 📱 Digital Point Card (PWA × Firebase)

A work-in-progress project to replace paper point cards with a **digital
PWA app**.\
Customers can install the app to their home screen, show a unique QR
code, and collect points when scanned by staff.

------------------------------------------------------------------------

## 🚀 Features

-   Unique QR code per customer (via Firebase Anonymous Auth)\
-   Staff scan → add points securely via Cloud Functions\
-   Real-time balance updates with Firestore listeners\
-   Fraud prevention: staff-only functions, rate limits, App Check\
-   PWA support: installable on iOS/Android, offline QR display

------------------------------------------------------------------------

## 🛠 Tech Stack

**Frontend**\
- Next.js (App Router) + TypeScript\
- Tailwind CSS (+ shadcn/ui optional)\
- PWA: `next-pwa` + manifest.json\
- QR: `qrcode`, `@zxing/browser`

**Backend**\
- Firebase Auth (Anonymous + Email/Password for staff)\
- Firestore (users, transactions, staff)\
- Cloud Functions (Node.js 20, TypeScript)\
- Hosting: Vercel + Firebase

------------------------------------------------------------------------

## 🔒 Security

-   Customers only read their own data\
-   Transactions hidden from customers\
-   Staff-only Cloud Functions with custom claims\
-   App Check (reCAPTCHA v3) enabled

------------------------------------------------------------------------

## 📌 Roadmap (MVP)

-   [ ] Firebase project setup (auth, rules, functions)\
-   [ ] `/me` page → QR display + balance\
-   [ ] `/scan` page → staff QR scanner → add point\
-   [ ] PWA setup + offline QR support\
-   [ ] Device testing (iOS/Android)

------------------------------------------------------------------------

## 📍 Status

🔨 In development (MVP phase)
