"""Doc Inspector: Exploration utility to extract data from legacy .doc files.

This script iterates through .doc files in a specified Google Drive folder,
downloads them to a local cache, and extracts metadata and text for inspection.
"""

import argparse
import os
import subprocess
import sys
from pathlib import Path

import olefile
from dotenv import load_dotenv
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

# Load environment variables from .env file.
load_dotenv()

# Constants for Google Drive folder and local cache.
FOLDER_ID_SOURCE_DOCS = os.getenv("FOLDER_ID_SOURCE_DOCS")
SERVICE_ACCOUNT_FILE = os.getenv("SERVICE_ACCOUNT_CREDENTIALS_DRIVE_READER")
CACHE_DIR = Path("drive_cache/originals")
TMP_DIR = Path("tmp/thumbnails")

# Scopes required for Google Drive API.
SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]


def get_drive_service():
    """Authenticates using a Service Account and returns the Drive API service."""
    if not SERVICE_ACCOUNT_FILE:
        print("Error: SERVICE_ACCOUNT_CREDENTIALS_DRIVE_READER not set in .env")
        sys.exit(1)
    
    if not os.path.exists(SERVICE_ACCOUNT_FILE):
        print(f"Error: Service account file not found: {SERVICE_ACCOUNT_FILE}")
        sys.exit(1)

    creds = service_account.Credentials.from_service_account_file(
        SERVICE_ACCOUNT_FILE, scopes=SCOPES
    )
    return build("drive", "v3", credentials=creds)


def download_file(service, file_id, destination):
    """Downloads a file from Google Drive to the specified local path.

    Args:
        service: The Drive API service object.
        file_id: The ID of the file to download.
        destination: Path object representing the local destination.
    """
    destination.parent.mkdir(parents=True, exist_ok=True)
    request = service.files().get_media(fileId=file_id)
    with open(destination, "wb") as f:
        downloader = MediaIoBaseDownload(f, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()


def inspect_doc(file_path, save_thumbnails=False):
    """Prints OLE2 metadata and text extracted from a .doc file.

    Args:
        file_path: Path object to the .doc file.
        save_thumbnails: Boolean, whether to save and convert binary thumbnails.
    """
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
                            TMP_DIR.mkdir(parents=True, exist_ok=True)
                            base_name = file_path.stem
                            wmf_path = TMP_DIR / f"{base_name}.wmf"
                            
                            # Strip 16-byte wrapper if present (starts with ffffffff)
                            if isinstance(val, bytes) and val.startswith(b'\xff\xff\xff\xff'):
                                val = val[16:]
                            
                            # Save raw WMF
                            with open(wmf_path, "wb") as f:
                                f.write(val)
                            print(f"  (Saved raw WMF: {wmf_path})")

                            # Convert to JPG
                            jpg_path = TMP_DIR / f"{base_name}.jpg"
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
    print("\n--- [ TEXT (via antiword) ] ---")
    try:
        cmd = ["antiword", str(file_path)]
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=False
        )
        if result.returncode == 0:
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
    args = parser.parse_args()

    if not FOLDER_ID_SOURCE_DOCS:
        print("Error: FOLDER_ID_SOURCE_DOCS not set in .env")
        sys.exit(1)

    try:
        service = get_drive_service()
    except Exception as e:
        print(f"Failed to initialize Drive service: {e}")
        sys.exit(1)

    print("Fetching file list (newest first)...")
    try:
        results = service.files().list(
            q=f"'{FOLDER_ID_SOURCE_DOCS}' in parents and trashed = false",
            orderBy="modifiedTime desc",
            fields="files(id, name, modifiedTime, size)",
            pageSize=100
        ).execute()
    except Exception as e:
        print(f"Failed to fetch file list: {e}")
        print("\nNote: Make sure you have shared the folder with the Service Account email.")
        sys.exit(1)

    files = results.get("files", [])

    if not files:
        print("No files found in the specified source folder.")
        return

    processed_count = 0
    for file_info in files:
        name = file_info["name"]
        file_id = file_info["id"]
        mod_time = file_info["modifiedTime"]
        
        # Mirroring the flat structure of the source directory.
        dest_path = CACHE_DIR / name

        print(f"\nProcessing: {name}")
        print(f"Modified: {mod_time}")
        
        if not dest_path.exists():
            print(f"Downloading from Drive...")
            try:
                download_file(service, file_id, dest_path)
            except Exception as e:
                print(f"Failed to download {name}: {e}")
                continue
        else:
            print(f"Using cached file.")

        inspect_doc(dest_path, save_thumbnails=args.save_thumbnails)
        processed_count += 1

        if processed_count >= args.batch:
            user_input = input("\n[Enter] for next batch, [q] to quit: ").strip().lower()
            if user_input == "q":
                break
            processed_count = 0


if __name__ == "__main__":
    main()
