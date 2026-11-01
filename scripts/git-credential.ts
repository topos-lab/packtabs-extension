import { execSync } from 'node:child_process';

const action = process.argv[2];

if (action === 'get') {
  try {
    const token = execSync('gh auth token --user wesley-chen', { encoding: 'utf-8' }).trim();
    if (token) {
      console.log(`username=wesley-chen\npassword=${token}`);
    }
  } catch {
    // Fallback silently if gh fails
  }
}
