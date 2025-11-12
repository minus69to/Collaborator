collaborator/                            # repo root
├─ .env.local                            # local env vars (never commit)
├─ .gitignore
├─ package.json
├─ next.config.js
├─ README.md
├─ tsconfig.json
├─ public/
│  └─ images/                            # logos, default avatars
│
├─ app/                                  # Next.js App Router (server + client components)
│  ├─ layout.tsx                         # root layout (providers, fonts, metadata)
│  ├─ globals.css                        # global styles entrypoint
│  ├─ page.tsx                           # landing / dashboard (create / join meeting)
│  ├─ (auth)/                            # route groups for auth flows
│  │  ├─ login/
│  │  │  └─ page.tsx                     # login page (email/password or magic link)
│  │  └─ signup/
│  │     └─ page.tsx                     # signup page
│  ├─ (account)/
│  │  └─ profile/
│  │     └─ page.tsx                     # user profile / settings
│  ├─ meeting/
│  │  ├─ [roomId]/
│  │  │  └─ page.tsx                     # meeting page (main UI)
│  │  └─ preview/
│  │     └─ page.tsx                     # create meeting preview / demo
│  ├─ api/                               # route handlers (server actions)
│  │  ├─ ping-supabase/route.ts          # test route
│  │  ├─ health/route.ts                 # healthcheck
│  │  ├─ 100ms-token/route.ts            # generate ephemeral 100ms tokens (requires auth)
│  │  ├─ hms-webhook/route.ts            # 100ms webhook receiver (recording.ready etc)
│  │  ├─ meetings/
│  │  │   ├─ create/route.ts             # create meeting row + 100ms room if needed
│  │  │   ├─ get/route.ts                # get meeting metadata
│  │  │   ├─ list/route.ts               # list meetings for user
│  │  │   └─ participants/route.ts       # add/remove participant records
│  │  ├─ messages/
│  │  │   ├─ route.ts                    # GET + POST messages for meeting
│  │  ├─ files/
│  │  │   ├─ presign-upload/route.ts     # server presigned URL for upload (if using S3)
│  │  │   └─ list/route.ts               # list files in meeting (metadata)
│  │  ├─ summary/
│  │  │   ├─ trigger/route.ts            # trigger transcription + summary pipeline
│  │  │   └─ get/route.ts                # fetch generated summary
│  │  └─ admin/
│  │      └─ jobs/route.ts               # admin job endpoints (re-run transcription, etc.)
│  └─ (marketing)/
│     └─ docs/
│        └─ page.tsx                     # optional docs/marketing page
│
├─ lib/                                  # server + client SDK wrappers & helpers
│  ├─ supabaseClient.ts                  # client Supabase (anon key)
│  ├─ supabaseServer.ts                  # server Supabase client (service role)
│  ├─ hms.ts                             # 100ms REST helpers (create room, token, recording)
│  ├─ openai.ts                          # OpenAI wrapper (summaries/transcribe)
│  ├─ storage.ts                         # abstract storage helpers (Supabase Storage / S3)
│  ├─ auth.ts                            # server helper to require/verify user tokens
│  ├─ errors.ts                          # shared error types / helpers
│  └─ validateEnv.ts                     # ensure required env vars on startup
│
├─ prisma/                               # optional if using Prisma ORM
│  └─ schema.prisma
│
├─ scripts/
│  ├─ migrate.sql                        # SQL migrations (create tables)
│  └─ seed.sql                           # optional seed data
│
├─ components/                           # shared UI components
│  ├─ layout/
│  │  ├─ Navbar.tsx
│  │  └─ Footer.tsx
│  ├─ ui/
│  │  ├─ Button.tsx
│  │  ├─ Input.tsx
│  │  ├─ Modal.tsx
│  │  └─ Toast.tsx
│  ├─ meeting/
│  │  ├─ VideoGrid.tsx                   # maps 100ms peers to tiles
│  │  ├─ ParticipantTile.tsx
│  │  ├─ ChatBox.tsx
│  │  ├─ FilePanel.tsx
│  │  ├─ RecordingPanel.tsx
│  │  └─ SummaryPanel.tsx
│  └─ auth/
│     ├─ SignInForm.tsx
│     └─ SignUpForm.tsx
│
├─ hooks/                                # react hooks (client-side logic)
│  ├─ useUser.ts                         # session + user profile
│  ├─ useMeeting.ts                      # join/leave + publish tracks
│  ├─ useChat.ts                         # chat state + send/receive
│  ├─ useFiles.ts                        # upload + list files
│  └─ useRecorder.ts                     # start/stop recording UI logic
│
├─ styles/
│  ├─ globals.css
│  └─ meeting.css
│
├─ utils/
│  ├─ formatDate.ts
│  ├─ nanoid.ts                          # id generator helper (or use npm)
│  └─ logger.ts
│
├─ workflows/                            # CI/CD or local dev workflow files (optional)
│  ├─ deploy.sh
│  └─ dev-ngrok.sh
│
└─ infra/                                # deployment infra (optional)
   ├─ aws/
   │  ├─ amplify.yml
   │  ├─ cloudformation.yml
   │  └─ ecs/
   └─ docker/
      ├─ Dockerfile
      └─ docker-compose.yml
