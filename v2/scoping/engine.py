"""Stage: Scoping logic (Filter by Date and Metadata with Dual-Branch Output)."""

import re
import shutil
from datetime import datetime, date
from v2.common import constants

def parse_date_with_heuristics(date_str):
    """Parses date and returns (date_object, used_heuristic)."""
    used_heuristic = False
    
    # 1. Heuristic: Check for multi-line (e.g. "3 <br> 01.01.22")
    if "<br>" in date_str:
        date_str = date_str.split("<br>")[-1].strip()
        used_heuristic = True
    
    # 2. Heuristic: Check for multiple dots (e.g. "01..01.22")
    if ".." in date_str:
        date_str = re.sub(r"\.+", ".", date_str)
        used_heuristic = True
        
    # 3. Heuristic: Handle missing leading zeros (e.g. 1.1.22)
    parts = date_str.split(".")
    if len(parts) == 3:
        if len(parts[0]) == 1 or len(parts[1]) == 1:
            date_str = f"{parts[0].zfill(2)}.{parts[1].zfill(2)}.{parts[2].zfill(2)}"
            used_heuristic = True

    # 4. Try parsing standard format
    try:
        dt = datetime.strptime(date_str, "%m.%d.%y").date()
        return dt, used_heuristic
    except ValueError:
        # 5. Heuristic: Try other common legacy formats
        formats = ["%m/%d/%y", "%m-%d-%y", "%Y-%m-%d", "%d.%m.%y"]
        for fmt in formats:
            try:
                dt = datetime.strptime(date_str, fmt).date()
                return dt, True
            except ValueError:
                continue
    
    return None, False

def extract_cells(row_str):
    """Splits a bracketed row string into a list of cell contents."""
    return re.findall(r"\[\s*(.*?)\s*\]", row_str)

def get_metadata_from_text(lines):
    """Extracts OLE metadata from the text header."""
    meta = {}
    in_header = False
    for line in lines:
        if "--- METADATA START ---" in line:
            in_header = True
            continue
        if "--- METADATA END ---" in line:
            break
        if in_header and ":" in line:
            key, val = line.split(":", 1)
            meta[key.strip()] = val.strip()
    return meta

def get_invoice_date_info(lines):
    """Returns (date_object, used_heuristic) using Label and Peek."""
    for i, line in enumerate(lines):
        cells = extract_cells(line)
        if any(cell.lower() == "date" for cell in cells):
            date_col_index = -1
            for idx, cell in enumerate(cells):
                if cell.lower() == "date":
                    date_col_index = idx
                    break
            if i + 1 < len(lines):
                next_row_cells = extract_cells(lines[i+1])
                if len(next_row_cells) > date_col_index:
                    return parse_date_with_heuristics(next_row_cells[date_col_index])
    return None, False

def get_bucket_name(target_date):
    """Returns a functional bucket name based on relationship to cutoff."""
    cutoff = constants.IN_SCOPE_START_DATE
    pre_cutoff = date(cutoff.year - 1, cutoff.month, cutoff.day)
    post_cutoff = date(cutoff.year + 1, cutoff.month, cutoff.day)
    
    if target_date < pre_cutoff:
        return "1_old"
    elif pre_cutoff <= target_date < cutoff:
        return "2_slightly_before_cutoff"
    elif cutoff <= target_date < post_cutoff:
        return "3_slightly_after_cutoff"
    else:
        return "4_recent"

def should_include_in_working_set(category, bucket_name):
    """Applies inclusion rules for the fully_scoped working set."""
    if category == "successful":
        return True # Successful clean in-scope are always included
    
    # For others, only include if they are in the post-cutoff windows
    return bucket_name in ["3_slightly_after_cutoff", "4_recent"]

def run_scoping():
    """Filters converted files and buckets results into forensic and production branches."""
    print("--- [ STAGE: SCOPING ] ---")
    
    if not constants.CONVERTED_DIR.exists():
        print("Error: Converted directory not found.")
        return

    # Ensure all directories exist
    for d in [constants.SCOPED_STATUS_FAILED_DIR, 
              constants.SCOPED_STATUS_SUCCESSFUL_DIR, 
              constants.SCOPED_STATUS_HEURISTIC_DIR, 
              constants.SCOPED_STATUS_CONFLICT_DIR, 
              constants.SCOPED_FULLY_SCOPED_DIR]:
        d.mkdir(parents=True, exist_ok=True)
    
    transcribed_files = list(constants.CONVERTED_DIR.glob("*.txt"))
    print(f"Analyzing {len(transcribed_files)} files...")
    
    counts = {"successful": 0, "heuristic": 0, "conflict": 0, "failed": 0, "fully_scoped": 0, "out_of_scope": 0}
    
    for txt_path in transcribed_files:
        with open(txt_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
        
        meta = get_metadata_from_text(lines)
        inv_date, used_heuristic = get_invoice_date_info(lines)
        
        # 1. Determine Metadata Date for Failure Bucketing
        meta_dates = []
        for key in ["create_time", "last_saved_time"]:
            if key in meta:
                try:
                    dt = datetime.fromisoformat(meta[key]).date()
                    meta_dates.append(dt)
                except ValueError:
                    continue
        latest_meta_date = max(meta_dates) if meta_dates else date(1900, 1, 1)
        
        category = None
        bucket_date = None
        
        # CATEGORIZATION LOGIC (Mutually Exclusive)
        
        # Category: Failed
        if inv_date is None:
            category = "failed"
            bucket_date = latest_meta_date
            dest_status_root = constants.SCOPED_STATUS_FAILED_DIR
            
        # Category: Successful (Clean In-Scope)
        elif inv_date >= constants.IN_SCOPE_START_DATE and not used_heuristic:
            category = "successful"
            bucket_date = inv_date
            dest_status_root = constants.SCOPED_STATUS_SUCCESSFUL_DIR
            
        # Category: Heuristic (Messy In-Scope)
        elif inv_date >= constants.IN_SCOPE_START_DATE and used_heuristic:
            category = "heuristic"
            bucket_date = inv_date
            dest_status_root = constants.SCOPED_STATUS_HEURISTIC_DIR
            
        # Category: Conflict (Old Invoice Date, Recent Metadata)
        elif latest_meta_date >= constants.IN_SCOPE_START_DATE:
            category = "conflict"
            bucket_date = inv_date
            dest_status_root = constants.SCOPED_STATUS_CONFLICT_DIR
            
        # Category: Out of Scope
        else:
            category = "out_of_scope"
            counts["out_of_scope"] += 1
            continue

        # FILING LOGIC
        bucket_name = get_bucket_name(bucket_date)
        
        # Path 1: Forensic Status (Always filed here)
        status_dir = dest_status_root / bucket_name
        status_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(txt_path, status_dir / txt_path.name)
        counts[category] += 1
        
        # Path 2: Working Set (If criteria met)
        if should_include_in_working_set(category, bucket_name):
            shutil.copy2(txt_path, constants.SCOPED_FULLY_SCOPED_DIR / txt_path.name)
            counts["fully_scoped"] += 1
            
    print(f"Scoping Complete.")
    print(f"Production Working Set: {counts['fully_scoped']} (in fully_scoped/)")
    print("-" * 15)
    print(f"Status: Successful:     {counts['successful']}")
    print(f"Status: Heuristic:      {counts['heuristic']}")
    print(f"Status: Conflict:       {counts['conflict']}")
    print(f"Status: Failed Parse:   {counts['failed']}")
    print(f"Ignored: Out-of-Scope:  {counts['out_of_scope']}")
    print("-" * 25)
