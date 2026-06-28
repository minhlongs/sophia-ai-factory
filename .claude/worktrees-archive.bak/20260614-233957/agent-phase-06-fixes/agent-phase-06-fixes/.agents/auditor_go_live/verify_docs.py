import os
import re

docs_dir = "/Users/macbook/projects/sophia-ai-factory/docs/go-live-readiness"
markdown_files = [f for f in os.listdir(docs_dir) if f.endswith(".md")]

print(f"Checking {len(markdown_files)} files in {docs_dir}...\n")

placeholder_pat = re.compile(r"\b(tbd|todo|placeholder|xxx)\b", re.IGNORECASE)
link_pat = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")
path_pat = re.compile(r"(/[\w\-./]+|\.\./[\w\-./]+)")

all_clean = True

for f in markdown_files:
    file_path = os.path.join(docs_dir, f)
    with open(file_path, "r", encoding="utf-8") as file:
        content = file.read()
    
    # 1. Check placeholders
    placeholders = placeholder_pat.findall(content)
    if placeholders:
        print(f"[-] File {f} contains placeholders: {set(placeholders)}")
        all_clean = False
    
    # 2. Check links
    links = link_pat.findall(content)
    for text, url in links:
        # Ignore external http/https and anchors within the page
        if url.startswith("http://") or url.startswith("https://") or url.startswith("#"):
            continue
        
        print(f"[Link] {f}: '{text}' -> '{url}'")
        if not url.startswith("file:///"):
            print(f"  [-] ERROR: Local link does NOT start with 'file:///'")
            all_clean = False
        else:
            # Extract the path from the file:// scheme
            abs_path = url.replace("file://", "")
            if not os.path.exists(abs_path):
                print(f"  [-] ERROR: Path does not exist: '{abs_path}'")
                all_clean = False

if all_clean:
    print("\n[+] All checks passed! No placeholders, all local links use valid absolute file:// schemes and exist.")
else:
    print("\n[-] Some validation checks failed.")

