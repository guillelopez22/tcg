const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Get all TypeScript files in web/src/app/features
const files = glob.sync('web/src/app/features/**/*.component.ts', { cwd: process.cwd() });

console.log(`Found ${files.length} component files to process`);

let filesModified = 0;

files.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Check if file has constructor injection
  const constructorMatch = content.match(/constructor\s*\(([\s\S]*?)\)\s*{/);

  if (!constructorMatch) return;

  const constructorParams = constructorMatch[1];

  // Skip if constructor is empty or already uses inject
  if (!constructorParams.trim() || constructorParams.includes('{}')) return;

  // Parse constructor parameters
  const params = [];
  const paramRegex = /(private|public|protected)?\s*(\w+)\s*:\s*([^,)]+)/g;
  let match;

  while ((match = paramRegex.exec(constructorParams)) !== null) {
    const [, visibility, name, type] = match;
    if (name && type) {
      params.push({
        visibility: visibility || 'private',
        name: name.trim(),
        type: type.trim()
      });
    }
  }

  if (params.length === 0) return;

  // Add inject import if not present
  const importMatch = content.match(/import\s*{([^}]+)}\s*from\s*['"]@angular\/core['"]/);
  if (importMatch) {
    const imports = importMatch[1];
    if (!imports.includes('inject')) {
      content = content.replace(
        /import\s*{([^}]+)}\s*from\s*['"]@angular\/core['"]/,
        'import { $1, inject } from \'@angular/core\''
      );
    }
  }

  // Find the class declaration
  const classMatch = content.match(/(export class \w+[^\{]*\{)/);
  if (!classMatch) return;

  const classDeclaration = classMatch[1];

  // Generate inject() statements
  const injectStatements = params.map(param =>
    `  ${param.visibility} ${param.name} = inject(${param.type});`
  ).join('\n');

  // Replace constructor with inject() calls
  content = content.replace(
    classDeclaration,
    classDeclaration + '\n' + injectStatements
  );

  // Remove old constructor
  content = content.replace(/constructor\s*\([\s\S]*?\)\s*\{\s*\}/g, '');

  fs.writeFileSync(filePath, content, 'utf8');
  filesModified++;
  console.log(`Fixed: ${file}`);
});

console.log(`\nModified ${filesModified} files`);
