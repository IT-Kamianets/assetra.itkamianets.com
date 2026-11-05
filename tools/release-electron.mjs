// Local release: builds the web app, packages the Electron installer for THIS OS
// and uploads it plus latest*.yml to the GitHub release for the given version.
// Usage: npm run electron:release -- 1.0.1
import { execSync } from 'node:child_process';

const version = process.argv[2]?.replace(/^v/, '');
if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) {
	console.error('Usage: npm run electron:release -- <major.minor.patch>');
	process.exit(1);
}

const run = (cmd, env = {}) =>
	execSync(cmd, { stdio: 'inherit', env: { ...process.env, ...env } });

// Uses the account you logged in with `gh auth login`.
const token = execSync('gh auth token').toString().trim();

run(`npm --prefix electron version ${version} --no-git-tag-version --allow-same-version`);
run('npm run build');
run('npm run electron:sync');
// electron-builder creates the release (tag v<version>) if missing, or adds files to it.
run('npm --prefix electron run pack -- --publish always', { GH_TOKEN: token });
console.log(`\nReleased v${version}. Commit electron/package.json and push.`);
