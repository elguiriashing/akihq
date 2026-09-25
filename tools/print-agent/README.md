# AkiHQ unattended print agent

This is an outbound-only Node agent for the bar computer. Staff phones create server-held tickets; the agent claims its paired stations and spools them without a browser print dialog. Deploy the coordinated application and `20260925140340_unattended_printing.sql` before pairing. This code has automated transport/emulator tests, **not physical printer acceptance**.

## Setup

1. Install Node 22 or later on the bar computer. For network printers, confirm the model accepts raw ESC/POS over a private LAN TCP port (commonly 9100). Windows/macOS/Linux can use this path. For a USB printer on macOS/Linux, install and test a CUPS raw queue. Windows USB needs the existing system print dialog or a future supported adapter; it is not supported by this agent.
2. In AkiHQ's PoS administrator printer panel, pair the computer and select only the stations it will print. Download the one-time configuration. The device token is a secret, expires after 90 days and can be revoked immediately. Neither an owner password nor a service-role key belongs in the configuration.
3. Save the file as `akihq-printer.local.json` outside any public web directory, readable only by the service account (for example `chmod 600` on Unix). Edit each route to the actual private IPv4 address/port or installed CUPS queue. `example.json` contains placeholders, not working credentials. Use 32/42/48 columns appropriate to the printer/roll. Enable cutting only on compatible models.
4. Start `node tools/print-agent/agent.mjs /protected/path/akihq-printer.local.json`. Keep the computer awake on the printer network. Install this command under the OS service manager if it must start at boot; run one instance per configuration with a persistent writable configuration directory. No inbound local HTTP server or browser trust certificate is needed.
5. Send one test ticket per station and perform the acceptance checks below before business use. Pair only stations with configured routes. Never publish the downloaded configuration or include it in a support screenshot.

The agent intentionally uses printable ASCII with accent transliteration and `EUR` to avoid assuming a vendor code page. It strips printer control bytes from business/customer text. Unicode logos, exact accented glyphs, cash drawers and printer status protocols require a verified model-specific adapter. Preparation/payment output remains an operational ticket, not a fiscal invoice.

## Recovery

A durable journal is written before the server authorizes bytes to be sent. A completed spool is **not proof of paper output**. A crash, missing response or paper/network problem may leave a claimed/uncertain job. The system never automatically repeats that physical print.

Stop the agent, inspect the printer and the AkiHQ ticket queue, and record which output exists. If a copy is necessary, request an explicitly marked COPY in AkiHQ with a reason. To clear the local hold after inspection, run:

```sh
node tools/print-agent/agent.mjs /protected/path/akihq-printer.local.json --acknowledge-uncertain TICKET_ID
```

This clears only the local journal; it does not resend the original. After an unclean exit, remove the adjacent `.lock` only after confirming no other agent is running and inspecting the pending job. Then restart normally. Keep the configuration, journal and lock on persistent storage. Do not run multiple copies of the same pairing on different computers.

## Required physical acceptance

Record printer model/firmware, connection, OS, Node version, roll width and tester/date. Test kitchen/bar/receipt routing, long notes and quantities, Spanish text transliteration, retained previous/current preparation revisions, copies and relocation tickets. Test two staff phones concurrently, paper-out, power loss, cable/Wi-Fi loss before and after output, service restart, expired/revoked pairing, permission removal and a lost acknowledgement. Confirm uncertain jobs do not print twice and the recovery procedure works. Verify receipt margins/cutter and QR/fiscal documents separately when that integration is ready.

Automated tests run an actual TCP loopback **emulator**, plus pairing authorization and crash/replay scenarios. They cannot establish physical hardware compatibility or phone usability.
