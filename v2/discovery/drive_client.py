"""Google Drive API client wrappers for file discovery and downloading."""

import io
import os
from googleapiclient.http import MediaIoBaseDownload
from v2.common import constants

def list_files_in_folder(service, folder_id):
    """Returns a list of all files in the specified folder, newest first.
    
    Handles API pagination automatically to retrieve more than 1000 items.
    
    Args:
        service: Authenticated Drive API service.
        folder_id: The ID of the folder to scan.
    Returns:
        List of file objects containing id, name, and modifiedTime.
    """
    query = f"'{folder_id}' in parents and trashed = false"
    files = []
    page_token = None
    
    while True:
        results = service.files().list(
            q=query,
            orderBy="modifiedTime desc",
            fields="nextPageToken, files(id, name, modifiedTime, size)",
            pageSize=1000,
            pageToken=page_token
        ).execute()
        
        files.extend(results.get("files", []))
        page_token = results.get("nextPageToken")
        
        if not page_token:
            break
            
    return files

def download_file(service, file_id, destination_path):
    """Downloads a file from Google Drive using an atomic write pattern.
    
    The file is first downloaded to a temporary '.tmp' file and then moved to 
    the final destination only upon successful completion. This prevents
    partially downloaded or 0-byte files from being left in the cache.
    
    Args:
        service: Authenticated Drive API service.
        file_id: The Google Drive file ID.
        destination_path: Path object for the local destination.
    """
    destination_path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = destination_path.with_suffix(destination_path.suffix + ".tmp")
    
    request = service.files().get_media(fileId=file_id)
    
    try:
        with io.FileIO(str(temp_path), "wb") as fh:
            downloader = MediaIoBaseDownload(fh, request)
            done = False
            while not done:
                _, done = downloader.next_chunk()
        
        # Atomic rename ensures integrity
        os.replace(temp_path, destination_path)
        
    except Exception as e:
        # Cleanup partial temp file if download failed/interrupted
        if temp_path.exists():
            os.remove(temp_path)
        raise e
