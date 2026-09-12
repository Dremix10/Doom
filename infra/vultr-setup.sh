#!/usr/bin/env bash
# Bring a fresh Ubuntu 22.04+ Vultr box up to run the sensor. Run as root.
set -euo pipefail
apt-get update && apt-get install -y docker.io docker-compose-plugin git ufw
systemctl enable --now docker
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw allow 853/tcp && ufw --force enable
echo "Docker ready. Now: cd infra/adguard && edit Caddyfile, then 'docker compose up -d'."
