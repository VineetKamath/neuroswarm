#!/usr/bin/env bash
# Removes the temporary NeuroSwarm install completely and nothing else:
#   both neuroswarm services, the "neuroswarm" user, /opt/neuroswarm, temp files,
#   and any system package that setup.sh had to install (listed in .installed_packages).
set -uo pipefail
[ "$(id -u)" = 0 ] || { echo "Run as root (sudo)."; exit 1; }

PKGS=$(cat /opt/neuroswarm/.installed_packages 2>/dev/null || true)

systemctl disable --now neuroswarm-tunnel.service neuroswarm.service 2>/dev/null
rm -f /etc/systemd/system/neuroswarm-tunnel.service /etc/systemd/system/neuroswarm.service
systemctl daemon-reload
systemctl reset-failed neuroswarm.service neuroswarm-tunnel.service 2>/dev/null
pkill -u neuroswarm 2>/dev/null; sleep 1
userdel neuroswarm 2>/dev/null
cd / && rm -rf /opt/neuroswarm /tmp/neuroswarm.tar.gz /tmp/ns
if [ -n "${PKGS// /}" ]; then
  echo "Uninstalling packages added by setup:$PKGS"
  apt-get purge -y -qq $PKGS
fi

units=$(systemctl list-unit-files 2>/dev/null | grep -c neuroswarm)
user=$(id neuroswarm >/dev/null 2>&1 && echo 1 || echo 0)
dir=$([ -e /opt/neuroswarm ] && echo 1 || echo 0)
if [ $((units + user + dir)) -eq 0 ]; then
  echo "NeuroSwarm removed completely. The public link no longer works."
else
  echo "Warning: left behind -> units:$units user:$user folder:$dir"
fi
