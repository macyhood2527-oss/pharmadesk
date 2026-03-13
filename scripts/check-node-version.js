#!/usr/bin/env node

const major = Number.parseInt(process.versions.node.split('.')[0], 10);

if (!Number.isInteger(major)) {
  console.error('Could not detect the installed Node.js version.');
  console.error('Please install Node.js 22 LTS, then try again.');
  process.exit(1);
}

if (major < 18) {
  console.error(`Node.js ${process.versions.node} is too old for PharmaDesk.`);
  console.error('Install Node.js 22 LTS, then try again.');
  process.exit(1);
}

if (major >= 24) {
  console.error(`Node.js ${process.versions.node} is not supported for PharmaDesk setup yet.`);
  console.error('Use Node.js 18, 20, or 22 LTS.');
  console.error('Node.js 22 LTS is recommended.');
  console.error('Reason: better-sqlite3 may require a native build on newer Node.js versions.');
  process.exit(1);
}

console.log(`Node.js ${process.versions.node} detected. Continuing setup.`);
