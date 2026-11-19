# Deploying a site of its own

A site of its own is a private repository and a small machine. The repository holds the site's
content and one workflow; the machine runs a proxy and the site. Both use only what this repository
publishes: a released version, [`infra/cloud-init.yml`](../infra/cloud-init.yml) and
[`infra/site-deploy.yml`](../infra/site-deploy.yml). [ADR 7](adr/0007-hosting-and-delivery.md) has
the reasons and says how this differs from the demo's delivery.

## What is needed

- **A VM with Ubuntu 24.04** and a public address, at a provider that takes cloud-init user data,
  x64 or ARM. 1 vCPU, 1 GB of memory and 20 GB of disk are enough; "The machine's size" below has
  the figures.
- **A host name** with an A record on the machine's address, and an AAAA record only if the machine
  answers on IPv6. With a proxying DNS service the record must go straight to the machine: the
  certificate is fetched over port 80.
- **A private repository on GitHub** for the site.
- **A Beds24 token** for the site's account, or the simulator until there is one.

## From an empty machine to a live site

1. **Make the deploy key,** on a workstation, for this machine alone and without a passphrase:
   `ssh-keygen -t ed25519 -f site-deploy -N '' -C site-deploy`.
2. **Fill in the machine's file.** In a copy of `infra/cloud-init.yml`, replace
   `REPLACE_WITH_THE_DEPLOY_PUBLIC_KEY` by the content of `site-deploy.pub` and
   `REPLACE_WITH_AN_EMAIL_ADDRESS` by a real address for the Let's Encrypt account. Without a valid
   address no certificate is issued, and the set-up stops before it starts the proxy when the value
   was left as it is.
3. **Create the VM** with that file as its user data. If the provider has a firewall of its own,
   open the ports 22, 80 and 443 there too. The set-up takes a few minutes after the first start;
   `cloud-init status --wait` on the machine ends when it is through, and `docker ps` then shows the
   proxy.
4. **Point the host name at the machine** and wait until it resolves.
5. **Pin the machine's host key.** `ssh-keyscan <address>` prints it. Compare its fingerprint
   (`ssh-keyscan <address> | ssh-keygen -lf -`) with the one in the provider's console log of the
   first start, then keep the output for the variable `DEPLOY_KNOWN_HOSTS`.
6. **Set up the repository.** Put the site's content into the folder `content/` of the repository,
   as [`content.md`](content.md) describes it. Copy `infra/site-deploy.yml` to
   `.github/workflows/deploy.yml`, set `VERSION` in it to the release the site is built from, and on
   an ARM machine change `runs-on` to `ubuntu-24.04-arm`. Create the environment `site` with the
   secrets and variables below.
7. **Push to `main`.** The run builds the image, deploys it and ends green when the site answers 200
   at its address. The first request makes the proxy fetch the certificate, which can take a minute.

## The repository's settings

All in the environment `site` (Settings, Environments).

<!-- prettier-ignore -->
| Kind | Name | Content |
|---|---|---|
| Secret | `DEPLOY_SSH_PRIVATE_KEY` | The content of the private key file from step 1. |
| Secret | `BEDS24_TOKEN` | The Beds24 token. Not needed while `SIM_IMAGE` is set. It must not contain a `$`: Compose reads the settings file and would take it for a variable. |
| Secret | `SITE_PASSWORD` | Optional. The site then answers only with this password, under any user name, as a site under test should. It holds only letters, digits, `-` and `_`, or the run stops before it deploys, and it needs release `0.2.0` or later. The deployment's check then expects 401 without it and 200 with it. |
| Variable | `DEPLOY_HOST` | The machine's address or name, as SSH reaches it. |
| Variable | `DEPLOY_KNOWN_HOSTS` | The output of `ssh-keyscan` from step 5, for the same address or name as `DEPLOY_HOST`. |
| Variable | `APP_DOMAIN` | The site's host name. |
| Variable | `INDEXED` | `true` opens the site to search engines. Anything else, or no variable, keeps them out. |
| Variable | `SIM_IMAGE` | Optional. A simulator image, for example `ghcr.io/vik-koch/beds24-direct-booking-sim:0.1.0`: the site then runs against the simulator and needs no token. The published image is built for x64. |

## What a deployment does

The run checks out the site's repository and the release beside it, builds the image on the runner
and pushes it to the site repository's own registry, tagged with the commit. It then logs the
machine in to the registry with the run's own token, calls the release's `scripts/deploy.sh` and
logs the machine out again. The script copies `compose.yml` and the settings to `/srv/site`, pulls
and starts the image, removes the site's older images from the machine and checks the address. A
failure at any step ends the run red, with what runs on the machine in the log; the version that ran
before keeps running if the new image cannot be pulled.

Only the head of `main` is deployed: a run for an older commit, also one that is started again
later, ends without deploying.

## A new release, and going back

- **A new release:** change `VERSION` in the workflow file and push.
- **Going back:** revert the commit on the site's `main` and push. The workflow file holds the
  release and the repository the content, so a commit is the whole state of the site, and a revert
  rebuilds and deploys the earlier one. Nothing is rolled back by itself.
