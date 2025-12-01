# LiveTranscribe

An AI-powered real-time transcription platform designed for in-person events, conferences, workshops, and meetings. Built with Next.js 16, React 19, OpenAI's Realtime Transcription API, and Supabase.

## Features

### Real-Time Transcription

- **Live audio processing** with OpenAI's Realtime API (gpt-4o-realtime-preview model)
- **Streaming transcription** with word-by-word updates as speech occurs
- **AI validation layer** using gpt-5-mini to cross-examine transcriptions for accuracy
- **Server-side Voice Activity Detection (VAD)** for natural speech segmentation
- **Multi-viewer support** with real-time synchronization via WebSockets and Supabase Realtime

### Viewer Experience

- **Customizable display** with font size, font family, and width mode controls
- **Light/dark mode** with theme persistence
- **Auto-scroll** feature to follow live transcriptions
- **Interim transcriptions** showing real-time speech as it's being processed
- **Public/private event modes** for different audience needs
- **QR code sharing** for easy event access

### Event Management

- **Credit-based system** for managing transcription minutes per event
- **Event archiving** to organize past and active events
- **Custom branding** with event logos and descriptions
- **Session tracking** for multiple broadcast sessions per event
- **Comprehensive analytics** with viewer engagement metrics

### Analytics & Metrics

- **Viewer session tracking**: scroll events, visibility changes, active time
- **Broadcast statistics**: session duration, total transcriptions, word count
- **Engagement metrics**: peak viewers, average view duration, engagement scores
- **Event timeline** showing key milestones (creation, first/last transcription)

### Admin Dashboard

- **User management** with role-based access control
- **Beta key system** for controlled access during beta phase
- **Credit allocation** and management for events
- **System-wide analytics** and oversight

## Tech Stack

### Frontend

- **Next.js 15** with App Router and Server Components
- **React 19** with Server Actions and latest features
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **shadcn/ui** component library
- **Sonner** for toast notifications
- **Lucide React** for icons

### Backend & Database

- **Supabase** for authentication, database, and real-time subscriptions
- **PostgreSQL** with Row Level Security (RLS) policies
- **Server Actions** for secure data mutations
- **WebSockets** for real-time broadcaster-to-viewer communication

### AI & Audio Processing

- **OpenAI Realtime API** for live speech-to-text transcription
- **GPT-4o-mini-transcribe** for initial transcription
- **GPT-5-mini** for AI validation and error correction
- **Web Audio API** for browser-based audio capture

### Storage & Hosting

- **Vercel Blob** for event logo storage
- **Vercel** for deployment and hosting
- **Edge Runtime** for optimal performance

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- A Supabase account and project
- An OpenAI API key
- A Vercel account (for deployment)

### Environment Variables

Create a `.env.local` file in the root directory:

