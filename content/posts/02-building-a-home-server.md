---
title: "Building a Home Server: My Journey with Docker and Self-Hosting"
date: 2024-02-10
category: "geek"
draft: false
---

I finally took the plunge and built a home server. Here's what I learned along the way.

## Why Self-Host?

The obvious reasons: privacy, control, and the satisfaction of running your own infrastructure. But there's also something deeply geeky about optimizing your own setup.

## The Hardware Setup

I went with a used Dell Optiplex (energy-efficient, quiet) running:
- 16GB RAM
- 500GB SSD for OS and apps
- 4TB HDD for storage

Total spend: ~$200. Not bad.

## Docker FTW

Docker changed everything. Instead of wrestling with dependencies, I'm now running:
- **Plex** - Media server
- **Nextcloud** - Personal cloud storage
- **Gitea** - Self-hosted Git
- **AdGuard Home** - Network-wide ad blocking

Each in its own container, completely isolated.

## The Fun Part: Networking

Setting up reverse proxies with Nginx, getting SSL certificates with Let's Encrypt, managing dynamic DNS... it's complex but incredibly satisfying when it all clicks.

## Performance Notes

After a month of running:
- CPU usually at 5-15%
- RAM around 40% (plenty of room)
- Network throughput: rock solid

The Optiplex is proving to be an excellent choice for continuous operation.

If you're thinking about it, just start. Pick one service, get it working, then scale.
