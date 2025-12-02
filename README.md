# LiveTranscribe

An AI-powered real-time transcription platform for in-person events, conferences, workshops, and meetings.

## Features

- **Real-time transcription** using OpenAI's Transcribe API
- **Multi-viewer support** with live synchronization
- **Customizable viewer experience** with themes, font controls, and auto-scroll
- **Event management** with credit-based system and analytics
- **QR code sharing** for easy event access

## Tech Stack

- **Next.js 15** with App Router and React 19
- **Supabase** for auth, database, and real-time subscriptions
- **OpenAI Transcribe API** for live speech-to-text
- **Tailwind CSS** with shadcn/ui components
- **Vercel** for deployment

## Getting Started

### Prerequisites

- Node.js 18+
- [pnpm](https://pnpm.io/) package manager
- A Supabase account and project
- An OpenAI API key

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/jouwdan/livetranscribe.git
   cd livetranscribe
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Create a `.env.local` file in the root directory:

   ```env
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
   ```

4. Set up the database by running the migration scripts in `scripts/` folder in numerical order via the Supabase SQL Editor.

5. Start the development server:

   ```bash
   pnpm dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment

Deploy to Vercel by importing the project, adding environment variables, and deploying.

```bash
pnpm build
pnpm start
```

## License

This project is private and proprietary. All rights reserved.
