"""Stage: Conversion logic (.doc -> Bracketed Text)."""

import subprocess
from v2.common import constants
from v2.conversion import doc_parser

def run_conversion():
    """Converts all local .doc originals to bracketed text files."""
    print("--- [ STAGE: CONVERSION ] ---")
    
    if not constants.DISCOVERED_DIR.exists():
        print("Error: Discovered directory not found.")
        return

    constants.CONVERTED_DIR.mkdir(parents=True, exist_ok=True)
    
    # List ALL files in discovered
    all_files = list(constants.DISCOVERED_DIR.iterdir())
    print(f"Found {len(all_files)} total local files.")
    
    success_count = 0
    exists_skip_count = 0
    temp_skip_count = 0
    unsupported_skip_count = 0
    error_count = 0
    
    for doc_path in all_files:
        # 1. Skip non-DOC files
        if doc_path.suffix.lower() != ".doc":
            unsupported_skip_count += 1
            continue

        # 2. Skip temporary files
        if doc_path.name.startswith("~"):
            temp_skip_count += 1
            continue

        dest_path = constants.CONVERTED_DIR / f"{doc_path.stem}.txt"
        
        # 3. Check for existing metadata header (idempotency + upgrade)
        if dest_path.exists():
            with open(dest_path, "r", encoding="utf-8") as f:
                first_line = f.readline()
                if "--- METADATA START ---" in first_line:
                    exists_skip_count += 1
                    continue
            
        try:
            metadata = doc_parser.get_ole_metadata(doc_path)
            result = subprocess.run(
                ["antiword", "-x", "db", str(doc_path)],
                capture_output=True,
                text=True,
                check=True
            )
            bracketed_text = doc_parser.transform_xml_to_bracketed(
                result.stdout, metadata=metadata)
            
            with open(dest_path, "w", encoding="utf-8") as f:
                f.write(bracketed_text)
            
            success_count += 1
            if success_count % 100 == 0:
                print(f"Processed {success_count} files...")
                
        except subprocess.CalledProcessError as e:
            print(f"Error: antiword failed for {doc_path.name}")
            error_count += 1
        except Exception as e:
            print(f"Error converting {doc_path.name}: {e}")
            error_count += 1
            
    print(f"Conversion Complete.")
    print(f"Successfully Transcribed: {success_count}")
    print(f"Skipped (Already Exists): {exists_skip_count}")
    print(f"Skipped (Temp Word Files): {temp_skip_count}")
    print(f"Skipped (Unsupported):     {unsupported_skip_count}")
    if error_count > 0:
        print(f"Failed:                   {error_count}")
    print("-" * 25)
