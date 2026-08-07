require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
// 25MB so recorded audio (base64 in JSON) fits — Deepgram accepts it.
app.use(express.json({ limit: '25mb' }));

const PORT = process.env.PORT || 3001;

// ── SMTP (Google Gmail) ──────────────────────────────────────────────
// Credentials come ONLY from the local .env file. They must never be
// hardcoded or committed to the repository.
const SMTP_CONFIG = {
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.GMAIL_USER || process.env.VITE_GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD || process.env.VITE_GMAIL_APP_PASSWORD,
  },
};
const transporter = nodemailer.createTransport(SMTP_CONFIG);

// ── Supabase Admin helpers ───────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gaowvgjtfrcklhkcqjac.supabase.co';
const SUPABASE_SECRET = process.env.SUPABASE_SECRET_KEY;

async function supabaseAdmin(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SECRET,
      Authorization: `Bearer ${SUPABASE_SECRET}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const text = await res.text();
  if (!text) return [];
  try { return JSON.parse(text); } catch { return []; }
}

async function findAllUsers() {
  const data = await supabaseAdmin(`/auth/v1/admin/users?page=1&per_page=1000`);
  return data.users || [];
}

async function findUserByEmail(email) {
  const users = await findAllUsers();
  return users.find((u) => u.email === email) || null;
}

// ── Token helpers (password reset) ───────────────────────────────────
const TOKEN_TTL_MS = 15 * 60 * 1000;

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function storeToken(userId, email, token) {
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
  await supabaseAdmin('/rest/v1/password_resets', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, email, token, expires_at: expiresAt }),
  });
}

async function consumeToken(token) {
  const rows = await supabaseAdmin(
    `/rest/v1/password_resets?token=eq.${token}&used=eq.false&expires_at=gt.${new Date().toISOString()}&select=*`
  );
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const row = rows[0];
  await supabaseAdmin(`/rest/v1/password_resets?id=eq.${row.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ used: true }),
  });
  return row;
}

// ── Email HTML template ──────────────────────────────────────────────
function resetEmailHtml(resetUrl) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0e0e12;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0e0e12;padding:40px 20px;">
<tr><td align="center">
<table width="480" cellpadding="0" cellspacing="0" style="background:#1a1a22;border-radius:16px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">
  <tr><td style="padding:32px 40px 24px;border-bottom:1px solid rgba(255,255,255,0.06);">
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="width:40px;height:40px;background:#2a2a35;border-radius:10px;border:1px solid rgba(255,255,255,0.1);text-align:center;vertical-align:middle;font-weight:bold;color:#fff;font-size:16px;">K</td>
      <td style="padding-left:12px;font-size:20px;font-weight:600;color:#ffffff;letter-spacing:-0.3px;">Ksemo</td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:40px 40px 32px;">
    <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">Reset your password</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#9a9aad;line-height:1.7;">
      We received a request to reset the password for your Ksemo account. Click the button below to choose a new password.
    </p>
    <table cellpadding="0" cellspacing="0" width="100%"><tr>
      <td align="center" style="padding:0 0 24px;">
        <a href="${resetUrl}" style="display:inline-block;padding:14px 36px;background:#ffffff;color:#0e0e12;font-size:14px;font-weight:600;text-decoration:none;border-radius:10px;letter-spacing:-0.2px;">
          Reset Password
        </a>
      </td>
    </tr></table>
    <p style="margin:0 0 8px;font-size:13px;color:#6b6b7b;line-height:1.6;">
      This link expires in <strong style="color:#9a9aad;">15 minutes</strong>.
    </p>
    <p style="margin:0;font-size:13px;color:#6b6b7b;line-height:1.6;">
      If you didn't request a password reset, you can safely ignore this email.
    </p>
  </td></tr>
  <tr><td style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.06);">
    <p style="margin:0;font-size:12px;color:#55556a;">Ksemo &mdash; Your personal AI voice chat</p>
  </td></tr>
