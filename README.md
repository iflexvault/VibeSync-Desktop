<p align="center">
  <img src="https://raw.githubusercontent.com/iflexvault/VibeSync/main/assets/ic_launcher-playstore.png" width="180" alt="VibeSync logo" />
</p>

<h1 align="center">VibeSync Desktop</h1>

<div align="center">

### Connected music for Windows, macOS and Linux

**VibeSync brings the latest Android VibeSync experience to desktop.**

[![Latest Release](https://img.shields.io/github/v/release/iflexvault/VibeSync-Desktop?style=for-the-badge&logo=github&color=0D1117&labelColor=161B22)](https://github.com/iflexvault/VibeSync-Desktop/releases)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-5865F2.svg?style=for-the-badge&logo=electron&logoColor=white&labelColor=161B22)](https://github.com/iflexvault/VibeSync)

</div>

---

## Features

- YouTube Music integration with search, playback, queue management and lyrics.
- Cloud backup and cross-device synchronization with the VibeSync Android app.
- Listen Together sessions for synchronized playback.
- Live lyrics, playback statistics, customizable appearance and Dynamic Island mini-player.
- Windows installer and portable executable, plus macOS and Linux packages.

## Desktop identity

| Field | Value |
| --- | --- |
| Product | **VibeSync** |
| Publisher / developer | **iFlexVault** |
| Application ID | `pro.iflexvault.vibesync.desktop` |
| Initial version | `1.0.0` |
| Initial build number | `1` |
| Windows architecture | x64 |
| Installer | `VibeSync-Setup-1.0.0.exe` |
| Portable | `VibeSync-1.0.0-portable.exe` |
| GitHub | https://github.com/iflexvault |
| Google Developer Profile | https://g.dev/iflexvault |

The installer creates Start Menu and Desktop shortcuts, supports changing the
installation directory, and preserves user data during upgrades and uninstall.

## Download

Windows packages are attached to the matching VibeSync Desktop GitHub release:

- [VibeSync Desktop releases](https://github.com/iflexvault/VibeSync-Desktop/releases)
- [VibeSync Android repository](https://github.com/iflexvault/VibeSync)

## Build from source

### Requirements

| Requirement | Version |
| --- | --- |
| Node.js | 22+ |
| Python | 3.13 |
| Git | Latest |

```bash
git clone https://github.com/iflexvault/VibeSync-Desktop.git
cd VibeSync

python -m venv venv
# Windows PowerShell
venv\Scripts\Activate.ps1
# Windows cmd: venv\Scripts\activate.bat

pip install -r requirements.txt
cd electron-app
npm ci
npm start
```

## Windows release build

The final Windows icon must come from the exact approved VibeSync logo. The
original supplied logo is not currently present in this checkout, so the build
intentionally refuses to package until the source PNG is supplied.

1. Place the approved transparent logo at `electron-app/build/vibesync-icon-source.png`.
2. Run `npm run generate:icon`.
3. Run `npm run validate:metadata` and `npm run validate:branding`.
4. Run `npm run build` on Windows.

The generated icon contains 16, 24, 32, 48, 64, 128 and 256 px layers with
transparent padding. The release workflow builds x64 NSIS and portable assets
and publishes them using the repository `GITHUB_TOKEN`; no personal access
token is required.

## Developer

**iFlexVault**

- [GitHub](https://github.com/iflexvault)
- [Google Developer Profile](https://g.dev/iflexvault)
- [VibeSync Desktop source and releases](https://github.com/iflexvault/VibeSync-Desktop)

The current developer avatar is loaded from:
`https://github.com/iflexvault.png?size=512`.

## License

This project is licensed under the GNU General Public License v3.0. See the
project license for details.
