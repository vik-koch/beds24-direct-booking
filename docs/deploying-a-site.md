# Deploying a site of its own

A site of its own is a private repository and a small machine. The repository holds the site's
content and one workflow; the machine runs a proxy and the site. Both use only what this
repository publishes: a released version, [`infra/cloud-init.yml`](../infra/cloud-init.yml) and
[`infra/site-deploy.yml`](../infra/site-deploy.yml).
[ADR 7](adr/0007-hosting-and-delivery.md) has the reasons and says how this differs from the
demo's delivery.

## What is needed

- **A VM with Ubuntu 24.04** and a public address, at a provider that takes cloud-init user
  data. x64 or ARM. "The machine's size" below says what is known about memory and disk.
- **A host name** with an A record on the machine's address, and an AAAA record only if the
  machine answers on IPv6. With a proxying DNS service the record must go straight to the
  machine: the certificate is fetched over port 80.
- **A private repository on GitHub** for the site.
- **A Beds24 token** for the site's account, or the simulator until there is one.

## From an empty machine to a live site

1. **Make the deploy key,** on a workstation, for this machine alone and without a passphrase:
   `ssh-keygen -t ed25519 -f site-deploy -N '' -C site-deploy`.
2. **Fill in the machine's file.** In a copy of `infra/cloud-init.yml`, replace
   `REPLACE_WITH_THE_DEPLOY_PUBLIC_KEY` by the content of `site-deploy.pub` and
   `REPLACE_WITH_AN_EMAIL_ADDRESS` by an address for the Let's Encrypt account.
3. **Create the VM** with that file as its user data. If the provider has a firewall of its
   own, open the ports 22, 80 and 443 there too. The set-up takes a few minutes after the
   first start; `cloud-init status --wait` on the machine ends when it is through, and
   `docker ps` then shows the proxy.
4. **Point the host name at the machine** and wait until it resolves.
5. **Pin the machine's host key.** `ssh-keyscan <address>` prints it. Compare its fingerprint
   (`ssh-keyscan <address> | ssh-keygen -lf -`) with the one in the provider's console log of
   the first start, then keep the output for the variable `DEPLOY_KNOWN_HOSTS`.
6. **Set up the repository.** Copy `infra/site-deploy.yml` to `.github/workflows/deploy.yml`,
   set `VERSION` in it to the release the site is built from, and on an ARM machine change
   `runs-on` to `ubuntu-24.04-arm`. Create the environment `site` with the secrets and
   variables below.
7. **Push to `main`.** The run builds the image, deploys it and ends green when the site
   answers 200 at its address. The first request makes the proxy fetch the certificate, which
   can take a minute.

## The repository's settings

All in the environment `site` (Settings, Environments).

<!-- prettier-ignore -->
| Kind | Name | Content |
|---|---|---|
| Secret | `DEPLOY_SSH_PRIVATE_KEY` | The content of the private key file from step 1. |
| Secret | `BEDS24_TOKEN` | The Beds24 token. Not needed while `SIM_IMAGE` is set. It must not contain a `$`: Compose reads the settings file and would take it for a variable. |
| Variable | `DEPLOY_HOST` | The machine's address or name, as SSH reaches it. |
| Variable | `DEPLOY_KNOWN_HOSTS` | The output of `ssh-keyscan` from step 5, for the same address or name as `DEPLOY_HOST`. |
| Variable | `APP_DOMAIN` | The site's host name. |
| Variable | `INDEXED` | `true` opens the site to search engines. Anything else, or no variable, keeps them out. |
| Variable | `SIM_IMAGE` | Optional. A simulator image, for example `ghcr.io/vik-koch/beds24-direct-booking-sim:0.1.0`: the site then runs against the simulator and needs no token. The published image is built for x64. |

## What a deployment does

The run checks out the site's repository and the release beside it, builds the image on the
runner and pushes it to the site repository's own registry, tagged with the commit. It then
logs the machine in to the registry with the run's own token, calls the release's
`scripts/deploy.sh` and logs the machine out again. The script copies `compose.yml` and the
settings to `/srv/site`, pulls and starts the image, removes the site's older images from the
machine and checks the address. A failure at any step ends the run red, with what runs on the
machine in the log; the version that ran before keeps running if the new image cannot be
pulled.

## A new release, and going back

- **A new release:** change `VERSION` in the workflow file and push.
- **Going back:** revert the commit on the site's `main` and push. The workflow file holds the
  release and the repository the content, so a commit is the whole state of the site, and a
  revert rebuilds and deploys the earlier one. Nothing is rolled back by itself.
- **By hand, when GitHub cannot be used:** the same script runs from a workstation with the
  release checked out, `scripts/deploy.sh <host> <settings file>`, with a settings file as
  [`.env.example`](../.env.example) describes it. The machine keeps the image it runs, so a
  restart of the machine or of Docker needs no registry.

## The machine afterwards

- **The proxy** is `/srv/proxy/compose.yml`, owned by root. A change to it, such as a new
  Traefik version, is made in that file, followed by `docker compose up -d` in the directory.
  The certificates are in the volume `proxy_acme` and are renewed by the proxy.
- **Updates:** Ubuntu's unattended upgrades cover the system and Docker, which is installed
  from Ubuntu's archive. A new kernel waits for a restart of the machine.
- **Watching it:** nothing on the machine reports an outage. An external uptime check on the
  site's address is the means meant for a site of this size.

## The machine's size

Known without measuring: the app's memory for JavaScript objects is capped at 192 MB
(`NODE_OPTIONS` in `compose.yml`), each container keeps at most 30 MB of logs, and the machine
gets 1 GB of swap. What the proxy and the app use in memory and what the images take on disk is
measured in the rehearsal and stated there.

## Rehearsal

Not run yet. This section will say what was tried on a fresh VM, with the date and the
figures, and what was not.

Checked so far, without a machine: `infra/cloud-init.yml` against cloud-init's schema
(`cloud-init schema`, version 26.2), the proxy's and the site's Compose files with
`docker compose config`, and the template's deploy step against stand-ins for `ssh` and
`scripts/deploy.sh`: with a token, with the simulator, with a deployment that fails, and
without a token.
