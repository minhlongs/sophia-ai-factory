const fs = require('fs');
const path = require('path');

const apiDir = '/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api';

function findRouteFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(findRouteFiles(filePath));
    } else if (file === 'route.ts' || file === 'route.tsx') {
      results.push(filePath);
    }
  });
  return results;
}

const files = findRouteFiles(apiDir);
console.log(`Found ${files.length} route files.`);

const validated = [];
const unvalidated = [];

files.forEach((file) => {
  const content = fs.readFileSync(file, 'utf8');
  const relativePath = path.relative(apiDir, file);
  
  // Check for presence of Zod validation
  const hasZod = content.includes('zod') || content.includes('z.') || content.includes('Schema');
  const hasParse = content.includes('safeParse') || content.includes('.parse(');
  
  // Simple heuristics to check if the file accepts/expects a request body/query and validates it
  const isGetOnlyNoParams = !content.includes('request') && !content.includes('NextRequest') && content.includes('GET');
  
  if (hasZod && hasParse) {
    validated.push(relativePath);
  } else {
    unvalidated.push({
      path: relativePath,
      hasZod,
      hasParse,
      get: content.includes('GET'),
      post: content.includes('POST'),
      put: content.includes('PUT'),
      patch: content.includes('PATCH'),
      delete: content.includes('DELETE')
    });
  }
});

console.log('\n--- VALIDATED ROUTES ---');
console.log(JSON.stringify(validated, null, 2));

console.log('\n--- UNVALIDATED ROUTES ---');
console.log(JSON.stringify(unvalidated, null, 2));
