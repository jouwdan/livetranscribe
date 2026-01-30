# LiveTranscribe

An AI-powered real-time transcription platform designed for in-person events, conferences, workshops, and meetings. **Built to make events more accessible for hard of hearing, deaf, and neurodiverse audiences** by providing live, accurate transcriptions that viewers can customize to their needs.

It was built as a pilot to run at DevFest Ireland, due to the severe lack of Sign Language interpreters, and a third party service costing roughly $1000 for the day. Using this, the total cost was $1 in OpenAI API costs.

> **Built entirely with [v0 by Vercel](https://v0.link/lt)**

## ⚠️ Current Status

**This application is functional for real-time transcription but has known issues:**

- **Transcription ordering**: Transcriptions may occasionally appear out of sequence due to the asynchronous nature of real-time streaming
- **Metrics system**: Analytics and engagement tracking need significant improvements and reports inaccurate data
- **Active development**: Features are being refined and bugs are being actively addressed

The core transcription functionality works well for live events. Recent improvements include a queued save system with retry logic to prevent lost transcriptions during network issues.

## Features

### Real-Time Transcription

- **Live audio processing** with OpenAI's Realtime API (`gpt-realtime-mini` with `gpt-4o-mini-transcribe` for input audio transcription)
- **Streaming transcription** with word-by-word updates as speech occurs
- **Server-side Voice Activity Detection (VAD)** for natural speech segmentation
- **Multi-viewer support** with real-time synchronization via Supabase Realtime and Server-Sent Events (SSE)

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

## Accessibility First

LiveTranscribe provides real-time speech-to-text transcription to ensure everyone can participate fully in events, regardless of hearing ability or neurodiversity. Features include:

- **Live transcription** with minimal latency for real-time comprehension
- **Customizable display** with adjustable font sizes, font families, and layout options
- **High contrast modes** supporting both light and dark themes
- **Clean, distraction-free interface** optimized for reading comprehension
- **Public event access** with no account required for viewers

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

- **OpenAI Realtime API** for live speech-to-text transcription using **gpt-realtime-mini** with **gpt-4o-mini-transcribe**
- **Web Audio API** for browser-based audio capture with PCM16 format
- **AudioWorklet** processing with legacy ScriptProcessor fallback

### Storage & Hosting

- **Vercel Blob** for event logo storage
- **Vercel** for deployment and hosting
- **Edge Runtime** for optimal performance

## Getting Started

### Prerequisites

- Node.js 18+ and pnpm/npm/yarn
- A Supabase account and project
- An OpenAI API key with Realtime API access
- A Vercel account (for Blob storage and deployment)

### Environment Variables

Copy the `.env.example` file to `.env.local` and fill in your values:

\`\`\`bash
cp .env.example .env.local
\`\`\`

See `.env.example` for detailed instructions on where to obtain each value.

> **Security note:** `OPENAI_API_KEY` is only used inside server-side routes (e.g., `app/api/realtime-token/route.ts`) to mint short-lived Realtime session tokens. The browser never receives the raw key—rotate it immediately if it has been exposed previously.

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

Run the consolidated database schema script in the Supabase SQL Editor:

\`\`\`bash
# Execute the complete schema:
scripts/000_complete_database_schema.sql
\`\`\`

This single script creates all tables, functions, policies, and indexes needed for the application.

Alternatively, run the individual migration scripts in the `scripts/` folder in numerical order (002-026) if you need to understand the evolution of the schema.

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
2. Audio streamed to OpenAI Realtime API as PCM16 at 24kHz
3. Server-side VAD segments speech naturally with configurable thresholds
4. Delta events provide word-by-word transcription in real-time
5. Completed transcriptions saved to database
6. All connected viewers receive interim updates via SSE and final updates via Supabase Realtime

### Viewer Flow

1. Viewer connects to event via slug (no authentication required for public events)
2. Loads historical transcriptions from database
3. Subscribes to SSE endpoint (`/api/stream/[slug]`) for real-time interim updates
4. Subscribes to Supabase Realtime for final transcription database changes
5. Tracks engagement metrics locally (scroll events, visibility, active time)
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

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built entirely with [v0 by Vercel](https://v0.link/lt)
- Powered by [Next.js](https://nextjs.org/) and [React](https://react.dev/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Transcription by [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime)
- Database and auth by [Supabase](https://supabase.com/)
- Deployed on [Vercel](https://vercel.com/)

## Support

For issues and questions:

- Check existing GitHub issues
- Review documentation in this README
- Contact the development team

---

**Note**: This application is currently in beta. Features and APIs may change.
