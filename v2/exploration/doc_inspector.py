"""Doc Inspector: Exploration utility to extract data from legacy .doc files.

This script leverages the core pipeline logic to provide an interactive 
way to inspect original documents and their parsed representations.
"""

import argparse
import subprocess
import sys

import olefile

from v2.common import auth, constants
from v2.conversion import doc_parser
from v2.discovery import drive_client


def inspect_doc(file_path, save_thumbnails=False, width=80, output_format="text"):
    """Prints OLE2 metadata and text extracted from a .doc file."""
    print("\n" + "=" * 80)
    print(f"FILE: {file_path.name}")
    print("=" * 80)

    # 1. Metadata extraction via olefile.
    print("\n--- [ OLE2 METADATA ] ---")
    try:
        if olefile.isOleFile(file_path):
            with olefile.OleFileIO(file_path) as ole:
                meta = ole.get_metadata()
                for attr in meta.SUMMARY_ATTRIBS:
                    val = getattr(meta, attr)
                    if not val:
                        continue
                    
                    if attr.lower() == "thumbnail":
                        print(f"{attr.capitalize()}: <thumbnail-binary-blob>")
                        if save_thumbnails:
                            constants.THUMBNAILS_DIR.mkdir(parents=True, exist_ok=True)
                            base_name = file_path.stem
                            wmf_path = constants.THUMBNAILS_DIR / f"{base_name}.wmf"
                            
                            if isinstance(val, bytes) and val.startswith(b'\xff\xff\xff\xff'):
                                val = val[16:]
                            
                            with open(wmf_path, "wb") as f:
                                f.write(val)
                            print(f"  (Saved raw WMF: {wmf_path})")

                            jpg_path = constants.THUMBNAILS_DIR / f"{base_name}.jpg"
                            subprocess.run(["wmf2gd", "-t", "jpeg", "-o", str(jpg_path), str(wmf_path)], 
                                         capture_output=True)
                            if jpg_path.exists():
                                print(f"  (Converted to JPG: {jpg_path})")
                    else:
                        print(f"{attr.capitalize()}: {val}")
        else:
            print("Not a valid OLE2 file.")
    except Exception as e:
        print(f"Error reading OLE metadata: {e}")

    # 2. Text extraction via antiword.
    print(f"\n--- [ TEXT (Format: {output_format}) ] ---")
    try:
        if output_format in ["xml", "bracketed"]:
            cmd = ["antiword", "-x", "db", str(file_path)]
        else:
            cmd = ["antiword", "-w", str(width), str(file_path)]
            
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=False
        )
        
        if result.returncode == 0:
            if output_format == "bracketed":
                print(doc_parser.transform_xml_to_bracketed(result.stdout))
            else:
                print(result.stdout)
        else:
            print(f"antiword returned an error: {result.stderr}")
    except FileNotFoundError:
        print("Error: antiword is not installed or not in PATH.")
    except Exception as e:
        print(f"Unexpected error running antiword: {e}")

    print("-" * 80)


def main():
    """Main execution loop for inspecting documents."""
    parser = argparse.ArgumentParser(description="Inspect legacy .doc invoice files.")
    parser.add_argument("--save-thumbnails", action="store_true", 
                        help="Enable saving and converting binary thumbnails.")
    parser.add_argument("--batch", type=int, default=1, 
                        help="Number of files to process before waiting for input.")
    parser.add_argument("--width", type=int, default=None,
                        help="Width of antiword output (only valid for 'text' format).")
    parser.add_argument("--output-format", choices=["text", "xml", "bracketed"], 
                        default="text", help="Selection of output format.")
    args = parser.parse_args()

    if args.width is not None and args.output_format != "text":
        parser.error("--width can only be used with --output-format text")
    
    width = args.width if args.width is not None else 80

    if not constants.FOLDER_ID_SOURCE_DOCS:
        print("Error: FOLDER_ID_SOURCE_DOCS not set in .env")
        sys.exit(1)

    try:
        service = auth.get_drive_service()
    except Exception as e:
        print(f"Failed to initialize Drive service: {e}")
        sys.exit(1)

    print("Fetching file list (newest first)...")
    try:
        remote_files = drive_client.list_files_in_folder(
            service, constants.FOLDER_ID_SOURCE_DOCS)
    except Exception as e:
        print(f"Failed to fetch file list: {e}")
        sys.exit(1)

    if not remote_files:
        print("No files found in the specified source folder.")
        return

    processed_count = 0
    for file_info in remote_files:
        name = file_info["name"]
        file_id = file_info["id"]
        dest_path = constants.ORIGINALS_DIR / name

        if not dest_path.exists():
            print(f"Downloading from Drive: {name}...")
            try:
                drive_client.download_file(service, file_id, dest_path)
            except Exception as e:
                print(f"Failed to download {name}: {e}")
                continue
        
        inspect_doc(dest_path, 
                    save_thumbnails=args.save_thumbnails, 
                    width=width,
                    output_format=args.output_format)
        processed_count += 1

        if processed_count >= args.batch:
            user_input = input("\n[Enter] for next batch, [q] to quit: ").strip().lower()
            if user_input == "q":
                break
            processed_count = 0


if __name__ == "__main__":
    main()
