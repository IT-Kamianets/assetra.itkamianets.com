/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: 'com.itkamianets.assetra',
  productName: 'Assetra',
  directories: {
    output: 'dist',
    buildResources: 'assets',
  },
  files: [
    'build/**/*',
    'app/**/*',
    'generated/**/*',
    // `assets` is also the electron-builder `buildResources` directory, whose
    // contents are NOT packaged by default. Include it explicitly so the
    // splash screen (and any other runtime assets) ship in the app.
    'assets/**/*',
    'package.json',
    // Platform runtime + plugins, prepared by `capacitor-electron vendor`.
    { from: 'vendor/node_modules', to: 'node_modules' },
  ],
  // Installers: one per desktop OS. Build each on its own OS (see .github/workflows/electron.yml).
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    artifactName: '${productName}-Setup.${ext}',
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
  },
  linux: {
    target: ['AppImage', 'deb'],
    category: 'Office',
    maintainer: 'IT Kamianets <info@itkamianets.com>',
    artifactName: '${productName}.${ext}',
  },
  mac: {
    target: [
      { target: 'dmg', arch: ['x64', 'arm64'] },
      { target: 'zip', arch: ['x64', 'arm64'] }, // required by the auto-updater
    ],
    category: 'public.app-category.business',
    // Notarize only when the fastlane Mac runner provides the App Store Connect API key.
    notarize: Boolean(process.env.APPLE_API_KEY),
    artifactName: '${productName}-${arch}.${ext}',
  },
  // Auto-update source: latest.yml files are uploaded to the GitHub release.
  publish: [
    {
      provider: 'github',
      owner: 'IT-Kamianets',
      repo: 'assetra.itkamianets.com',
      releaseType: 'release',
    },
  ],
};