- **By hand, when GitHub cannot be used:** the same script runs from a workstation with the release
  checked out, `scripts/deploy.sh <host> <settings file>`, with a settings file as
  [`.env.example`](../.env.example) describes it. The machine keeps the image it runs, so a restart
  of the machine or of Docker needs no registry.

## The machine afterwards

- **The proxy** is `/srv/proxy/compose.yml` with the Let's Encrypt address in `/srv/proxy/.env`,
  owned by root. A change, such as a new Traefik version, is made in these files, followed by
  `docker compose up -d` in the directory. The certificates are in the volume `proxy_acme` and are
  renewed by the proxy.
- **When the browser warns about the certificate,** the proxy serves its own stand-in because it got
  none. `docker compose logs` in `/srv/proxy` says why; the usual causes are a host name that does
  not point at the machine yet, a closed port 80 and an address Let's Encrypt refuses.
- **Updates:** Ubuntu's unattended upgrades cover the system and Docker, which is installed from
  Ubuntu's archive. A new kernel waits for a restart of the machine.
- **Watching it:** nothing on the machine reports an outage. An external uptime check on the site's
  address is the means meant for a site of this size.

## A second site on the same machine

A machine can carry more than one site, for example a site under test beside another one: each is a
stack of its own behind the one proxy, with its own host name, directory and repository.

1. **Point the second host name at the machine,** as in step 4.
2. **Give its repository a deploy key of its own** (step 1) and add the public key on the machine:
   `sudo tee -a /home/deploy/.ssh/authorized_keys < site-deploy.pub`.
3. **Give it a stack name no other site on the machine uses.** The template names its stack `site`
   (`STACK_NAME` in `deploy.yml`); the second one changes that line if the first one also came from
   the template. Create its directory, `sudo install -d -o deploy -g deploy /srv/<stack name>`; a
   machine from `cloud-init.yml` has `/srv/site` already.
4. **Set up and push** as in steps 6 and 7, with `DEPLOY_HOST` and `DEPLOY_KNOWN_HOSTS` as for the
   first site, and `SITE_PASSWORD` while it is under test.

Two sites on one machine were not tried under load. At rest one app took 31 MiB on the rehearsal's
larger machine (below), so a second one should fit the smallest machine; that is an estimate. Deploy
the two sites one after the other, not at the same moment: the machine's registry login and its
cleanup of old images are shared.

## The machine's size

**The smallest machine tried, and enough: 1 vCPU, 1 GB of memory, 20 GB of disk.** The image is
built on the runner, so the machine only runs the proxy and the app. By the figures below 10 GB of
disk would do; that was not tried, and neither was memory under load.

Measured at rest shortly after a deployment of release `0.1.0`, on the rehearsal's larger machine:

<!-- prettier-ignore -->
| What | Figure |
|---|---|
| Memory of the app's container | 31 MiB |
| Memory of the proxy's container | 19 MiB |
| Memory in use on the whole machine, system included | 0.7 GiB; swap unused |
| The app's image on disk | 241 MB |
| The proxy's image on disk | 230 MB |
| Disk in use on the whole machine | 4.4 GB |

Fixed by the set-up: the app's memory for JavaScript objects is capped at 192 MB (`NODE_OPTIONS` in
`compose.yml`), each container keeps at most 30 MB of logs, and the machine has 1 GB of swap. During
a deployment the machine holds the old and the new image at once.

## Rehearsal

Run by the maintainer on 2026-11-15 on two fresh Ubuntu 24.04 VMs at Hetzner, a CPX02 (x64, 1 vCPU,
1 GB, 20 GB) and a CAX11 (ARM, 2 vCPU, 4 GB, 40 GB), from a private repository with the template and
`VERSION` at `0.1.0`. Both ended with the site live behind a certificate from Let's Encrypt; the ARM
machine was set up from `infra/cloud-init.yml` as it is now.

On 2026-11-18 the maintainer deployed a second site, from the same private repository with `VERSION`
raised to `0.2.0`, onto the demo's machine (x64), which already ran the demo. The steps of "A second
site on the same machine" were followed with `SITE_PASSWORD` set. The first run went through: the
new site answered 401 with a `WWW-Authenticate` header without the password and kept its
`X-Robots-Tag`, and the demo kept answering.

- **Tried:** the machine from nothing on both architectures; the proxy with its certificate and the
  redirect from HTTP; the template from a private repository with a private image; the site against
  a real Beds24 account; a failed check of the address, which turns the run red; a second site
  beside another one behind the same proxy; a site closed with a password; a new release in the
  template's `VERSION`, onto a machine that had not run the site before.
- **Not tried:** the set-up stopping on an address that was not filled in, beyond the check itself
  run by hand; the simulator beside the app (`SIM_IMAGE`); opening the site to search engines
  (`INDEXED`); a move to a new release on a machine that runs the old one, and going back by a
  revert; two sites deployed at the same moment; a run for a commit that is no longer the head of
  `main`; a deployment by hand from a workstation; a restart of the machine; a certificate's
  renewal; another provider.
- **Checked without a machine:** `infra/cloud-init.yml` against cloud-init's schema, the Compose
  files with `docker compose config`, and the template's deploy step against stand-ins for `ssh` and
  `scripts/deploy.sh`.
