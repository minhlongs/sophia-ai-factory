const fs = require('fs');
const path = require('path');

const ROOT_DIR = '/Users/macbook/projects/sophia-ai-factory';
const DOCS_DIR = path.join(ROOT_DIR, 'docs');

const docFiles = [
  'codebase-audit/SUMMARY.md',
  'codebase-audit/STRUCTURAL_MAP.md',
  'codebase-audit/EXECUTION_FLOWS.md',
  'codebase-audit/TECH_DEBT.md',
  'codebase-audit/RISKS_GAPS.md',
  'onboarding.md',
  'setup.md',
  'local-dev.md',
  'troubleshooting.md',
  'testing.md',
  'environment-variables.md',
  'architecture-overview.md'
];

const results = {
  scannedFiles: 0,
  placeholdersFound: [],
  brokenLinks: [],
  validLinksCount: 0
};

docFiles.forEach(relDocPath => {
  const fullDocPath = path.join(DOCS_DIR, relDocPath);
  if (!fs.existsSync(fullDocPath)) {
    console.error(`Document file not found: ${fullDocPath}`);
    results.brokenLinks.push({ doc: relDocPath, target: fullDocPath, error: 'Document itself is missing' });
    return;
  }
  
  results.scannedFiles++;
  const content = fs.readFileSync(fullDocPath, 'utf8');
  
  // Scan for placeholders
  // Placeholders usually look like "TBD", "TODO", "[TBD]", "[TODO]", "[TBD ]", etc.
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    // Exclude markdown checkboxes like [ ] or [x]
    // Exclude occurrences of words that are part of text description unless they are actual placeholders.
    // Let's do a regex search for placeholders.
    const placeholderRegex = /\[\s*(tbd|todo)\s*\]|\b(tbd|todo)\b/i;
    const match = line.match(placeholderRegex);
    if (match) {
      // Check if it's not a false positive
      // We want to make sure it's an actual placeholder, not just "todays" or something.
      // And we also want to ignore general mentions of "todo" in a description of tasks, but standard is no placeholder.
      results.placeholdersFound.push({
        file: relDocPath,
        line: idx + 1,
        content: line.trim()
      });
    }
  });

  // Scan for file:// links
  // Format: [label](file:///Users/macbook/projects/sophia-ai-factory/path)
  const fileLinkRegex = /file:\/\/\/Users\/macbook\/projects\/sophia-ai-factory\/([^\s\)]+)/g;
  let match;
  while ((match = fileLinkRegex.exec(content)) !== null) {
    let targetPath = match[1];
    // Remove trailing brackets or parentheses if captured incorrectly
    targetPath = targetPath.replace(/[\)\]]+$/, '');
    const absoluteTarget = path.join(ROOT_DIR, targetPath);
    if (!fs.existsSync(absoluteTarget)) {
      results.brokenLinks.push({
        doc: relDocPath,
        link: match[0],
        target: absoluteTarget
      });
    } else {
      results.validLinksCount++;
    }
  }
});

console.log(JSON.stringify(results, null, 2));
