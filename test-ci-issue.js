#!/usr/bin/env node

// Test script to debug CI issue
console.log('Node version:', process.version);
console.log('Platform:', process.platform);
console.log('Architecture:', process.arch);
console.log('Environment:', process.env.CI ? 'CI' : 'Local');

// Simple timeout test
console.log('Starting timeout test...');
const start = Date.now();

setTimeout(() => {
  const elapsed = Date.now() - start;
  console.log(`Timeout completed after ${elapsed}ms`);
  process.exit(0);
}, 1000);

// Keep process alive
setInterval(() => {
  const elapsed = Date.now() - start;
  if (elapsed > 5000) {
    console.error('Test stuck for more than 5 seconds!');
    process.exit(1);
  }
}, 500);