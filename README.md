# Stovokor.ai — static site

Plain HTML + CSS. No build step, no framework, no runtime dependencies.

```bash
node dev-server.mjs
```

Then open http://127.0.0.1:8787. The contact form posts to `/api/contact` and writes to `.local/contact-inbox.json`. Local dev does not send email.

## Roles

- **GoDaddy** — you keep the domain registration for `stovokor.ai` there.
- **Cloudflare Pages** — hosts the website and the contact function.
- **Cloudflare DNS** — after you point GoDaddy nameservers at Cloudflare, SSL and the custom domain work automatically.
- **Cloudflare Email Sending** — optional, after DNS is on Cloudflare, so the live form can email `info@stovokor.ai`. No separate mail vendor.

## Publish

1. Create a free Cloudflare account at https://dash.cloudflare.com/sign-up
2. Push this `Website/` folder to a Git repo (GitHub is the usual path).
3. Cloudflare → Workers & Pages → Create → Pages → Connect to Git.

       Build command:        (leave blank)
       Build output dir:     /
       Framework preset:     None

4. Add the domain in Cloudflare (Add a site) → `stovokor.ai`. Free plan is enough. Cloudflare will show two nameservers.
5. In GoDaddy → Domain → Nameservers, replace GoDaddy’s nameservers with those two Cloudflare nameservers. Keep the domain registered at GoDaddy.
6. If `info@stovokor.ai` already receives mail (GoDaddy email, Google Workspace, Microsoft 365), copy the existing MX / SPF / DKIM / DMARC records into Cloudflare DNS **before** or immediately after the nameserver change.
7. Pages → Custom domains → add `stovokor.ai` and `www.stovokor.ai`.

## Contact form after the site is live

The form will not email anyone until Email Sending is on.

1. Cloudflare dashboard → Compute → Email Service → Email Sending → Onboard Domain → `stovokor.ai`.
2. Confirm the `EMAIL` binding on the Pages project (see `wrangler.toml`).
3. Optional env vars: `TO_EMAIL=info@stovokor.ai`, `FROM_EMAIL=website@stovokor.ai`.

Until then, people can still use the `info@stovokor.ai` mailto link on the page.

## SEO

After the hostname is live, submit `https://www.stovokor.ai/sitemap.xml` in Google Search Console.
