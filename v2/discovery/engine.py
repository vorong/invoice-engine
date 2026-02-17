"""Stage: Discovery & Mirroring logic with Parallel Downloads."""

import concurrent.futures
import os
from v2.common import auth, constants
from v2.discovery import drive_client

def _download_task(file_info):
    """Worker function to download a single file."""
    service = auth.get_drive_service()
    name = file_info["name"]
    file_id = file_info["id"]
    dest_path = constants.DISCOVERED_DIR / name
    
    try:
        drive_client.download_file(service, file_id, dest_path)
        return True, name
    except Exception as e:
        return False, f"{name} (Error: {e})"

def run_discovery():
    """Fetches list of remote files and downloads missing ones in parallel."""
    print("--- [ STAGE: DISCOVERY ] ---")
    
    service = auth.get_drive_service()
    print(f"Listing files in remote folder: {constants.FOLDER_ID_SOURCE_DOCS}...")
    remote_files = drive_client.list_files_in_folder(
        service, constants.FOLDER_ID_SOURCE_DOCS)
    
    print(f"Found {len(remote_files)} total files on Drive.")
    
    to_download = []
    exists_skip_count = 0
    non_doc_count = 0
    
    for f in remote_files:
        name = f["name"]
        if not name.lower().endswith(".doc"):
            non_doc_count += 1
            # Still download it to mirror the drive
        
        if (constants.DISCOVERED_DIR / name).exists():
            exists_skip_count += 1
        else:
            to_download.append(f)
    
    if not to_download:
        print(f"Discovery Complete. All files mirrored.")
        print(f"Skipped (Already Exists): {exists_skip_count}")
        print(f"Non-DOC Files:           {non_doc_count}")
        print("-" * 25)
        return

    print(f"Found {len(to_download)} new/missing files. Starting parallel download...")
    
    download_count = 0
    error_count = 0
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=25) as executor:
        future_to_file = {executor.submit(_download_task, f): f for f in to_download}
        
        for future in concurrent.futures.as_completed(future_to_file):
            success, info = future.result()
            if success:
                download_count += 1
                if download_count % 50 == 0:
                    print(f"Progress: [{download_count}/{len(to_download)}] Downloaded...")
            else:
                print(f"FAILED: {info}")
                error_count += 1
            
    print(f"\nDiscovery Complete.")
    print(f"Successfully Downloaded: {download_count}")
    print(f"Skipped (Already Exists): {exists_skip_count}")
    print(f"Non-DOC Files:           {non_doc_count}")
    if error_count > 0:
        print(f"Failed Downloads:        {error_count}")
    print("-" * 25)
