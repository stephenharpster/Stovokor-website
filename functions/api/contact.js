// POST /api/contact — forwarded to Web3Forms (free plan).
// Set WEB3FORMS_ACCESS_KEY as an encrypted Worker secret.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LIMITS = { name: 120, email: 254, company: 160, message: 4000 };

function oneLine(value, max) {
  return (value || '').toString().replace(/[\r\n\u0000]+/g, ' ').trim().slice(0, max);
}

export function readContactFields(form) {
  if (form.get('_gotcha')) return { honeypot: true };

  const name = oneLine(form.get('name'), LIMITS.name);
  const email = oneLine(form.get('email'), LIMITS.email).toLowerCase();
  const company = oneLine(form.get('company'), LIMITS.company);
  const message = (form.get('message') || '').toString().replace(/\u0000/g, '').trim().slice(0, LIMITS.message);

  if (!name || !email) {
    return { error: 'Name and email are required.', status: 400 };
  }
  if (!EMAIL_RE.test(email)) {
    return { error: 'A valid work email is required.', status: 400 };
  }
  return { fields: { name, email, company, message } };
}

export function buildEmail(fields) {
  return {
    subject: `Scoping request — ${fields.name}${fields.company ? ' / ' + fields.company : ''}`,
    reply_to: fields.email,
    text: [
      `Name:     ${fields.name}`,
      `Email:    ${fields.email}`,
      `Company:  ${fields.company || '—'}`,
      '',
      fields.message || '(no message)',
    ].join('\n'),
  };
}

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('origin');
  if (env.ALLOWED_ORIGIN && origin && origin !== env.ALLOWED_ORIGIN) {
    return json({ ok: false, error: 'Forbidden.' }, 403);
  }

  const contentType = request.headers.get('content-type') || '';
  if (
    !contentType.includes('application/x-www-form-urlencoded') &&
    !contentType.includes('multipart/form-data')
  ) {
    return json({ ok: false, error: 'Unsupported content type.' }, 415);
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: 'Invalid form body.' }, 400);
  }

  const parsed = readContactFields(form);
  if (parsed.honeypot) return json({ ok: true });
  if (parsed.error) return json({ ok: false, error: parsed.error }, parsed.status);

  if (!env.WEB3FORMS_ACCESS_KEY) {
    return json({ ok: false, error: 'Mail is not configured.' }, 503);
  }

  const mail = buildEmail(parsed.fields);
  const fields = parsed.fields;

  try {
    const res = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        access_key: env.WEB3FORMS_ACCESS_KEY,
        subject: mail.subject,
        name: fields.name,
        email: fields.email,
        company: fields.company,
        message: mail.text,
        replyto: fields.email,
      }),
    });
    const payload = await res.json().catch(function () { return {}; });
    if (!res.ok || payload.success === false) {
      console.error('mail send failed', payload);
      return json({ ok: false, error: 'Mail send failed.' }, 502);
    }
  } catch (err) {
    console.error('mail send failed', err && err.message ? err.message : err);
    return json({ ok: false, error: 'Mail send failed.' }, 502);
  }
  return json({ ok: true });
}

export function onRequestGet() {
  return new Response('Method Not Allowed', {
    status: 405,
    headers: { Allow: 'POST' },
  });
}
