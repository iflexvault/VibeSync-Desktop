# VibeSync Windows branding asset

The exact approved VibeSync logo must be supplied before a Windows release.
Do not reuse `../icon.png` or another approximate/generated logo as the final
Windows icon.

When the exact approved transparent PNG is available:

1. Save it as `vibesync-icon-source.png` in this directory.
2. Run `npm run generate:icon` from `electron-app/`.
3. Run `npm run validate:branding`.
4. Review the resulting `vibesync.ico` at Windows shell sizes before release.

The generated ICO must contain 16, 24, 32, 48, 64, 128 and 256 px layers.
