# Disappearing Chat App (Serverless)

A real-time chat application with disappearing messages, built with **Next.js** and **Firebase**.

## Features
- **Real-time Messaging** (Firestore)
- **Disappearing Messages** (Clients filter out messages > 2 mins old)
- **File Uploads** (Firebase Storage)
- **Serverless** (Deploy anywhere: Netlify, Vercel, etc.)

## Setup

1. **Create Firebase Project**
   - Go to [Firebase Console](https://console.firebase.google.com).
   - Create a project.
   - Enable **Authentication** (Anonymous or Email).
   - Enable **Firestore** (Start in Test Mode).
   - Enable **Storage** (Start in Test Mode).

2. **Get Keys**
   - Project Settings -> General -> Web App -> Copy Config.

3. **Environment Variables**
   Create a `.env.local` file:
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
   NEXT_PUBLIC_FIREBASE_APP_ID=...
   ```

4. **Run Locally**
   ```bash
   npm install
   npm run dev
   ```

## Deployment (Netlify/Vercel)

1. Push to GitHub.
2. Import project in Netlify/Vercel.
3. **Add the Environment Variables** in the dashboard settings.
4. Deploy!
