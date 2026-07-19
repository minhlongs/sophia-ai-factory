#!/usr/bin/env -S tsx --tsconfig apps/sophia-ai-factory/tsconfig.json --skip-project
/**
 * AST-based script to apply rate limiting to all unprotected API routes.
 * Uses TypeScript compiler API for correct syntax handling.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

function hasWithRateLimitImport(content: string): boolean {
  return /import\s*{\s*withRateLimit\s*}\s*from\s*['"][^'"]*rate-limit-wrapper['"]/.test(content);
}

function insertImport(content: string, importStmt: string): string {
  const licenseMatch = content.match(/^(\/\*\*[\s\S]*?\*\/\s*)/);
  if (licenseMatch) {
    return licenseMatch[1] + importStmt + '\n' + content.slice(licenseMatch[1].length);
  }
  return importStmt + '\n' + content;
}

function createTransformer(importAdded: boolean) {
  const importStmt = "import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper'";

  const visitor: ts.Visitor = (node) => {
    // If import already exists, skip
    if (importAdded) return ts.visitEachChild(node, visitor);

    // Look for ExportDeclaration with FunctionDeclaration (async)
    if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
      const elements = node.exportClause.elements;
      const newElements: ts.NamedExportElement[] = [];

      for (const el of elements) {
        const name = el.name.getText();
        // Check if it's an async function declaration
        if (el.name && ts.isIdentifier(el.name) && el.name.parent) {
          const parent = el.name.parent;
          if (ts.isFunctionDeclaration(parent) && parent.asteriskToken === undefined && parent.body && parent.modifiers) {
            // Check if it's async
            const isAsync = parent.modifiers.some(m => m.kind === ts.SyntaxKind.AsyncKeyword);
            if (isAsync && !hasWithRateLimitImport(importStmt)) {
              // Transform: create variable declaration
              // export async function NAME(...) { body }
              // => export const NAME = withRateLimit(async function NAME(...) { body });

              const functionName = parent.name!;
              const parameters = parent.parameters;
              const typeParameters = parent.typeParameters;
              const returnType = parent.type;
              const body = parent.body;

              // Build: async function NAME(...) { body }
              const asyncFunctionExpr = ts.createFunctionExpression(
                parent.modifiers,
                typeParameters,
                functionName,
                parameters,
                returnType,
                body
              );
              // withRateLimit(async function NAME(...) { body })
              const callExpr = ts.createCall(ts.createIdentifier('withRateLimit'), undefined, [asyncFunctionExpr]);
              // const NAME = ...
              const varDecl = ts.createVariableDeclaration(
                functionName,
                undefined,
                callExpr
              );
              // export const NAME = ...
              const varStmt = ts.createVariableStatement(
                [ts.createToken(ts.SyntaxKind.ExportKeyword), ts.createToken(ts.SyntaxKind.ConstKeyword)],
                ts.createVariableDeclarationList([varDecl], ts.NodeFlags.None)
              );

              // Replace the named export element with a dummy (we'll add varStmt as separate statement)
              // Actually we cannot easily replace a named export element with a different statement shape.
              // Simpler: we modify the source by replacing the function declaration node entirely in the AST.
              // But the export clause is just a list; we need to emit a variable statement instead.
              // Instead, we can transform the whole source by visiting the SourceFile's statements.
              // That's easier: we iterate over SourceFile.statements and replace matching ones.
            }
          }
        }
        // Keep original if not transformed
        newElements.push(el);
      }
    }

    return ts.visitEachChild(node, visitor);
  };

  return (sourceFile: ts.SourceFile) => ts.visitNode(sourceFile, visitor);
}

function processFile(filePath: string, write: boolean = true): boolean {
  const content = fs.readFileSync(filePath, 'utf-8');

  if (hasWithRateLimitImport(content)) {
    return false;
  }

  const lang = ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, lang);

  let modified = false;
  const importStmt = "import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper'";

  // We'll manually construct new statements
  const newStatements: ts.Node[] = [];
  let importInserted = false;

  function processNode(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.asteriskToken === undefined && node.body && node.name) {
      // Check if it's async and exported (via modifier)
      const isAsync = node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword);
      const isExported = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);

      if (isAsync && isExported && !hasWithRateLimitImport(content)) {
        modified = true;
        // Build: export const NAME = withRateLimit(async function NAME(...) { body })
        // Create identifier for function name
        const functionName = node.name;
        // async function expression
        const asyncFunc = ts.createFunctionExpression(
          undefined, // modifiers (none for function expression)
          node.typeParameters,
          functionName,
          node.parameters,
          node.type,
          node.body
        );
        asyncFunc.modifiers = [ts.createModifier(ts.SyntaxKind.AsyncKeyword)];

        // withRateLimit(asyncFunc)
        const call = ts.createCall(ts.createIdentifier('withRateLimit'), undefined, [asyncFunc]);

        // const NAME = call;
        const varDecl = ts.createVariableDeclaration(functionName, undefined, call);
        const varDeclList = ts.createVariableDeclarationList([varDecl], ts.NodeFlags.None);
        const varStmt = ts.createVariableStatement(
          [ts.createToken(ts.SyntaxKind.ExportKeyword), ts.createToken(ts.SyntaxKind.ConstKeyword)],
          varDeclList
        );

        // Insert import if not yet
        if (!importInserted) {
          const importNode = ts.createImportDeclaration(
            undefined,
            undefined,
            ts.createImportClause(false, undefined, ts.createNamedImports([
              ts.createImportSpecifier(false, undefined, ts.createIdentifier('withRateLimit'))
            ])),
            ts.createStringLiteral('@/forest/middleware/rate-limit-wrapper')
          );
          newStatements.push(importNode);
          importInserted = true;
        }

        newStatements.push(varStmt);
        return; // skip adding original node
      }
    }

    // For other nodes, keep them
    newStatements.push(node);
  }

  // Traverse top-level statements
  for (const stmt of sourceFile.statements) {
    ts.forEachChild(stmt, processNode);
  }

  if (!modified) {
    return false;
  }

  // Print new source
  const result = ts.transformationContext({});
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const newSourceFile = ts.updateSourceFileNode(sourceFile, newStatements, sourceFile.isDeclarationFile, sourceFile.referencedFiles);
  const printed = printer.printFile(newSourceFile);

  if (write) {
    const backupDir = path.join(projectRoot, 'backup-routes-rate-limit-ast');
    const rel = path.relative(projectRoot, filePath);
    const backupPath = path.join(backupDir, rel);
    fs.mkdirSync(path.dirname(backupPath), { recursive: true });
    fs.writeFileSync(backupPath, content, 'utf-8');
    fs.writeFileSync(filePath, printed, 'utf-8');
    console.log(`Modified: ${rel}`);
  }

  return true;
}

function collectFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(full));
    } else if (entry.name === 'route.ts' || entry.name.endsWith('-handler.ts')) {
      files.push(full);
    }
  }
  return files;
}

function main() {
  const apiDir = path.join(projectRoot, 'src', 'app', 'api');
  const files = collectFiles(apiDir);
  console.log(`Processing ${files.length} files`);

  let modified = 0, skipped = 0;
  for (const f of files) {
    try {
      if (processFile(f)) modified++;
      else skipped++;
    } catch (e) {
      console.error(`Error processing ${f}: ${e}`);
    }
  }

  console.log(`Done: ${modified} modified, ${skipped} skipped`);
}

main();
