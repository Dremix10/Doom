# The DNS sensor (AdGuard Home + Caddy on Vultr)

Apple won't let an app read Screen Time without a paid developer account, so we
don't run anything on the phone. Instead each iPhone installs a one-tap
**encrypted-DNS profile** that routes all DNS through our AdGuard Home resolver.
While you scroll TikTok the phone resolves a stream of its hostnames; we turn
that into minute-level activity. To "pull someone out" we flip their per-client
blocked services in AdGuard and the feed stops loading.

## One-time setup on the Vultr VM

1. Point your GoDaddy domain's A record `dns.YOURDOMAIN.com` at the VM's IP.
2. Edit `Caddyfile` and replace `dns.YOURDOMAIN.com`.
3. `docker compose up -d`
4. Open `http://VM_IP:3000`, run the AdGuard setup wizard, set admin user/pass.
   - Admin web on port 80, DNS listener on 53.
5. In AdGuard: Settings -> DNS -> enable **DNS-over-HTTPS**; Settings -> General ->
   turn on **query logging** and set retention to 24h+.
6. Put the admin creds and URL in `backend/.env`:
   ```
   ADGUARD_URL=http://VM_IP:80
   ADGUARD_USER=admin
   ADGUARD_PASS=...
   DOH_BASE_URL=https://dns.YOURDOMAIN.com/dns-query
   ```

## The per-phone profile

The backend generates each user's `.mobileconfig` at
`/profile/<token>.mobileconfig`, with the DoH URL
`https://dns.YOURDOMAIN.com/dns-query/<clientid>`. The `<clientid>` is how
AdGuard tags that phone's queries (Settings -> Clients) and how we block services
per phone. The setup page at `/setup/<token>` walks the user through installing it.

## Gotchas to test first thing Saturday

- iCloud Private Relay and any VPN bypass the profile — turn them off on demo phones.
- DNS caching makes activity look sparse; we treat "any query in the last 60s" as
  active rather than counting queries, which is robust to caching.
- ClientID in the DoH path needs AdGuard v0.107+; the `latest` image is fine.
