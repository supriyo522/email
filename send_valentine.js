#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const imaps = require('imap-simple');
const { simpleParser } = require('mailparser');

const BASE_DIR = __dirname;
const CONFIG_PATH = path.join(BASE_DIR, 'config.json');
const STATE_PATH = path.join(BASE_DIR, 'recipients_state.json');

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error('Missing config.json — copy config.sample.json to config.json and update it.');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

function loadState(cfg) {
  if (fs.existsSync(STATE_PATH)) {
    const raw = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
    // migrate old format (email -> status) to new format (email -> {status, token})
    const migrated = {};
    Object.keys(raw).forEach(k => {
      const val = raw[k];
      if (typeof val === 'string') migrated[k] = { status: val, token: null };
      else migrated[k] = val;
    });
    return migrated;
  }
  const state = {};
  (cfg.recipients || []).forEach(r => (state[r] = { status: 'pending', token: null }));
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
  return state;
}

function saveState(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

async function sendEmail(cfg, to, textBody, htmlBody) {
  const transporter = nodemailer.createTransport({
    host: cfg.smtp_server,
    port: cfg.smtp_port || 587,
    secure: !!cfg.smtp_secure,
    auth: {
      user: cfg.from_email,
      pass: cfg.password
    }
  });

  const info = await transporter.sendMail({
    from: cfg.from_email,
    to,
    subject: cfg.subject || 'Will you be my Valentine?',
    text: textBody || (cfg.body || "Hi — this is a short question: will you be my Valentine?\nPlease reply with Link Below"),
    html: htmlBody || (cfg.body ? `<p>${(cfg.body || '').replace(/\n/g, '<br>')}</p>` : undefined)
  });
  return info;
}

async function sendToPending() {
  const cfg = loadConfig();
  const state = loadState(cfg);
  const base = cfg.base_url || `http://localhost:${cfg.port || 3000}`;
  for (const recip of Object.keys(state)) {
    const entry = state[recip];
    if (entry.status === 'pending') {
      // ensure token exists
      if (!entry.token) entry.token = crypto.randomBytes(10).toString('hex');
          const link = `${base}/respond/${entry.token}`;
          const textBody = `${cfg.body || "Hi — this is a short question: will you be my Valentine?\nPlease reply with 'Yes' or 'No'."}\n\nRespond here: ${link}`;
          const htmlBody = `<p>${(cfg.body || "Hi — this is a short question: will you be my Valentine?\nPlease reply with 'Yes' or 'No'. ").replace(/\n/g,'<br>')}</p><p><a href="${link}">Link</a></p>`;
      process.stdout.write(`Sending to ${recip}... `);
      try {
            await sendEmail(cfg, recip, textBody, htmlBody);
        console.log('sent');
      } catch (err) {
        console.log('failed:', err.message || err);
      }
    }
  }
  saveState(state);
}

async function checkReplies() {
  const cfg = loadConfig();
  const state = loadState(cfg);

  const imapConfig = {
    imap: {
      user: cfg.from_email,
      password: cfg.password,
      host: cfg.imap_server,
      port: cfg.imap_port || 993,
      tls: true,
      authTimeout: 3000
    }
  };

  const conn = await imaps.connect(imapConfig);
  await conn.openBox('INBOX');
  const searchCriteria = ['UNSEEN'];
  const fetchOptions = { bodies: [''], markSeen: true };
  const results = await conn.search(searchCriteria, fetchOptions);

  for (const msg of results) {
    const all = msg.parts.find(p => p.which === '');
    const parsed = await simpleParser(all.body);
    const from = parsed.from && parsed.from.value && parsed.from.value[0] && parsed.from.value[0].address;
    const body = (parsed.text || '').toLowerCase();
    if (from && state[from] === 'pending') {
      if (body.includes('yes')) {
        state[from] = 'yes';
        console.log(`${from} -> YES`);
      } else if (body.includes('no')) {
        state[from] = 'no';
        console.log(`${from} -> NO`);
      }
    }
  }

  saveState(state);
  await conn.end();
}

function printStatus() {
  const cfg = loadConfig();
  const state = loadState(cfg);
  Object.keys(state).forEach(r => console.log(r, state[r]));
}

(async function main() {
  const action = process.argv[2];
  if (!action) {
    console.log('Usage: node send_valentine.js <send|check|status>');
    process.exit(0);
  }
  try {
    if (action === 'send') await sendToPending();
    else if (action === 'check') await checkReplies();
    else if (action === 'status') printStatus();
    else console.log('Unknown action:', action);
  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(1);
  }
})();
