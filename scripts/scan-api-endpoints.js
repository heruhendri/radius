#!/usr/bin/env node

/**
 * API Endpoint Scanner & Test Generator
 * 
 * Scans all API routes and generates comprehensive test documentation
 * 
 * Usage: node scripts/scan-api-endpoints.js
 */

const fs = require('fs');
const path = require('path');

const API_DIR = path.join(__dirname, '../src/app/api');
const OUTPUT_FILE = path.join(__dirname, '../API_ENDPOINTS.md');

const endpoints = [];

function scanDirectory(dir, basePath = '') {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      scanDirectory(fullPath, path.join(basePath, file));
    } else if (file === 'route.ts') {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const methods = extractMethods(content);
      const route = basePath.replace(/\\/g, '/');
      
      endpoints.push({
        path: `/api/${route}`,
        methods,
        file: fullPath.replace(/\\/g, '/'),
        requiresAuth: content.includes('getServerSession') || content.includes('auth'),
      });
    }
  });
}

function extractMethods(content) {
  const methods = [];
  const methodRegex = /export\s+async\s+function\s+(GET|POST|PUT|DELETE|PATCH)/g;
  let match;
  
  while ((match = methodRegex.exec(content)) !== null) {
    methods.push(match[1]);
  }
  
  return methods;
}

function generateMarkdown() {
  let md = '# API Endpoints Reference\n\n';
  md += `**Total Endpoints:** ${endpoints.length}\n`;
  md += `**Generated:** ${new Date().toISOString()}\n\n`;
  md += '---\n\n';
  
  // Group by category
  const categories = {};
  
  endpoints.forEach(endpoint => {
    const category = endpoint.path.split('/')[2] || 'root';
    if (!categories[category]) {
      categories[category] = [];
    }
    categories[category].push(endpoint);
  });
  
  // Generate table of contents
  md += '## Table of Contents\n\n';
  Object.keys(categories).sort().forEach(category => {
    md += `- [${category.toUpperCase()}](#${category})\n`;
  });
  md += '\n---\n\n';
  
  // Generate endpoints by category
  Object.keys(categories).sort().forEach(category => {
    md += `## ${category.toUpperCase()}\n\n`;
    
    categories[category].forEach(endpoint => {
      md += `### \`${endpoint.path}\`\n\n`;
      md += `**Methods:** ${endpoint.methods.join(', ')}\n\n`;
      md += `**Auth Required:** ${endpoint.requiresAuth ? '✅ Yes' : '❌ No'}\n\n`;
      md += `**File:** \`${endpoint.file.replace(__dirname + '/../', '')}\`\n\n`;
      
      // Test example
      md += '**Test Example:**\n```bash\n';
      endpoint.methods.forEach(method => {
        if (method === 'GET') {
          md += `curl -X ${method} http://localhost:3000${endpoint.path}\n`;
        } else {
          md += `curl -X ${method} http://localhost:3000${endpoint.path} \\\n`;
          md += `  -H "Content-Type: application/json" \\\n`;
          md += `  -d '{}'\n`;
        }
      });
      md += '```\n\n';
      md += '---\n\n';
    });
  });
  
  // Statistics
  md += '## Statistics\n\n';
  md += `| Metric | Count |\n`;
  md += `|--------|-------|\n`;
  md += `| Total Endpoints | ${endpoints.length} |\n`;
  md += `| GET Methods | ${endpoints.filter(e => e.methods.includes('GET')).length} |\n`;
  md += `| POST Methods | ${endpoints.filter(e => e.methods.includes('POST')).length} |\n`;
  md += `| PUT Methods | ${endpoints.filter(e => e.methods.includes('PUT')).length} |\n`;
  md += `| DELETE Methods | ${endpoints.filter(e => e.methods.includes('DELETE')).length} |\n`;
  md += `| Requires Auth | ${endpoints.filter(e => e.requiresAuth).length} |\n`;
  md += `| Public Access | ${endpoints.filter(e => !e.requiresAuth).length} |\n`;
  
  return md;
}

// Scan and generate
console.log('🔍 Scanning API endpoints...');
scanDirectory(API_DIR);

console.log(`✅ Found ${endpoints.length} endpoints`);

const markdown = generateMarkdown();
fs.writeFileSync(OUTPUT_FILE, markdown);

console.log(`📄 Documentation written to: ${OUTPUT_FILE}`);
console.log('\n📊 Summary:');
console.log(`   - Total endpoints: ${endpoints.length}`);
console.log(`   - Authenticated: ${endpoints.filter(e => e.requiresAuth).length}`);
console.log(`   - Public: ${endpoints.filter(e => !e.requiresAuth).length}`);
