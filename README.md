# LiveTranscribe

An open-source, self-hostable AI-powered real-time transcription platform designed for in-person events, conferences, workshops, and meetings. Built with Next.js 16, React 19, OpenAI's Realtime Transcription API, and Supabase.

## Features

### Real-Time Transcription

- **Live audio processing** with OpenAI's Realtime API (gpt-4o-realtime-preview model)
- **Streaming transcription** with word-by-word updates as speech occurs
- **AI validation layer** using gpt-4o-mini to cross-examine transcriptions for accuracy
- **Server-side Voice Activity Detection (VAD)** for natural speech segmentation
- **Multi-viewer support** with real-time synchronization via WebSockets and Supabase Realtime

### Viewer Experience

- **Customizable display** with font size, font family, and width mode controls
- **Light/dark mode** with theme persistence
- **Auto-scroll** feature to follow live transcriptions
- **Interim transcriptions** showing real-time speech as it's being processed
- **Public event viewing** with easy URL sharing

### Event Management

- **Multiple events** per user with unique URLs
- **Event archiving** to organize past and active events
- **Custom branding** with event logos and descriptions
- **Session tracking** for multiple broadcast sessions per event
- **Download transcriptions** as text files

## Tech Stack

### Frontend

- **Next.js 16** with App Router and Server Components
- **React 19** with Server Actions
- **TypeScript** for type safety
- **Tailwind CSS v4** for styling
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
- **GPT-4o-mini** for AI validation and error correction
- **Web Audio API** for browser-based audio capture

### Storage & Hosting

- **Vercel Blob** for event logo storage
- **Vercel** for deployment and hosting (recommended)
- **Edge Runtime** for optimal performance

## Getting Started

### Quick Deploy (Recommended)

Deploy your own instance with one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fjouwdan%2Flivetranscribe&env=OPENAI_API_KEY&envDescription=OpenAI%20API%20key%20required%20for%20real-time%20transcription&envLink=https%3A%2F%2Fplatform.openai.com%2Fapi-keys&integration-ids=oac_VqOgBHqhEoFTPzGkPd7L0iH6&project-name=livetranscribe&repository-name=livetranscribe)

This will:
1. Clone the repository to your GitHub account
2. Connect Supabase integration (automatically configures database)
3. Prompt you for your OpenAI API key
4. Deploy to Vercel with all environment variables configured

After deployment:
1. Visit your deployed site and sign up for an account
2. Navigate to `/setup` to initialize your database with one click
3. Your app is ready to use!

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- A Supabase account and project
- An OpenAI API key with Realtime API access
- A Vercel account (for Blob storage and deployment)

### Environment Variables

Create a `.env.local` file in the root directory:

\`\`\`env
# OpenAI (required for transcription)
OPENAI_API_KEY=your_openai_api_key

# Supabase (required for database and auth)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Vercel Blob (optional - only needed if you want event logo uploads)
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token

# Optional: Development redirect URL for Supabase auth
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=http://localhost:3000
\`\`\`

> **Note:** When deploying on Vercel with Supabase integration, most variables are automatically configured. You'll only need to manually add `OPENAI_API_KEY`.

> **Security note:** `OPENAI_API_KEY` is only used inside server-side routes to mint short-lived Realtime session tokens. The browser never receives the raw key.

### Manual Installation

If you prefer to set up manually instead of using the deploy button:

1. Clone the repository:

\`\`\`bash
git clone https://github.com/jouwdan/livetranscribe.git
cd livetranscribe
\`\`\`

2. Install dependencies:

\`\`\`bash
pnpm install
\`\`\`

3. Set up the database:

**Option 1: Use the setup page (easiest)**
- Start your development server (see step 4)
- Sign up for an account
- Visit `http://localhost:3000/setup`
- Click "Initialize Database"

**Option 2: Manual SQL execution**
Run the SQL script from `scripts/001_setup_database.sql` in your Supabase SQL Editor.

4. Start the development server:

\`\`\`bash
pnpm dev
\`\`\`

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

\`\`\`
├── app/                          # Next.js App Router pages
│   ├── (auth-pages)/            # Authentication pages
│   ├── (authenticated)/         # Protected routes
│   │   ├── broadcast/           # Broadcasting interface
│   │   ├── create/              # Event creation
│   │   ├── dashboard/           # User dashboard
│   │   ├── edit/                # Event editing
│   │   └── sessions/            # Session management
│   ├── api/                     # API routes and handlers
│   ├── view/                    # Public event viewer
│   └── layout.tsx               # Root layout
├── components/                   # React components
│   ├── ui/                      # shadcn/ui components
│   ├── broadcast-interface.tsx  # Broadcasting UI
│   ├── viewer-interface.tsx     # Viewer UI
│   └── ...                      # Other components
├── lib/                         # Utility functions
│   ├── supabase/                # Supabase client setup
│   ├── openai-transcriber.ts    # OpenAI Realtime integration
│   └── ...                      # Other utilities
├── scripts/                     # Database migrations
└── middleware.ts                # Auth middleware
\`\`\`

## Key Features

### Broadcasting

Start a broadcast session to capture audio from your microphone and transcribe it in real-time. The system uses OpenAI's Realtime API for continuous audio processing and broadcasts transcriptions to all connected viewers.

### Viewing

Access any active event via its unique URL (`/view/[slug]`) to see live transcriptions. No authentication required for viewers - just share the link.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is open source and available under the [MIT License](LICENSE).

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Powered by [OpenAI Realtime API](https://platform.openai.com/docs/api-reference/realtime)
- Database and auth by [Supabase](https://supabase.com/)
- Hosting on [Vercel](https://vercel.com/)

## Support

For issues and questions:
- Open a GitHub issue
- Check the documentation in this README
- Review existing issues for solutions

---

**Made with ❤️ for the open source community**
