const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const expected = {
    name: 'vibesync-desktop',
    productName: 'VibeSync',
    appId: 'pro.iflexvault.vibesync.desktop',
    publisherName: 'iFlexVault',
    nsisArtifact: 'VibeSync-Setup-${version}.${ext}',
    portableArtifact: 'VibeSync-${version}-portable.${ext}'
};

const actual = {
    name: packageJson.name,
    productName: packageJson.build?.productName,
    appId: packageJson.build?.appId,
    publisherName: packageJson.author?.name,
    nsisArtifact: packageJson.build?.nsis?.artifactName,
    portableArtifact: packageJson.build?.portable?.artifactName
};

const mismatches = Object.entries(expected).filter(([key, value]) => actual[key] !== value);
if (mismatches.length) {
    for (const [key, value] of mismatches) {
        console.error(`${key}: expected ${value}, got ${actual[key] ?? '<missing>'}`);
    }
    process.exit(1);
}

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(packageJson.version)) {
    console.error('Desktop version must use semantic versioning, for example 1.0.0.');
    process.exit(1);
}

if (!/^[1-9]\d*$/.test(packageJson.build?.buildNumber ?? '')) {
    console.error('Desktop buildNumber must be a positive integer string.');
    process.exit(1);
}

console.log(`VibeSync desktop metadata is valid: ${packageJson.version}, build ${packageJson.build.buildNumber}.`);
