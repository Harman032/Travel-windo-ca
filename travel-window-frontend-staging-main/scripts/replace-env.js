#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const targetEnv = (process.env.NG_BUILD_ENV || 'production').toLowerCase();
const envFileName = targetEnv === 'staging' ? 'environment.staging.ts' : 'environment.prod.ts';
const envFile = path.join(__dirname, `../src/environments/${envFileName}`);

// Read environment variables (Vercel pe set karein: NG_APP_API_URL)
// Priority: NG_APP_API_URL > API_URL > default
let apiUrl = process.env.NG_APP_API_URL || process.env.API_URL || (
  targetEnv === 'staging'
    ? 'https://travel-window-backend-staging.vercel.app/api'
    : 'https://travel-windo-ca-s5b9.vercel.app/api'
);

// Ensure https:// prefix is present
if (apiUrl && !apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
  apiUrl = 'https://' + apiUrl;
}
apiUrl = (apiUrl || '').replace(/\/+$/, '');

if (targetEnv === 'staging' && /travel-window-backend\.vercel\.app/i.test(apiUrl)) {
  console.error('❌ Staging build blocked: API URL points to production backend.');
  console.error(`   Received NG_APP_API_URL/API_URL: ${apiUrl}`);
  process.exit(1);
}

const recaptchaSiteKey = process.env.NG_APP_RECAPTCHA_SITE_KEY || process.env.RECAPTCHA_SITE_KEY || '';

// Read the file
let content = fs.readFileSync(envFile, 'utf8');

// Replace apiUrl (handle both single and double quotes, and template literals)
content = content.replace(
  /apiUrl:\s*['"`].*?['"`]/,
  `apiUrl: '${apiUrl}'`
);

// Replace recaptchaSiteKey
content = content.replace(
  /recaptchaSiteKey:\s*['"`].*?['"`]/,
  `recaptchaSiteKey: '${recaptchaSiteKey}'`
);

// Write back
fs.writeFileSync(envFile, content, 'utf8');

console.log('✅ Environment variables replaced:');
console.log(`   Target env file: ${envFileName}`);
console.log(`   API URL: ${apiUrl}`);
console.log(`   reCAPTCHA Site Key: ${recaptchaSiteKey || '(empty)'}`);
