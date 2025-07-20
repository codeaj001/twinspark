#!/usr/bin/env node

// Build script to inject environment variables into HTML files
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const envVars = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    APP_ENV: process.env.APP_ENV || 'development',
    APP_URL: process.env.APP_URL || 'http://localhost:3000'
};

// Generate meta tags for environment variables
function generateEnvMetaTags() {
    return Object.entries(envVars)
        .map(([key, value]) => `    <meta name="env-${key.toLowerCase()}" content="${value || ''}">`)
        .join('\n');
}

// HTML files to process
const htmlFiles = [
    'index.html',
    'auth.html',
    'profile.html',
    'match.html',
    'chat.html',
    'reveal.html',
    'generate-post.html'
];

// Process each HTML file
htmlFiles.forEach(filename => {
    const filePath = path.join(__dirname, filename);
    
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Remove existing env meta tags
        content = content.replace(/\s*<meta name="env-[^"]*" content="[^"]*">\n?/g, '');
        
        // Add new env meta tags after the title tag
        const titleTagIndex = content.indexOf('</title>');
        if (titleTagIndex !== -1) {
            const insertPosition = titleTagIndex + '</title>'.length;
            const metaTags = '\n' + generateEnvMetaTags();
            content = content.slice(0, insertPosition) + metaTags + content.slice(insertPosition);
        }
        
        fs.writeFileSync(filePath, content);
        console.log(`✓ Processed ${filename}`);
    } else {
        console.log(`⚠ File not found: ${filename}`);
    }
});

console.log('\nBuild complete! Environment variables injected into HTML files.');
console.log('\nNext steps:');
console.log('1. Update your .env file with actual values');
console.log('2. Run: node build.js');
console.log('3. Start your development server');
