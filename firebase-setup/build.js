#!/usr/bin/env node

/**
 * Secure Build Script for Firebase Configuration
 * 
 * This script replaces environment variables in HTML files with actual values
 * from .env file, ensuring sensitive config is never committed to git.
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

console.log('🔧 Building secure Firebase configuration...');

// Check if .env file exists
if (!fs.existsSync('.env')) {
  console.error('❌ .env file not found!');
  console.log('📝 Please copy .env.example to .env and fill in your values:');
  console.log('   cp .env.example .env');
  process.exit(1);
}

// Required environment variables
const requiredEnvVars = [
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN', 
  'FIREBASE_PROJECT_ID',
  'FIREBASE_STORAGE_BUCKET',
  'FIREBASE_MESSAGING_SENDER_ID',
  'FIREBASE_APP_ID',
  'STRIPE_PUBLISHABLE_KEY',
  'FIREBASE_FUNCTIONS_URL'
];

// Check all required variables are present
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach(varName => console.error(`   - ${varName}`));
  console.log('📝 Please add these to your .env file');
  process.exit(1);
}

// Read the template HTML file
const templatePath = path.join(__dirname, 'public', 'index.template.html');
const outputPath = path.join(__dirname, 'public', 'index.html');

if (!fs.existsSync(templatePath)) {
  console.error('❌ Template file not found: public/index.template.html');
  console.log('📝 Please run this script from the firebase-setup directory');
  process.exit(1);
}

let htmlContent = fs.readFileSync(templatePath, 'utf8');

// Replace environment variables in the HTML
const replacements = {
  '{{FIREBASE_API_KEY}}': process.env.FIREBASE_API_KEY,
  '{{FIREBASE_AUTH_DOMAIN}}': process.env.FIREBASE_AUTH_DOMAIN,
  '{{FIREBASE_PROJECT_ID}}': process.env.FIREBASE_PROJECT_ID,
  '{{FIREBASE_STORAGE_BUCKET}}': process.env.FIREBASE_STORAGE_BUCKET,
  '{{FIREBASE_MESSAGING_SENDER_ID}}': process.env.FIREBASE_MESSAGING_SENDER_ID,
  '{{FIREBASE_APP_ID}}': process.env.FIREBASE_APP_ID,
  '{{STRIPE_PUBLISHABLE_KEY}}': process.env.STRIPE_PUBLISHABLE_KEY,
  '{{FIREBASE_FUNCTIONS_URL}}': process.env.FIREBASE_FUNCTIONS_URL,
  '{{NODE_ENV}}': process.env.NODE_ENV || 'production'
};

// Perform replacements
Object.entries(replacements).forEach(([placeholder, value]) => {
  htmlContent = htmlContent.replace(new RegExp(placeholder, 'g'), value);
});

// Write the output file
fs.writeFileSync(outputPath, htmlContent);

console.log('✅ Build complete!');
console.log(`📄 Generated: ${outputPath}`);
console.log('🔒 Firebase configuration securely injected');
console.log('');
console.log('🚀 Your app is ready to deploy with secure configuration!');

// Security reminder
console.log('');
console.log('🛡️  SECURITY REMINDER:');
console.log('   - .env file is gitignored (never committed)');
console.log('   - Only built index.html should be deployed');
console.log('   - Template file contains no sensitive data');
console.log('   - Consider restricting Firebase API key to your domain');