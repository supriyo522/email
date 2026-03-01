const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
app.use(express.json());

const STATE_PATH = path.join(__dirname, 'recipients_state.json');

function loadState() {
  if (!fs.existsSync(STATE_PATH)) return {};
  return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
}

function saveState(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

app.use(express.static(path.join(__dirname, 'public')));

app.get('/respond/:token', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'respond.html'));
});

app.post('/api/respond', (req, res) => {
  const { token, answer } = req.body || {};
  if (!token || !answer) return res.status(400).json({ error: 'token and answer required' });
  const state = loadState();
  const entryKey = Object.keys(state).find(k => state[k].token === token);
  if (!entryKey) return res.status(404).json({ error: 'token not found' });
  state[entryKey].status = answer === 'yes' ? 'yes' : 'no';
  saveState(state);
  return res.json({ ok: true, status: state[entryKey].status });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Response server listening on http://localhost:${port}`));
