# Mentora Deployment Guide

This repo is set up for a GitHub Actions pipeline that runs checks on every pull request and deploys to DigitalOcean App Platform from `main`.

## 0. Easy approach (local + DigitalOcean terminal)

Use this simple workflow every day:

1. Build and test locally.
2. Push code to GitHub (`main` branch).
3. GitHub Actions runs CI automatically.
4. If CI passes, GitHub Actions deploys to DigitalOcean automatically.

This gives you:

- Fast local development on your machine.
- Safe checks before production.
- One-click deploy flow by just pushing code.

## 0.1 One-time setup from terminal only

On your terminal, install and authenticate `doctl`:

```bash
doctl auth init
```

Create the app from spec:

```bash
doctl apps create --spec digitalocean/app.yaml
```

List apps and copy the app ID:

```bash
doctl apps list
```

Set this value in GitHub secrets as `DIGITALOCEAN_APP_ID`.

Also set `DIGITALOCEAN_ACCESS_TOKEN` in GitHub secrets.

## 1. What gets deployed

- Frontend: Vite app from `frontend/`
- Backend: FastAPI app from `backend/`
- Hosting target: DigitalOcean App Platform
- Deployment trigger: GitHub Actions workflow on `main`

## 2. Production architecture

Recommended layout:

- `https://your-domain.com` serves the React app
- `https://your-domain.com/api/v1` serves the FastAPI backend

This works cleanly with the current frontend defaults because the app now uses relative API paths by default.

## 3. Required GitHub secrets

Create these secrets in your GitHub repository settings:

- `DIGITALOCEAN_ACCESS_TOKEN`
- `DIGITALOCEAN_APP_ID`

## 4. Required backend environment variables

Set these in DigitalOcean App Platform for the backend service:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL`
- `JWT_SECRET_KEY`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `GOOGLE_API_KEY`
- `FRONTEND_URL`
- `BACKEND_URL`
- `SMTP_HOST` if email sending is enabled
- `SMTP_PORT` if email sending is enabled
- `SMTP_USER` if email sending is enabled
- `SMTP_PASSWORD` if email sending is enabled
- `SMTP_FROM_EMAIL` if email sending is enabled

For a same-domain deployment, set `FRONTEND_URL` to your public site URL, for example `https://your-domain.com`.

## 5. First-time DigitalOcean setup

1. Create a new App Platform app in DigitalOcean.
2. Point it at this GitHub repository.
3. Use `digitalocean/app.yaml` as the app spec.
4. Add the backend secrets listed above in the App Platform environment settings.
5. Save the generated `APP ID` and store it in GitHub as `DIGITALOCEAN_APP_ID`.
6. Create a GitHub secret named `DIGITALOCEAN_ACCESS_TOKEN` with a token that can update apps.

## 6. Domain setup (`mentora-ai.app`)

Recommended production URLs:

- Frontend: `https://mentora-ai.app`
- Backend API: `https://mentora-ai.app/api/v1`

Steps:

1. Add `mentora-ai.app` in your DigitalOcean App Platform custom domains.
2. Add DNS records in your domain provider exactly as shown by DigitalOcean.
3. Wait for domain verification and SSL certificate to become active.
4. Set backend environment variable `FRONTEND_URL=https://mentora-ai.app`.

If you want the frontend and API on one hostname, keep the frontend at the root domain and route the API under `/api` as defined in the app spec.

## 6.1 Brevo email setup (SMTP)

The current backend sends auth emails via SMTP, so this works with Brevo directly.

Set these backend environment variables in DigitalOcean:

- `SMTP_HOST=smtp-relay.brevo.com`
- `SMTP_PORT=587`
- `SMTP_USE_TLS=true`
- `SMTP_FROM_EMAIL=<your-verified-sender@mentora-ai.app>`
- `SMTP_USER=<your-brevo-smtp-login>`
- `SMTP_PASSWORD=<your-brevo-smtp-key>`

Important:

- If you were using default provider SMTP before, switching to Brevo is the correct move for production deliverability.
- Do not store SMTP or API keys in source code or git.
- If a key was exposed, revoke it in Brevo and create a new key.

## 7. CI workflow behavior

The `CI` workflow does three things:

- Verifies the backend still parses with `python -m compileall`
- Runs `bandit` and `pip-audit` on the backend
- Runs `npm run lint` and `npm run build` on the frontend

## 8. Deploy workflow behavior

The deploy workflow updates the DigitalOcean App Platform app whenever `main` changes.

It uses:

- `digitalocean/action-doctl@v2`
- `doctl apps update ... --spec digitalocean/app.yaml --wait`

## 9. Local production-style testing

Backend:

```bash
cd backend
python -m pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## 10. Recommended follow-up improvements

- Add a real test suite for the backend.
- Add a `package-lock.json` so frontend installs are reproducible.
- Replace the broad CORS policy with an explicit production origin list if you split frontend and backend onto different hostnames.