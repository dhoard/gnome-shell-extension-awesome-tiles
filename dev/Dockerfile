# x11docker/gnome (Modern ESM version)
FROM debian:trixie
ENV LANG en_US.UTF-8
ENV SHELL=/bin/bash

# cleanup script for use after apt-get
RUN echo '#! /bin/sh\n\
  env DEBIAN_FRONTEND=noninteractive apt-get autoremove -y\n\
  apt-get clean\n\
  find /var/lib/apt/lists -type f -delete\n\
  find /var/cache -type f -delete\n\
  find /var/log -type f -delete\n\
  exit 0\n\
  ' > /cleanup && chmod +x /cleanup

# basics
RUN apt-get update && \
  env DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
  locales && \
  echo "$LANG UTF-8" >> /etc/locale.gen && \
  locale-gen && \
  env DEBIAN_FRONTEND=noninteractive apt-get install -y \
  at-spi2-core \
  dbus \
  dbus-x11 \
  libpulse0 \
  procps \
  psutils \
  systemd \
  inotify-tools \
  x11-xserver-utils && \
  /cleanup

# Gnome
RUN apt-get update && \
  env DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
  gnome-session \
  gnome-shell && \
  /cleanup

# Gnome apps
RUN apt-get update && \
  env DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
  gedit \
  gnome-terminal \
  gnome-control-center \
  gnome-tweak-tool \
  nautilus && \
  /cleanup

# Gnome Shell extensions
RUN apt-get update && \
  env DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
  dconf-editor \
  gnome-shell-extension-manager && \
  /cleanup

# This is the CMD x11docker was looking for
CMD ["gnome-shell"]
