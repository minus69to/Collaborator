# Collaborator — Real-Time Collaboration Web App

## 📘 Overview
**Collaborator** is a full-stack web application built with **Next.js** that demonstrates real-time communication and collaboration features using the **[100ms.live](https://www.100ms.live)** SDK.  
The app enables users to join or create video meetings, chat, share files, record sessions, generate transcripts, and summarize meeting discussions automatically.

---

## 🚀 Features

### 🎥 1. Real-Time Video Meetings
- Join or create a virtual meeting room using **100ms.live**.
- Supports multiple participants with audio/video controls.

### 💬 2. In-Meeting Persistent Chat
- Text chat available during meetings.
- Messages persist for the duration of the meeting.

### 📁 3. File Storage Interface
- Upload, access, and share files during meetings.
- Files are stored and managed using **Supabase storage**.

### 🔴 4. Meeting Recording
- Start, stop, and save meeting recordings.
- Recordings are stored for transcription and future access.

### 📝 5. Post-Call Transcription
- Automatically transcribe recorded meetings into text.

### 🤖 6. AI-Generated Meeting Summary
- Use AI (e.g., OpenAI API or AWS Comprehend) to summarize meeting transcripts.

---

## 🧰 Tech Stack

| Layer | Technology |
|-------|-------------|
| **Frontend** | Next.js (React 18, TypeScript) |
| **Backend** | Next.js API Routes |
| **Database** | PostgreSQL via Supabase |
| **Auth & Storage** | Supabase Auth & Storage |
| **Video SDK** | [100ms.live Video SDK](https://www.100ms.live/video-call-sdk) |
| **AI Summary** | OpenAI API or AWS Comprehend |
| **Deployment** | AWS (account will be provided) |

---