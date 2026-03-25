# Hotel Voice Agent

AI-powered voice agent for hotel reservations using Twilio Voice, OpenAI Realtime API, and a modular backend.

## Architecture

```
Caller → Twilio PSTN → Twilio Media Stream (WebSocket)
          ↓                        ↓
   /twilio/voice           /ws/media-stream
   (TwiML response)        (bidirectional audio)
                                   ↓
                           OpenAI Realtime API
                           (speech-to-speech + tool calling)
                                   ↓
                           Tool Handlers
                           ├── check_availability → Mock PMS
                           ├── get_room_rates → Mock PMS
                           ├── create_reservation → Mock PMS + PostgreSQL
                           ├── modify_reservation → Mock PMS + PostgreSQL
                           ├── cancel_reservation → Mock PMS + PostgreSQL
                           ├── find_reservation → Mock PMS
                           ├── send_confirmation_sms → Twilio SMS
                           ├── send_confirmation_email → Stub
                           └── transfer_to_human → Twilio Call Update
```

**Key components:**
- **Fastify** — HTTP server + WebSocket
- **Twilio** — Inbound calls, media streaming, SMS, call transfer
- **OpenAI Realtime API** — Speech-to-speech with function calling
- **PMS Provider** — Abstracted interface (mock for MVP, plug in Mews/Cloudbeds/Opera later)
- **PostgreSQL + Prisma** — Persistent data (calls, reservations, guests, audit logs)
- **Redis** — Ephemeral call session state

## Prerequisites

- Node.js 22+
- Docker & Docker Compose
- Twilio account with a phone number
- OpenAI API key with Realtime API access
- ngrok (for local development)

## Quick Start

### 1. Clone and install

```bash
cd hotel-voice-agent
cp .env.example .env
# Fill in your credentials in .env
npm install
```

### 2. Start infrastructure

```bash
docker compose up -d postgres redis
```

### 3. Setup database

```bash
npx prisma migrate dev --name init
# or for quick setup:
npx prisma db push
```

### 4. Start the server

```bash
npm run dev
```

### 5. Expose to Twilio (local dev)

```bash
ngrok http 3000
```

Copy the ngrok HTTPS URL and update:
- `.env`: set `TWILIO_WEBHOOK_BASE_URL=https://your-url.ngrok-free.app`
- Twilio Console → Phone Number → Voice webhook: `https://your-url.ngrok-free.app/twilio/voice` (POST)
- Twilio Console → Phone Number → Status callback: `https://your-url.ngrok-free.app/twilio/status` (POST)

### 6. Test

Call your Twilio phone number. The AI agent should answer and help with reservations.

## Docker Deployment

```bash
# Set env vars in .env or export them
docker compose up -d --build

# Run migrations
docker compose exec app npx prisma migrate deploy
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/twilio/voice` | Twilio inbound call webhook |
| POST | `/twilio/status` | Twilio call status callback |
| WS | `/ws/media-stream` | Twilio media stream WebSocket |
| GET | `/api/calls` | List recent calls (debug) |
| GET | `/api/calls/:callSid` | Get call details with events and tool logs |
| GET | `/api/reservations` | List reservations (debug) |
| GET | `/api/reservations/:code` | Get reservation by confirmation code |
| GET | `/api/hotels` | List hotels |

## Test Call Flows

### New reservation
1. Call the Twilio number
2. "Hi, I'd like to book a room"
3. Agent asks for dates → "April 10th to April 12th"
4. Agent checks availability, presents options
5. Choose a room type → "Deluxe please"
6. Provide name → "John Smith"
7. Agent confirms details and creates reservation
8. Agent reads confirmation code
9. "Can you send me a text confirmation?" → SMS sent

### Modification
1. "I need to change my reservation"
2. Provide confirmation code → "GP-TEST01"
3. "I'd like to change checkout to April 14th"
4. Agent confirms and modifies

### Cancellation
1. "I need to cancel my reservation"
2. Provide confirmation code
3. Agent confirms cancellation policy and cancels

### Spanish
1. "Hola, quisiera reservar una habitacion"
2. Agent continues in Spanish

### Transfer
1. "Can I speak to a manager?"
2. Agent transfers to human agent number

## Project Structure

```
src/
├── config/          # Env validation (Zod)
├── lib/             # Logger, Redis, types, errors
├── modules/
│   ├── ai/          # OpenAI Realtime session, tools, system prompt
│   ├── calls/       # Call lifecycle, events, tool logging
│   ├── handoff/     # Human escalation logic
│   ├── notifications/ # SMS + email adapters
│   ├── pms/         # PMS interface + mock provider
│   ├── reservations/  # Reservation orchestration
│   └── twilio/      # Webhooks, TwiML, media stream
├── plugins/         # Fastify plugins (Prisma, Redis)
└── server.ts        # Bootstrap
```

## Adding a Real PMS Provider

1. Implement `PmsProvider` interface in `src/modules/pms/`
2. Add provider selection logic in `pms.service.ts`
3. Configure credentials via env

```typescript
import type { PmsProvider } from './pms.interface.js';

export class MewsPmsProvider implements PmsProvider {
  readonly name = 'mews';
  // implement all methods...
}
```

## Next Steps for Production

- [ ] Twilio request signature validation middleware
- [ ] Rate limiting on webhooks
- [ ] Real PMS integration (Mews, Cloudbeds, Opera)
- [ ] Real email provider (Postmark, SendGrid)
- [ ] Call recording and transcription storage
- [ ] Multi-tenant support (multiple hotels)
- [ ] Admin dashboard
- [ ] Monitoring and alerting (Datadog, Sentry)
- [ ] Load testing
- [ ] CI/CD pipeline
- [ ] Comprehensive test suite
- [ ] Webhook retry handling
- [ ] Conversation analytics
