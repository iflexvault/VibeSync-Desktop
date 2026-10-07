# VibeSync Windows branding asset

The exact approved VibeSync launcher logo is stored as
`vibesync-icon-source.png`. Do not reuse `../icon.png` or another
approximate/generated logo as the final Windows icon.

To regenerate the Windows icon:

1. Verify `vibesync-icon-source.png` is the approved transparent logo.
2. Run `npm run generate:icon` from `electron-app/`.
3. Run `npm run validate:branding`.
4. Review the resulting `vibesync.ico` at Windows shell sizes before release.

The generated ICO must contain 16, 24, 32, 48, 64, 128 and 256 px layers.
