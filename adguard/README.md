# AdGuard Home on Raspberry Pi — Docker Compose Setup

This README documents the verification steps performed before installation and the full AdGuard Home Docker Compose setup used on the Raspberry Pi.

## Final Network Layout

The Pi keeps its existing address and also has a second IP on the main LAN so clients can reach AdGuard directly.

```text
Router LAN:
192.168.18.1

Raspberry Pi:
192.168.17.2   # existing/static Pi address
192.168.18.2   # secondary IP used by LAN clients for DNS

DHCP pool:
192.168.18.10 -> 192.168.18.254

Primary DNS handed out by DHCP:
192.168.18.2

Secondary DNS:
blank

Secondary DHCP server:
disabled
```

AdGuard Home runs in Docker and listens on port 53 on the Pi.

---

# Pre-install Verification

Before installing AdGuard Home, verify that the required ports are not already in use.

## Check ports 53, 3000, and 8081

```bash
sudo ss -lntup | grep -E ':(53|3000|8081)\b'
```

Expected result:

- Port `53/tcp` is free.
- Port `53/udp` is free.
- Port `3000/tcp` is free.
- Port `8081/tcp` is free.

If port 53 is already in use, identify the service before continuing.

## Check existing Docker port mappings

```bash
docker ps --format 'table {{.Names}}\t{{.Ports}}'
```

Verify that no existing container is already publishing:

```text
53/tcp
53/udp
3000/tcp
8081/tcp
```

Port 53 is the important one because AdGuard Home must receive DNS queries there.

---

# Installation

## 1. Create the AdGuard directory

Using the existing `~/containers` layout:

```bash
cd ~/containers

mkdir -p adguard/conf adguard/work

cd adguard
```

Result:

```text
~/containers/
├── adguard/
│   ├── docker-compose.yml
│   ├── conf/
│   └── work/
├── api/
├── cloudflared/
├── home_assistant/
├── jellyfin/
├── twingate/
└── ...
```

The `conf` and `work` directories persist AdGuard configuration and runtime data across container recreations.

---

## 2. Create `docker-compose.yml`

Create the file:

```bash
nano docker-compose.yml
```

Initial setup:

```yaml
services:
  adguardhome:
    image: adguard/adguardhome:latest
    container_name: adguardhome
    restart: unless-stopped

    ports:
      # DNS
      - "53:53/tcp"
      - "53:53/udp"

      # Initial setup wizard
      - "3000:3000/tcp"

      # Admin web UI after setup
      - "8081:80/tcp"

    volumes:
      - ./work:/opt/adguardhome/work
      - ./conf:/opt/adguardhome/conf
```

Save in `nano` with:

```text
Ctrl+O
Enter
Ctrl+X
```

The router remains responsible for DHCP, so DHCP-related ports are intentionally not exposed.

---

## 3. Validate the Compose file

```bash
docker compose config
```

There should be no configuration errors.

Start the container:

```bash
docker compose up -d
```

Check its status:

```bash
docker compose ps
```

Optional: follow the logs:

```bash
docker compose logs -f
```

Press `Ctrl+C` to stop following logs without stopping the container.

---

## 4. Open the AdGuard setup wizard

Find the Pi's current addresses:

```bash
hostname -I
```

Open the initial setup page from another machine:

```text
http://<PI-IP>:3000
```

Example:

```text
http://192.168.17.2:3000
```

---

## 5. Configure the setup wizard

For the admin web interface:

```text
Listen interface: All interfaces
Port: 80
```

Docker maps that internal port to:

```text
Pi :8081 -> container :80
```

For the DNS server:

```text
Listen interface: All interfaces
Port: 53
```

Create the AdGuard administrator username and password.

After setup, the normal admin URL becomes:

```text
http://<PI-IP>:8081
```

Example:

```text
http://192.168.18.2:8081
```

---

## 6. Configure upstream DNS

Open:

```text
Settings -> DNS settings -> Upstream DNS servers
```

The current deployment uses Quad9's standard secure service over DNS-over-TLS
(DoT), with Cloudflare DNS-over-HTTPS (DoH) as an availability fallback:

```yaml
upstream_dns:
  - tls://dns.quad9.net
fallback_dns:
  - https://cloudflare-dns.com/dns-query
```

`dns.quad9.net` is Quad9's privacy-focused service with malware and phishing
domain blocking.  Do **not** substitute `dns10.quad9.net` unless that blocking
is intentionally unwanted: the `dns10` service does not provide it.

DoT encrypts traffic between AdGuard Home and Quad9 on TCP port 853.  LAN
clients continue to query AdGuard on port 53; that internal hop is unchanged.
Cloudflare is contacted only if the Quad9 primary cannot answer, so normal
queries remain with Quad9.

The resulting path is:

```text
Client
  |
  | DNS
  v
AdGuard Home
  |
  | DNS-over-TLS (encrypted)
  v
Quad9
```

Verify that AdGuard is using Quad9 and DoT:

```bash
dig @192.168.18.2 +short txt proto.on.quad9.net
```

