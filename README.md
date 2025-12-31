# TextWeight

SMS-based weight tracking application. Text your weight to track it, view graphs on the web.

## Features

- **SMS Input**: Text your weight (e.g., `185.5`) to log it
- **Commands**: `HELP`, `LAST`, `STATUS`, `CANCEL`
- **Web Dashboard**: Interactive graph, data table, edit/delete entries
- **CSV Import/Export**: Bulk import historical data, export for backup
- **Apple Health Export**: Export in Apple Health compatible format
- **Magic Link Auth**: Passwordless login via SMS

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required settings:
- `TWILIO_ACCOUNT_SID` - Your Twilio Account SID
- `TWILIO_AUTH_TOKEN` - Your Twilio Auth Token
- `TWILIO_PHONE_NUMBER` - Your Twilio phone number (e.g., +15551234567)
- `USER_PHONE_NUMBER` - Your personal phone number
- `SESSION_SECRET` - Random string for session encryption

### 3. Initialize Database

```bash
npm run setup
```

### 4. Start Server

```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

### 5. Configure Twilio Webhook

In your Twilio Console, set the webhook URL for your phone number:
```
https://your-domain.com/api/sms/incoming
```

Method: POST

## SMS Commands

| Command | Description |
|---------|-------------|
| `185.5` | Log weight (any number with up to 1 decimal) |
| `HELP` | Show available commands |
| `LAST` | Show most recent entry |
| `STATUS` | Show pending entry status |
| `CANCEL` | Cancel pending outlier entry |

## Outlier Detection

If you enter a weight that's more than 15% different from your last entry, it will be held as "pending" for 5 minutes. During this time:
- You'll receive a confirmation message
- Send `CANCEL` to abort
- After 5 minutes, it auto-logs

This prevents accidental typos from corrupting your data.

## Deployment

### Railway

1. Create new project from GitHub repo
2. Add environment variables in Railway dashboard
3. Deploy - Railway will auto-detect Node.js
4. Add persistent volume mounted at `/app/data`
5. Configure Twilio webhook to your Railway URL

### Render

1. Create new Web Service from repo
2. Set environment variables
3. Add persistent disk mounted at `/app/data`
4. Deploy and configure Twilio webhook

## Tech Stack

- **Backend**: Node.js, Express
- **Database**: SQLite (better-sqlite3)
- **SMS**: Twilio
- **Frontend**: Vanilla HTML/CSS/JS
- **Charts**: Chart.js with zoom plugin

## Project Structure

```
textweight/
├── server.js              # Express app entry point
├── data/                  # SQLite database (gitignored)
├── src/
│   ├── routes/            # API route handlers
│   ├── services/          # Business logic
│   └── utils/             # Helpers
├── public/                # Static frontend files
└── scripts/               # Setup scripts
```

## License

MIT
