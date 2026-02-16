"""Stage: Conversion logic (.doc -> Bracketed Text)."""

import subprocess
from v2.common import constants
from v2.conversion import doc_parser

def run_conversion():
    """Converts all local .doc originals to bracketed text files."""
    print("--- [ STAGE: CONVERSION ] ---")
    
    if not constants.ORIGINALS_DIR.exists():
        print("Error: Originals directory not found. Run Discovery stage first.")
        return

    # Ensure output directory exists
    constants.BRACKETED_DIR.mkdir(parents=True, exist_ok=True)
    
    # List all .doc files in originals
    doc_files = list(constants.ORIGINALS_DIR.glob("*.doc"))
    print(f"Found {len(doc_files)} local documents to process.")
    
    success_count = 0
    exists_skip_count = 0
    temp_skip_count = 0
    error_count = 0
    
    for doc_path in doc_files:
        # Skip temporary/recovery files (prefixed with ~)
        if doc_path.name.startswith("~"):
            temp_skip_count += 1
            continue

        # Output filename: {base_name}.txt
        dest_path = constants.BRACKETED_DIR / f"{doc_path.stem}.txt"
        
        if dest_path.exists():
            exists_skip_count += 1
            continue
            
        try:
            # 1. Run antiword to get DocBook XML
            result = subprocess.run(
                ["antiword", "-x", "db", str(doc_path)],
                capture_output=True,
                text=True,
                check=True
            )
            
            # 2. Transform XML to Bracketed
            bracketed_text = doc_parser.transform_xml_to_bracketed(result.stdout)
            
            # 3. Save to file
            with open(dest_path, "w", encoding="utf-8") as f:
                f.write(bracketed_text)
            
            success_count += 1
            if success_count % 100 == 0:
                print(f"Processed {success_count} files...")
                
        except subprocess.CalledProcessError as e:
            print(f"Error: antiword failed for {doc_path.name}: {e}")
            error_count += 1
        except Exception as e:
            print(f"Error converting {doc_path.name}: {e}")
            error_count += 1
            
    print(f"Conversion Complete.")
    print(f"Successfully Transcribed: {success_count}")
    print(f"Skipped (Already Exists): {exists_skip_count}")
    print(f"Skipped (Temp Word Files):   {temp_skip_count}")
    if error_count > 0:
        print(f"Failed:                   {error_count}")
    print("-" * 25)
