# VendaAI

.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/5c826166-bbe6-416b-8c0b-a66cc1ffabb0).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```



<!-- VendaAI implementation synced through GitHub. -->
## Backend secrets

The application keeps provider credentials server-side. Configure these in the Supabase/Lovable Cloud Secrets for the VendaAI backend:

- `OPENAI_API_KEY` — required by the AI Sales Engine and WhatsApp audio transcription.
- `WHATSAPP_ACCESS_TOKEN` — Meta WhatsApp Cloud API access token.
- `WHATSAPP_APP_SECRET` — used to validate `x-hub-signature-256` webhook signatures.
- `WHATSAPP_VERIFY_TOKEN` — used by Meta webhook verification.
- `WHATSAPP_GRAPH_VERSION` — optional; defaults to `v24.0`.

Never put any of these values in frontend code, `VITE_*` variables, Git commits, or database records.

## Verification

GitHub Actions runs frontend typecheck, lint, unit tests and build, plus Deno typechecks for all VendaAI Edge Functions. Database changes are versioned under `drizzle/migrations` and must be applied to the connected backend before using the corresponding feature in production.