Expected result:

```text
"dot"
```

---

## 7. Test AdGuard before changing router DNS

From another machine, explicitly query the Pi.

Using `nslookup`:

```bash
nslookup google.com <PI-IP>
```

Example:

```bash
nslookup google.com 192.168.18.2
```

Then open:

```text
AdGuard Home -> Query Log
```

The DNS lookup should appear there.

This confirms:

```text
Client -> Pi:53 -> AdGuard Home -> upstream DNS
```

before making AdGuard the DNS server for the whole LAN.

---

## 8. Test filtering manually

Query a commonly filtered advertising domain:

```bash
nslookup doubleclick.net 192.168.18.2
```

Then check:

```text
AdGuard Home -> Query Log
```

Confirm that the query is processed by AdGuard and that filtering is active.

Whether this particular domain is blocked depends on the active filter lists, which can change over time. The Query Log confirms that AdGuard received the request; verify the response status there before treating it as a filtering result.

Avoid adding many aggressive blocklists immediately. Start with the default filtering and tune it later if necessary.

---

## 9. Make the Pi reachable from the main LAN

The original Pi address was:

```text
192.168.17.2
```

Normal DHCP clients were using:

```text
192.168.18.x
```

To make the Pi directly reachable from clients on the main LAN, it was given an additional address on that network. DHCP assigns client addresses; it does not provide routing between networks.

First identify the active NetworkManager connection:

```bash
nmcli connection show --active
```

Then add the secondary address:

```bash
sudo nmcli connection modify "<connection-name>" \
  +ipv4.addresses 192.168.18.2/24
```

Reactivate the connection:

```bash
sudo nmcli connection up "<connection-name>"
```

Verify:

```bash
ip addr
```

The Pi should now show both:

```text
inet 192.168.17.2/24
inet 192.168.18.2/24
```

The router does not need to bind both addresses to the Pi's MAC address.

---

## 10. Adjust the router DHCP range and DNS settings

The router's original DHCP pool began at:

```text
192.168.18.2
```

Because `192.168.18.2` is now manually assigned to the Pi, remove it from the dynamic DHCP pool.

Recommended example:

```text
DHCP start:
192.168.18.10

DHCP end:
192.168.18.254
```

This prevents the router from dynamically assigning the Pi's DNS address to another device.

Then configure DHCP to advertise:

```text
Primary DNS Server:
192.168.18.2

Secondary DNS Server:
blank
```

Keep:

```text
Secondary DHCP Server:
disabled
```

Do not configure a public fallback such as `8.8.8.8` as secondary DNS, because clients may bypass AdGuard even when the primary DNS server is healthy.

---

## 11. Verify the final LAN setup

From a normal client on `192.168.18.x`:

```bash
ping 192.168.18.2
```

Then:

```bash
nslookup google.com 192.168.18.2
```

Confirm the queries appear in AdGuard Home's Query Log.

After DHCP clients renew their leases, their normal DNS traffic should use:

```text
192.168.18.2
```

The final topology is:

```text
                    Router
                 192.168.18.1
                       |
          +------------+------------+
          |                         |
   Raspberry Pi                 LAN clients
  192.168.17.2                192.168.18.x
  192.168.18.2                     |
          ^                         |
          |--------- DNS -----------+
                 port 53
                    |
               AdGuard Home
                    |
                 Quad9
```

Existing services that already use `192.168.17.2` can continue doing so.

---

## 12. Remove the setup-wizard port

Once initial configuration is complete, port `3000` is no longer needed.

Update `docker-compose.yml` to:

```yaml
services:
  adguardhome:
    image: adguard/adguardhome:latest
    container_name: adguardhome
    restart: unless-stopped

    ports:
      - "53:53/tcp"
      - "53:53/udp"
      - "8081:80/tcp"

    volumes:
      - ./work:/opt/adguardhome/work
      - ./conf:/opt/adguardhome/conf
```

Apply the change:

```bash
docker compose up -d
```

The container may be recreated, but configuration and data remain persisted under:

```text
./conf
./work
```

---

# Useful Commands

Start or update AdGuard:

```bash
cd ~/containers/adguard
docker compose up -d
```

Stop it:

```bash
docker compose down
```

Check status:

```bash
docker compose ps
```

View logs:

```bash
docker compose logs -f
```

Check whether DNS is listening:

```bash
sudo ss -lntup | grep ':53 '
```

Test DNS locally:

```bash
nslookup google.com 192.168.18.2
```

Open the admin UI:

```text
http://192.168.18.2:8081
```

---

# Important Notes

- The router remains the DHCP server.
- AdGuard Home provides DNS only.
- Do not enable the router's secondary DHCP server for this setup.
- Do not allow the DHCP pool to include `192.168.18.2`.
- Do not configure a public secondary DNS server if the goal is to force LAN clients through AdGuard.
- Do not expose port 53 or the AdGuard admin UI directly to the public Internet.
- Existing Pi services can continue using `192.168.17.2`.
- LAN clients should use `192.168.18.2` for DNS.
