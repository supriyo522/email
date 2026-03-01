# Valentine Email Helper

Simple Node.js script to send a short "Will you be my Valentine?" email and track replies so you don't ask again if someone replies "No".

## Setup

### 1. Create a Gmail App Password

For Gmail, you must use a 16-character App Password (not your regular password):

1. Enable 2-Step Verification: https://myaccount.google.com/security
2. Create an App Password: https://myaccount.google.com/apppasswords
   - Select **Mail** and **Windows Computer** (or your device)
   - Copy the 16-character password generated
3. Copy `config.sample.json` to `config.json`:

```bash
cp config.sample.json config.json
```

4. Edit `config.json` and fill in:
   - `from_email`: your Gmail address (e.g., `you@gmail.com`)
   - `password`: the 16-char app password from step 2
   - `recipients`: list of email addresses to send valentines to

5. Install dependencies:

```bash
npm install
```

## Usage

- Send messages to pending recipients:

```bash
npm run send
```

- Check inbox for replies (marks `yes` or `no` in `recipients_state.json`):

```bash
npm run check
```

- Show current status:

```bash
npm run status
```

## Security & notes

- Keep `config.json` private; it contains your Gmail app password.
- The 16-character app password is specific to this app and can be revoked anytime at https://myaccount.google.com/apppasswords
- This script marks someone as `no` when their reply contains the word "no" (case-insensitive), and `yes` when it contains "yes".
- Once someone replies "No", they won't receive another email from this script.
- Once someone replies "Yes", they won't receive another email either.
