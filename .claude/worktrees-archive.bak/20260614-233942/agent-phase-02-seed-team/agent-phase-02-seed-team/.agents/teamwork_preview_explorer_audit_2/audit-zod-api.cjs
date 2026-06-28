const fs = require('fs');
const path = require('path');

const apiDir = '/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api';
const outputDir = '/Users/macbook/projects/sophia-ai-factory/.agents/teamwork_preview_explorer_audit_2';

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

const validated = [];
const unvalidated = [];

files.forEach((file) => {
  const content = fs.readFileSync(file, 'utf8');
  const relativePath = path.relative(apiDir, file);
  
  // Check for presence of Zod validation
  const hasZod = content.includes('zod') || content.includes('z.') || content.includes('Schema');
  const hasParse = content.includes('safeParse') || content.includes('.parse(') || content.includes('.parseAsync(') || content.includes('safeParseAsync');
  
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

const report = {
  totalCount: files.length,
  validatedCount: validated.length,
  unvalidatedCount: unvalidated.length,
  validated,
  unvalidated
};

fs.writeFileSync(path.join(outputDir, 'zod-audit-results.json'), JSON.stringify(report, null, 2));
console.log(`Audited ${files.length} files. Validated: ${validated.length}, Unvalidated: ${unvalidated.length}. Report written.`);
