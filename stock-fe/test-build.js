const { execSync } = require('child_process');
const path = require('path');

try {
  console.log('Testing Next.js build...');
  execSync('npm run build', {
    cwd: path.join(__dirname, 'stock-fe'),
    stdio: 'inherit'
  });
  console.log('Build successful!');
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
}