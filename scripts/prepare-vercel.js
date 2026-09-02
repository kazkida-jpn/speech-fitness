const fs = require('fs');
const path = require('path');

const serverDir = path.join(process.cwd(), 'dist', 'server');
const clientDir = path.join(process.cwd(), 'dist', 'client');

for (const name of ['index.html', 'check.html', 'drills.html', 'history.html', '+not-found.html']) {
  fs.copyFileSync(path.join(serverDir, name), path.join(clientDir, name));
}
