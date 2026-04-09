# Collaborator

A real-time collaboration web app built with Next.js. Create or join a meeting room, chat with participants, share files, record the session, and get an AI-generated summary when it's done.

Live: [collaborator-blue.vercel.app](https://collaborator-blue.vercel.app)

## Features

- **Video meetings** — create or join rooms powered by the 100ms.live SDK, with audio/video controls for multiple participants
- **In-meeting chat** — persistent text chat that stays for the duration of the meeting
- **File sharing** — upload and access files during a meeting, stored via Supabase Storage
- **Recording** — start/stop recording from within the meeting UI
- **Transcription** — recordings are automatically transcribed after the call ends
- **AI summary** — transcripts are summarized using OpenAI, giving you a quick recap of what was discussed

## Tech stack

- **Next.js** (App Router, TypeScript) — frontend and API routes
- **Supabase** — auth, database (PostgreSQL), and file storage
- **100ms.live** — WebRTC video/audio SDK
- **OpenAI API** — post-call transcript summarization
- **Docker** — containerized for consistent local and production environments

## Setup

Install dependencies:

```bash
npm install
```

Copy `.env.local.example` to `.env.local` and fill in your keys:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
HMS_APP_KEY=
HMS_APP_SECRET=
OPENAI_API_KEY=
```

Run the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Or with Docker:

```bash
docker-compose up
```

## Project structure

```
app/              # Next.js App Router pages and API routes
components/       # Shared UI (VideoGrid, ChatBox, FilePanel, etc.)
hooks/            # Client-side logic (useMeeting, useChat, useFiles)
lib/              # SDK wrappers (Supabase, 100ms, OpenAI, storage)
scripts/          # DB migration and seed SQL
public/           # Static assets
```
