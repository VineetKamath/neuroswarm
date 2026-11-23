#!/usr/bin/env bash
# NeuroSwarm temporary install on a VPS, fully isolated from anything else on it.
#
#   * everything lives in /opt/neuroswarm (code, Python venv, cloudflared binary)
#   * runs as its own system user "neuroswarm"
#   * listens on 127.0.0.1 only (port below); no nginx/apache/firewall changes
#   * public HTTPS link via a free Cloudflare quick tunnel (*.trycloudflare.com)
#
# Remove everything later with:  sudo bash /opt/neuroswarm/remove.sh
set -euo pipefail

APP=/opt/neuroswarm
PORT=8020
BUNDLE=${1:-/tmp/neuroswarm.tar.gz}
export PIP_NO_CACHE_DIR=1          # leave no pip cache behind in /root
INSTALLED_PKGS=""

[ "$(id -u)" = 0 ] || { echo "Run as root (sudo)."; exit 1; }
[ -f "$BUNDLE" ] || { echo "Bundle $BUNDLE not found."; exit 1; }
if ss -ltn | awk '{print $4}' | grep -q ":$PORT\$"; then
  echo "Port $PORT is already used by something else. Edit PORT in this script."; exit 1
fi

echo "== Python check"
PY=$(command -v python3.12 || command -v python3.11 || command -v python3.10 || command -v python3)
"$PY" -c 'import sys; assert (3,9) <= sys.version_info[:2] < (3,14), sys.version' \
  || { echo "Need Python 3.9 to 3.13"; exit 1; }
if ! "$PY" -m venv --help >/dev/null 2>&1 || ! "$PY" -c 'import ensurepip' 2>/dev/null; then
  echo "== Installing the python venv package (the only system package this needs)"
  for pkg in python3-venv "$(basename "$PY")-venv"; do
    dpkg -s "$pkg" >/dev/null 2>&1 || INSTALLED_PKGS="$INSTALLED_PKGS $pkg"
  done
  apt-get update -qq && apt-get install -y -qq $INSTALLED_PKGS
fi

echo "== Files"
id neuroswarm >/dev/null 2>&1 || useradd --system --home "$APP" --shell /usr/sbin/nologin neuroswarm
mkdir -p "$APP"
tar -xzf "$BUNDLE" -C "$APP"
cp "$APP/deploy/vps/remove.sh" "$APP/remove.sh"
echo "$INSTALLED_PKGS" > "$APP/.installed_packages"   # remove.sh uninstalls exactly these
rm -rf /tmp/ns "$BUNDLE"

echo "== Python packages (CPU-only PyTorch, a few minutes)"
"$PY" -m venv "$APP/venv"
"$APP/venv/bin/pip" install -q --upgrade pip
"$APP/venv/bin/pip" install -q --index-url https://download.pytorch.org/whl/cpu torch
"$APP/venv/bin/pip" install -q -r "$APP/backend/requirements.txt"

echo "== Embedding model"
mkdir -p "$APP/.cache"
chown -R neuroswarm:neuroswarm "$APP"
cd "$APP"   # run from our own folder: the neuroswarm user cannot read /root
sudo -u neuroswarm HF_HOME="$APP/.cache/huggingface" "$APP/venv/bin/python" -c \
  "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

echo "== cloudflared (kept inside $APP)"
mkdir -p "$APP/bin"
ARCH=$(dpkg --print-architecture 2>/dev/null || echo amd64)
curl -fsSL -o "$APP/bin/cloudflared" "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-$ARCH"
chmod +x "$APP/bin/cloudflared"
chown -R neuroswarm:neuroswarm "$APP"

SECRET=$(head -c 32 /dev/urandom | base64 | tr -d '/+=' | head -c 40)

echo "== Services"
cat > /etc/systemd/system/neuroswarm.service <<EOF
[Unit]
Description=NeuroSwarm (temporary demo)
After=network-online.target

[Service]
User=neuroswarm
WorkingDirectory=$APP
Environment=SERVE_FRONTEND=1
Environment=FRONTEND_DIST=$APP/frontend/dist
Environment=HF_HOME=$APP/.cache/huggingface
Environment=SECRET_KEY=$SECRET
ExecStart=$APP/venv/bin/python backend/run.py --host 127.0.0.1 --port $PORT
Restart=on-failure
MemoryMax=3G

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/neuroswarm-tunnel.service <<EOF
[Unit]
Description=NeuroSwarm public link (Cloudflare quick tunnel)
After=neuroswarm.service
Requires=neuroswarm.service

[Service]
User=neuroswarm
ExecStart=$APP/bin/cloudflared tunnel --url http://127.0.0.1:$PORT --no-autoupdate
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now neuroswarm.service
echo "== Waiting for the app to start (loads the model and indexes the notes)"
for i in $(seq 1 90); do curl -fs "http://127.0.0.1:$PORT/api/health" >/dev/null && break; sleep 2; done
curl -fs "http://127.0.0.1:$PORT/api/health" >/dev/null || { journalctl -u neuroswarm -n 40 --no-pager; exit 1; }
systemctl enable --now neuroswarm-tunnel.service

for i in $(seq 1 30); do
  URL=$(journalctl -u neuroswarm-tunnel --no-pager | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' | tail -1 || true)
  [ -n "$URL" ] && break; sleep 2
done
echo
echo "NeuroSwarm is live at: ${URL:-<not found yet; run: journalctl -u neuroswarm-tunnel | grep trycloudflare>}"
echo "Remove everything later with: sudo bash $APP/remove.sh"