</table>
</td></tr></table>
</body>
</html>`;
}

// ── Web Search (DuckDuckGo) ──────────────────────────────────────────
app.get('/api/web-search', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: 'Query parameter q is required' });

    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const response = await fetch(url);
    const data = await response.json();

    const results = [];
    if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
      for (const topic of data.RelatedTopics) {
        if (topic.Text) {
          results.push({ title: topic.Text.split(' - ')[0] || topic.Text, snippet: topic.Text, url: topic.FirstURL });
        }
        if (topic.Topics) {
          for (const sub of topic.Topics) {
            if (sub.Text) results.push({ title: sub.Text.split(' - ')[0] || sub.Text, snippet: sub.Text, url: sub.FirstURL });
          }
        }
      }
    }
    if (data.AbstractText) {
      results.unshift({ title: data.Headline || 'Summary', snippet: data.AbstractText, url: data.AbstractURL });
    }

    res.json({ results: results.slice(0, 10), abstract: data.AbstractText });
  } catch (error) {
    console.error('Web search error:', error);
    res.status(500).json({ error: 'Search failed', results: [] });
  }
});

// ── News (Google News RSS + Hacker News) ──────────────────────────────
function stripHtml(html) {
  return html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

app.get('/api/news', async (req, res) => {
  try {
    const query = (req.query.q || '').trim();
    const count = Math.min(parseInt(req.query.count, 10) || 10, 20);
    const rssUrl = query
      ? `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`
      : 'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en';
    const response = await fetch(rssUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KsemoNews/1.0)' },
    });
    if (!response.ok) throw new Error(`Google News RSS returned ${response.status}`);
    const xml = await response.text();

    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) && items.length < count) {
      const block = match[1];
      const title = stripHtml((block.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '');
      const pubDate = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '';
      const link = stripHtml((block.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '');
      const source = stripHtml((block.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [])[1] || '');
      if (title) items.push({ title, pubDate, source, url: link });
    }

    res.json({ items, count: items.length, source: 'google-news' });
  } catch (error) {
    console.error('Google News RSS error:', error.message);
    // Fallback to Hacker News
    try {
      const count = Math.min(parseInt(req.query.count, 10) || 10, 20);
      const idsRes = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
      const ids = await idsRes.json();
      const items = await Promise.all(
        ids.slice(0, count).map(async (id) => {
          const r = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
          return r.json();
        })
      );
      res.json({ items: items.filter(Boolean), count: items.length, source: 'hacker-news' });
    } catch (hnErr) {
      console.error('HN fallback error:', hnErr.message);
      res.status(500).json({ error: 'Failed to fetch news', items: [] });
    }
  }
});

app.get('/api/hn-top', async (req, res) => {
  try {
    const count = Math.min(parseInt(req.query.count, 10) || 10, 30);
    const idsRes = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
    const ids = await idsRes.json();
    const items = await Promise.all(
      ids.slice(0, count).map(async (id) => {
        const r = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
        return r.json();
      })
    );
    res.json({ items: items.filter(Boolean), count: items.length });
  } catch (error) {
    console.error('HN error:', error);
    res.status(500).json({ error: 'Failed to fetch Hacker News', items: [] });
  }
});

// ── Speech-to-Text (Deepgram) ─────────────────────────────────────────
// Receives a base64 audio blob from the browser and transcribes it.
// Deepgram is the free default (no card, $200/mo free credits) and the
// key lives only on the server.

function mimeToExt(mime = '') {
  const map = {
    'audio/webm': 'webm',
    'audio/mp4': 'm4a',
    'audio/x-m4a': 'm4a',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/mpeg': 'mp3',
  };
  return map[mime.split(';')[0].trim().toLowerCase()] || 'webm';
}

async function transcribeWithDeepgram(buffer, mime, language) {
  // NOTE: Send the raw audio bytes as the request body. Multipart (FormData)
  // with a Blob was corrupting the upload on Node; raw bytes always works.
  const params = new URLSearchParams({
    model: process.env.DEEPGRAM_MODEL || 'nova-3',
    punctuate: 'true',
    smart_format: 'true',
  });
  if (language) params.set('language', language);

  // Pass the browser's exact MIME type (e.g. audio/webm;codecs=opus) directly to Deepgram if present.
  // This lets Deepgram's container decoder know the exact format and codec, avoiding 400 Bad Request.
  const contentType = mime || 'audio/webm';

  const resp = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
    method: 'POST',
    headers: {
      Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
      'Content-Type': contentType,
    },
    body: buffer,
  });
  const data = await resp.json();
  if (!resp.ok) {
    return { error: data?.err_msg || `Deepgram ${resp.status}`, status: resp.status };
  }
  const text = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
  return { text: text.trim() };
}

app.post('/api/transcribe', async (req, res) => {
  try {
    const { audio, mime, language } = req.body || {};
    if (!audio) return res.status(400).json({ error: 'audio (base64) is required.', text: '' });

    const buffer = Buffer.from(audio, 'base64');
    if (buffer.length === 0) return res.status(400).json({ error: 'audio is empty.', text: '' });

    if (process.env.DEEPGRAM_API_KEY) {
      const dg = await transcribeWithDeepgram(buffer, mime, language);
      if (dg.text !== undefined) return res.json({ text: dg.text });
      
      // If it's a Bad Request (likely empty/short audio containing only headers),
      // return a success response with empty text so the client session doesn't crash.
      if (dg.status === 400) {
        console.warn('Deepgram STT empty/short audio warning:', dg.error);
        return res.json({ text: '', warning: dg.error });
      }

      console.error('Deepgram STT error:', dg.status, dg.error);
      return res.status(502).json({ error: dg.error || 'Transcription failed', text: '' });
    }

    return res.status(400).json({ error: 'No STT provider configured (set DEEPGRAM_API_KEY).', text: '' });
  } catch (err) {
    console.error('Transcribe error:', err);
    res.status(500).json({ error: 'Transcription failed', text: '' });
  }
});

// ── Premium TTS ───────────────────────────────────────────────────
// Receives text + optional voice id, streams audio back from the Premium API.
// The API key lives only on the server (process.env.KSEMO_VOICE_API_KEY or ELEVENLABS_API_KEY).

const DEFAULT_PREMIUM_VOICE = 'pNInz6obpgDQGcFmaJgB'; // "Adam" (free-plan accessible)
// Voices that work on the free plan: Adam, Antoni, Bella, Arnold, Callum, Rachel, Nicole.
const PREMIUM_VOICE_RE = /^[a-zA-Z0-9_\-]{10,}$/;

app.post('/api/tts', async (req, res) => {
  try {
    const key = process.env.KSEMO_VOICE_API_KEY || process.env.ELEVENLABS_API_KEY;
    if (!key) {
      return res.status(400).json({ error: 'Voice API key is not configured on the server.' });
    }
    const { text, voiceId } = req.body || {};
    if (!text || !text.trim()) return res.status(400).json({ error: 'text is required.' });

    const voice = voiceId && PREMIUM_VOICE_RE.test(voiceId) ? voiceId : DEFAULT_PREMIUM_VOICE;
    const modelId = process.env.KSEMO_VOICE_MODEL_ID || process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';

    const body = {
      text,
      model_id: modelId,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.0,
        use_speaker_boost: true,
      },
    };

    const resp = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice}/stream?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': key,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify(body),
      }
    );

    if (!resp.ok) {
      const detail = await resp.text();
      console.error('Premium TTS error:', resp.status, detail.slice(0, 300));
      return res.status(502).json({ error: 'TTS failed' });
    }

    res.setHeader('Content-Type', resp.headers.get('content-type') || 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-cache');
    const buf = Buffer.from(await resp.arrayBuffer());
    res.send(buf);
  } catch (err) {
    console.error('TTS error:', err);
    res.status(500).json({ error: 'TTS failed' });
  }
});

// ── Routes ───────────────────────────────────────────────────────────

// Generic email sender
app.post('/send-email', async (req, res) => {
  try {
    const { to, subject, body } = req.body;
    if (!SMTP_CONFIG.auth.user || !SMTP_CONFIG.auth.pass) {
      return res.status(500).json({ success: false, error: 'SMTP credentials are not configured on the server.' });
    }
    // Always send from the authenticated Gmail account — Gmail rejects
    // custom "from" addresses that don't belong to the account.
    const mailOptions = {
      from: `Ksemo Voice Chat <${SMTP_CONFIG.auth.user}>`,
      to,
      subject,
      text: body,
      html: body.replace(/\n/g, '<br>'),
    };
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    res.json({ success: true, messageId: info.messageId });
  } catch (error) {
    console.error('Email error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Forgot password ──────────────────────────────────────────────────
app.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const user = await findUserByEmail(email);
    if (!user) {
      return res.json({ success: true, message: 'If an account exists, a reset link has been sent.' });
    }

    await supabaseAdmin(
      `/rest/v1/password_resets?user_id=eq.${user.id}&used=eq.false`,
      { method: 'PATCH', body: JSON.stringify({ used: true }) }
    );

    const token = generateToken();
    await storeToken(user.id, email, token);

    const appUrl = process.env.APP_URL || 'http://localhost:5173';
    const resetUrl = `${appUrl}/reset?token=${token}`;

    await transporter.sendMail({
      from: `Ksemo Voice Chat <${SMTP_CONFIG.auth.user}>`,
      to: email,
      subject: 'Reset your Ksemo password',
      html: resetEmailHtml(resetUrl),
    });

    console.log(`Password reset email sent to ${email}`);
    res.json({ success: true, message: 'If an account exists, a reset link has been sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ── Reset password ───────────────────────────────────────────────────
app.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const record = await consumeToken(token);
    if (!record) {
      return res.status(400).json({ error: 'Invalid or expired reset link.' });
    }

    const result = await supabaseAdmin(`/auth/v1/admin/users/${record.user_id}`, {
      method: 'PUT',
      body: JSON.stringify({ password }),
    });

    if (result.error) {
      console.error('Supabase password update error:', result.error);
      return res.status(500).json({ error: 'Failed to update password. Please try again.' });
    }

    console.log(`Password updated for user ${record.user_id}`);
    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ── Static hosting (production) ────────────────────────────────────
// In production the Express server also serves the built React app
// (render.yaml runs `node server.cjs`). The `dist` folder is produced
// by `npm run build`. All /api routes above take priority over the SPA
// fallback because they are registered first.
const distDir = path.join(__dirname, 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  // SPA fallback: any non-API GET returns index.html so client-side routing
  // works when deep-linking to /app/... routes. API routes are registered
  // above and take priority because they are matched first.
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api/')) {
      return res.sendFile(path.join(distDir, 'index.html'));
    }
    next();
  });
}

app.listen(PORT, () => {
  console.log(`Ksemo Server running on port ${PORT}`);
  console.log(`Using SMTP: ${SMTP_CONFIG.host}:${SMTP_CONFIG.port}`);
});
