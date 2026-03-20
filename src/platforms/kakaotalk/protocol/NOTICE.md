# Third-Party Notices

This LOCO protocol implementation was written from scratch for agent-messenger.
The protocol knowledge used to build it comes from the following open-source
projects and their documentation. No code was copied from these projects.

---

## node-kakao

- Repository: https://github.com/storycraft/node-kakao
- License: MIT
- Copyright (c) 2020 storycraft

Used as a protocol reference for: LOCO packet format, BSON command schemas,
authentication flow, X-VC signature algorithm, channel/chat type enumerations.

---

## openkakao

- Repository: https://github.com/JungHoonGhae/openkakao
- License: MIT
- Copyright (c) 2025 JungHoonGhae

Used as the primary protocol documentation source (openkakao.vercel.app) for:
current encryption parameters (AES-128-GCM, key_encrypt_type=16, encrypt_type=3),
connection flow (Booking → Checkin → Login), packet structure, LOCO command reference,
and macOS credential extraction approach.

---

## KiwiTalk

- Repository: https://github.com/KiwiTalk/KiwiTalk
- License: Apache-2.0
- Copyright (c) 2020 storycraft

Used as a protocol reference for: async LOCO session architecture,
`futures-loco-protocol` crate structure, Booking/Checkin flow patterns.

---

## loco-protocol-kotlin

- Repository: https://github.com/yushosei/loco-protocol-kotlin
- License: MIT
- Copyright (c) yushosei

Used as a protocol reference for: dual encryption profiles (CFB/GCM),
Windows credential extraction paths, REST API server patterns.

---

## Original LOCO Protocol Research

- Author: Cai (bpak.org)
- URL: http://www.bpak.org/blog/tag/loco/
- Date: 2012-2013

The foundational reverse engineering of the LOCO protocol that all subsequent
implementations are based on.
