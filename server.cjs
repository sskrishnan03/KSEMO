require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// ── SMTP (Google Gmail) ──────────────────────────────────────────────
const SMTP_CONFIG = {
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.GMAIL_USER || 'sskrishnan03@gmail.com',
    pass: process.env.GMAIL_APP_PASSWORD || 'uiif wgee qqsx gybb',
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
      We received a request to reset the password for your Ksemo workspace account. Click the button below to choose a new password.
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
    <p style="margin:0;font-size:12px;color:#55556a;">Ksemo Workspace &mdash; Your personal AI workspace</p>
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

// ── Routes ───────────────────────────────────────────────────────────

// Generic email sender
app.post('/send-email', async (req, res) => {
  try {
    const { to, subject, body, from } = req.body;
    const mailOptions = {
      from: from || `Ksemo Workspace <${SMTP_CONFIG.auth.user}>`,
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
      from: `Ksemo Workspace <${SMTP_CONFIG.auth.user}>`,
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

app.listen(PORT, () => {
  console.log(`Ksemo Server running on port ${PORT}`);
  console.log(`Using SMTP: ${SMTP_CONFIG.host}:${SMTP_CONFIG.port}`);
});
