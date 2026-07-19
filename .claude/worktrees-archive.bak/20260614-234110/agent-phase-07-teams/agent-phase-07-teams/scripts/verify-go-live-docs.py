#!/usr/bin/env python3
import os
import re
import sys
import urllib.parse

WORKSPACE_DIR = "/Users/macbook/projects/sophia-ai-factory"

# 15 Required files in docs/
REQUIRED_DOCS = [
    "docs/README.md",
    "docs/QUICKSTART.md",
    "docs/CONTRIBUTING.md",
    "docs/LOCAL_DEV.md",
    "docs/TESTING.md",
    "docs/TROUBLESHOOTING.md",
    "docs/RELEASE_PROCESS.md",
    "docs/DEPLOYMENT.md",
    "docs/INCIDENT_RESPONSE.md",
    "docs/SECURITY.md",
    "docs/ENVIRONMENT_VARIABLES.md",
    "docs/ARCHITECTURE.md",
    "docs/SYSTEM_DESIGN.md",
    "docs/RUNBOOKS.md",
    "docs/OPERATIONAL_GUIDES.md",
    "README.md",
    "SECURITY.md"
]

PLACEHOLDER_REGEX = re.compile(r'\b(TODO|TBD|placeholder|xxx+)\b', re.IGNORECASE)
LINK_REGEX = re.compile(r'\[([^\]]*)\]\(([^)]+)\)')

def check_placeholders(file_path, content):
    errors = []
    for line_num, line in enumerate(content.splitlines(), 1):
        matches = PLACEHOLDER_REGEX.findall(line)
        if matches:
            # Filter out false positives (e.g. if the word occurs inside code-blocks in a descriptive way,
            # but usually we want to flag everything to be safe)
            errors.append((line_num, line.strip(), matches))
    return errors

def verify_links(file_path, content):
    errors = []
    file_dir = os.path.dirname(os.path.join(WORKSPACE_DIR, file_path))
    links = LINK_REGEX.findall(content)
    
    for text, url in links:
        # Clean url (remove anchor)
        url_clean = url.split('#')[0].strip()
        if not url_clean:
            continue
            
        # Ignore external links or email links
        if url_clean.startswith(('http://', 'https://', 'mailto:')):
            continue
            
        # Handle file:/// schemes
        if url_clean.startswith('file:///'):
            path = url_clean.replace('file://', '')
            # Decode URL characters (like %20)
            path = urllib.parse.unquote(path)
            if not os.path.exists(path):
                errors.append(f"Broken absolute link: {url} (resolved to {path})")
        else:
            # Handle relative links
            path = os.path.join(file_dir, url_clean)
            path = os.path.abspath(path)
            # Decode URL characters
            path = urllib.parse.unquote(path)
            if not os.path.exists(path):
                errors.append(f"Broken relative link: {url} (resolved to {path})")
                
    return errors

def main():
    print("=== Sophia AI Factory Go Live Documentation Verification ===")
    print(f"Workspace directory: {WORKSPACE_DIR}\n")
    
    all_passed = True
    missing_files = []
    
    for rel_path in REQUIRED_DOCS:
        full_path = os.path.join(WORKSPACE_DIR, rel_path)
        print(f"Checking {rel_path}...", end="")
        
        if not os.path.exists(full_path):
            print(" ❌ MISSING")
            missing_files.append(rel_path)
            all_passed = False
            continue
            
        if os.path.getsize(full_path) == 0:
            print(" ❌ EMPTY")
            all_passed = False
            continue
            
        try:
            with open(full_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as e:
            print(f" ❌ ERROR READING: {e}")
            all_passed = False
            continue
            
        # Check placeholders
        placeholder_errors = check_placeholders(rel_path, content)
        # Check links
        link_errors = verify_links(rel_path, content)
        
        if placeholder_errors or link_errors:
            print(" ❌ FAILED")
            all_passed = False
            if placeholder_errors:
                print("   Placeholders found:")
                for line_num, line_text, matches in placeholder_errors:
                    print(f"     Line {line_num}: '{line_text}' (matches: {matches})")
            if link_errors:
                print("   Link errors found:")
                for err in link_errors:
                    print(f"     {err}")
        else:
            print(" ✅ OK")
            
    print("\n=== Summary ===")
    if all_passed:
        print("🎉 ALL CHECKS PASSED: All 15+ documents are present, placeholder-free, and contain only valid links!")
        sys.exit(0)
    else:
        print("❌ SOME CHECKS FAILED. Please review the errors printed above.")
        if missing_files:
            print(f"Missing files: {missing_files}")
        sys.exit(1)

if __name__ == "__main__":
    main()
