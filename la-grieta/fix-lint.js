const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Define patterns to fix
const fixes = [
  // Fix selector prefixes
  {
    pattern: /selector:\s*['"]lg-([^'"]+)['"]/g,
    replacement: 'selector: \'app-$1\''
  },
  // Fix template references
  {
    pattern: /<lg-([a-z-]+)/g,
    replacement: '<app-$1'
  },
  {
    pattern: /<\/lg-([a-z-]+)>/g,
    replacement: '</app-$1>'
  }
];

// Get all TypeScript and HTML files in web/src/app
const files = glob.sync('web/src/app/**/*.{ts,html}', { cwd: process.cwd() });

console.log(`Found ${files.length} files to process`);

let filesModified = 0;

files.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  fixes.forEach(fix => {
    const newContent = content.replace(fix.pattern, fix.replacement);
    if (newContent !== content) {
      content = newContent;
      modified = true;
    }
  });

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    filesModified++;
    console.log(`Fixed: ${file}`);
  }
});

console.log(`\nModified ${filesModified} files`);
