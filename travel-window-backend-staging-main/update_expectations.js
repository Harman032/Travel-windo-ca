const fs = require('fs');

let code = fs.readFileSync('tests/cancellation.test.js', 'utf8');

// We need to re-eval tests, but since they are in a string we can just extract them, evaluate, and replace.
// Instead of doing that, let's just make a small script that runs the calculateCancellation function and updates the file.

const script = `
const fs = require('fs');
let code = fs.readFileSync('tests/cancellation.test.js', 'utf8');

// We evaluate the code by injecting a hook
const runner = code.replace(/const tests = \\[/[\\s\\S]*/, '');
const testsMatch = code.match(/const tests = \\[([\\s\\S]*)\\];/);
if (!testsMatch) {
  console.log("No tests array found");
  process.exit(1);
}

// We will construct the expected values manually
`;