\`\`\`env
# OpenAI
OPENAI_API_KEY=your_openai_api_key

# Vercel Blob (for logo uploads)
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_JWT_SECRET=your_jwt_secret

# Postgres (provided by Supabase)
POSTGRES_URL=your_postgres_url
POSTGRES_PRISMA_URL=your_postgres_prisma_url
POSTGRES_URL_NON_POOLING=your_postgres_url_non_pooling
POSTGRES_USER=your_postgres_user
POSTGRES_PASSWORD=your_postgres_password
POSTGRES_DATABASE=your_postgres_database
POSTGRES_HOST=your_postgres_host

# Optional: Development redirect URL for Supabase auth
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=http://localhost:3000
\`\`\`

> **Security note:** `OPENAI_API_KEY` is only used inside server-side routes (e.g., `app/api/transcribe-ws/route.ts`) to mint short-lived Realtime session tokens. The browser never receives the raw key—rotate it immediately if it has been exposed previously.

**Where to find these:**

- Supabase: Project Settings → API → Project URL and anon/public key
- OpenAI: <https://platform.openai.com/api-keys>
- Vercel Blob: Create a Blob store in your Vercel project settings

### Installation

1. Clone the repository:

\`\`\`bash
git clone https://github.com/jouwdan/livetranscribe.git
cd livetranscribe
\`\`\`

2. Install dependencies:

\`\`\`bash
npm install
or
pnpm install
\`\`\`
3. Set up the database:

Run the migration scripts in the `scripts/` folder in numerical order. Open the Supabase SQL Editor (Project → SQL Editor) and execute each file:

\`\`\`bash
# Execute in order:
scripts/002_add_users_and_usage.sql
scripts/003_add_viewer_tracking.sql
scripts/004_enable_realtime.sql
# ... continue with remaining numbered scripts
\`\`\`

Alternatively, use the Supabase CLI:

\`\`\`bash
# Install Supabase CLI (macOS)
brew install supabase/tap/supabase

# Link to your project
supabase link --project-ref your-project-ref

# Apply migrations manually or set up proper migration folder structure
\`\`\`

**Key tables created:**

- `user_profiles` - User accounts and admin status
- `events` - Event definitions with slugs and settings
- `transcriptions` - Real-time transcription storage
- `event_credits` - Credit allocation system
- `viewer_sessions` - Viewer engagement tracking
- `event_sessions` - Broadcast session history
- `beta_access_keys` - Beta access management

4. Start the development server:

\`\`\`bash
pnpm dev
\`\`\`

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

\`\`\`
├── app/                          # Next.js App Router pages
│   ├── admin/                   # Admin dashboard pages
│   ├── api/                     # API routes and WebSocket handlers
│   ├── auth/                    # Authentication pages (login, signup)
│   ├── beta/                    # Beta access request page
│   ├── broadcast/               # Event broadcasting interface
│   ├── create-event/            # Event creation page
│   ├── dashboard/               # User dashboard
│   ├── edit/                    # Event editing pages
│   ├── join/                    # Event join page for viewers
│   ├── metrics/                 # Event analytics pages
│   ├── view/                    # Public event viewer pages
│   ├── layout.tsx               # Root layout with providers
│   ├── page.tsx                 # Homepage
│   └── globals.css              # Global styles
├── components/                   # React components
│   ├── ui/                      # shadcn/ui components
│   ├── admin-dashboard.tsx      # Admin panel component
│   ├── beta-keys-manager.tsx    # Beta key management
│   ├── broadcast-interface.tsx  # Broadcasting UI
│   ├── viewer-interface.tsx     # Viewer UI
│   ├── create-event-form.tsx    # Event creation form
│   ├── edit-event-form.tsx      # Event editing form
│   └── ...                      # Other components
├── lib/                         # Utility functions and libraries
│   ├── supabase/                # Supabase client setup
│   ├── openai-transcriber.ts    # OpenAI Realtime API integration
│   ├── validate-transcription.ts # AI validation layer
│   ├── metrics.ts               # Metrics tracking system
│   ├── format-time.ts           # Time formatting utilities
│   └── utils.ts                 # General utilities
├── scripts/                     # Database migration scripts
│   ├── 002_add_users_and_usage.sql
│   ├── 003_add_viewer_tracking.sql
│   ├── 007_add_credit_system.sql
│   └── ...                      # Additional migrations
├── middleware.ts                # Next.js middleware for auth
├── next.config.mjs              # Next.js configuration
├── tailwind.config.ts           # Tailwind CSS configuration
└── tsconfig.json                # TypeScript configuration
\`\`\`

## Key Components

### Broadcasting (`components/broadcast-interface.tsx`)

Handles audio capture, real-time transcription streaming, and viewer management. Integrates with OpenAI's Realtime API for continuous audio processing and broadcasts interim/final transcriptions via WebSocket.

### Viewer (`components/viewer-interface.tsx`)

Displays real-time transcriptions with customization options. Tracks viewer engagement metrics including scroll behavior, active time, and visibility changes. Receives real-time updates via Supabase Realtime subscription for database changes.

### Transcription Processing (`lib/openai-transcriber.ts`)

Manages WebSocket connection to OpenAI's Realtime API, handles audio streaming with PCM16 format, processes delta and completion events, and implements server-side Voice Activity Detection.

### AI Validation (`lib/validate-transcription.ts`)

Cross-examines completed transcriptions using gpt-5-mini with context from the past minute of transcripts and event details to correct errors while preserving meaning.

### Metrics System (`lib/metrics.ts`)

Two tracker classes for comprehensive analytics:

- `ViewerMetricsTracker`: Accumulates engagement data and syncs to database every 30 seconds
- `BroadcastMetricsTracker`: Tracks session statistics including duration and transcription counts

## Database Schema

### Core Tables

**user_profiles**

- User authentication and profile information
- Admin role management
- Links to Supabase Auth

**events**

- Event definitions with unique slugs
- Session state tracking
- Credit allocation tracking
- Aggregate metrics storage

**transcriptions**

- Real-time transcription storage
- Sequence numbering for ordering
- Final vs. interim text differentiation
- Links to events and sessions

**event_credits**

- Credit pool system for events
- Allocation tracking
- Admin notes and management

**viewer_sessions**

- Individual viewer tracking
- Engagement metrics (scrolls, visibility, active time)
- Session-based identification

**event_sessions**

- Broadcast session history
- Duration and transcription statistics
- Multiple sessions per event support

**beta_access_keys**

- Beta access management
- Usage tracking and limits
- Expiration dates

### Row Level Security (RLS)

All tables implement Row Level Security policies to ensure:

- Users can only access their own data
- Event owners can manage their events
- Admins have elevated permissions
- Public viewers can access active events
- Secure beta key validation

## Authentication Flow

1. Users register with email/password via Supabase Auth
2. User profile automatically created in `user_profiles` table
3. Beta key validation during registration (beta phase)
4. Middleware protects authenticated routes
5. Server Actions verify user permissions before mutations

## Real-Time Architecture

### Broadcasting Flow

1. Broadcaster captures audio via Web Audio API
2. Audio streamed to OpenAI Realtime API as PCM16
3. Delta events provide word-by-word transcription
4. Completed transcriptions sent to AI validation
5. Validated text saved to database and broadcast via SSE
6. All connected viewers receive updates via SSE stream

### Viewer Flow

1. Viewer connects to event via slug
2. Loads historical transcriptions from database
3. Subscribes to SSE endpoint for real-time interim updates
4. Subscribes to Supabase Realtime for database changes
5. Tracks engagement metrics locally
6. Syncs metrics to database every 30 seconds

## Credit System

Events require credits (measured in minutes) to broadcast:

1. Admins allocate credit pools to users
2. Users assign credits from their pool to specific events
3. Broadcasting consumes credits in real-time
4. When credits depleted, broadcast automatically stops
5. Credits can be reallocated between events

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import project in Vercel dashboard
3. Add environment variables
4. Deploy

Vercel automatically:

- Builds the Next.js app
- Sets up edge functions
- Configures CDN
- Provides preview deployments

### Manual Deployment

\`\`\`bash
npm run build
npm start
or
pnpm build
pnpm start
\`\`\`

Ensure all environment variables are set in your hosting environment.

**Note:** The project uses Vercel Blob for logo uploads, which requires a Vercel deployment or compatible blob storage.

## Development Guidelines

### Adding New Features

1. Check existing patterns in similar components
2. Use Server Components where possible for better performance
3. Implement proper error handling with try-catch blocks
4. Add toast notifications for user feedback (use Sonner)
5. Follow Row Level Security patterns for database access
6. Test with multiple concurrent users/sessions

### Database Migrations

Create new migration files in `scripts/` with sequential numbering:

\`\`\`sql
-- scripts/019_your_feature.sql
-- Description of what this migration does

ALTER TABLE your_table ADD COLUMN new_field text;

-- Update RLS policies if needed
CREATE POLICY "policy_name" ON your_table ...
\`\`\`

### Styling Guidelines

- Use Tailwind CSS utility classes
- Follow the design system in `globals.css`
- Use semantic design tokens (e.g., `bg-background`, `text-foreground`)
- Implement responsive design with mobile-first approach
- Support light/dark mode via `next-themes`

## Troubleshooting

### Audio not capturing

- Check browser permissions for microphone access
- Ensure HTTPS connection (required for audio APIs)
- Verify OpenAI API key is valid

### Transcriptions not appearing

- Check SSE connection in browser DevTools (Network tab → EventStream)
- Verify Supabase Realtime is enabled for `transcriptions` table
- Check database RLS policies allow access
- Ensure OpenAI API key is valid and has Realtime API access

### Credit issues

- Ensure credits allocated to the event
- Verify event is not archived
- Check credit allocation hasn't expired

### Performance issues

- Enable React Compiler in `next.config.mjs`
- Use `use cache` directive for expensive operations
- Implement proper indexing on database tables

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is private and proprietary. All rights reserved.

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Powered by [OpenAI Realtime API](https://platform.openai.com/docs/api-reference/realtime)
- Database and auth by [Supabase](https://supabase.com/)
- Deployed on [Vercel](https://vercel.com/)

## Support

For issues and questions:

- Check existing GitHub issues
- Review documentation in this README
- Contact the development team

---

**Note**: This application is currently in beta. Features and APIs may change.
