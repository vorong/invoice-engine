"""Core logic for parsing antiword XML output into bracketed text."""

import xml.etree.ElementTree as ET
import olefile

def get_ole_metadata(file_path):
    """Extracts creation and modification times from OLE2 metadata."""
    meta_info = {"filename": file_path.name}
    try:
        if olefile.isOleFile(file_path):
            with olefile.OleFileIO(file_path) as ole:
                meta = ole.get_metadata()
                if meta.create_time:
                    meta_info["create_time"] = meta.create_time.isoformat()
                if meta.last_saved_time:
                    meta_info["last_saved_time"] = meta.last_saved_time.isoformat()
    except Exception as e:
        print(f"Warning: Could not read OLE metadata for {file_path}: {e}")
    return meta_info

def transform_xml_to_bracketed(xml_string, metadata=None):
    """Parses antiword DocBook XML and returns a bracketed text representation.
    
    Args:
        xml_string: The raw XML string from antiword -x db.
        metadata: Optional dictionary of OLE metadata to include as a header.
    Returns:
        A string containing metadata header, paragraphs, and bracketed table rows.
    """
    output = []
    
    if metadata:
        output.append("--- METADATA START ---")
        # Filename first, then sorted keys
        if "filename" in metadata:
            output.append(f"filename: {metadata['filename']}")
        for key in sorted(metadata.keys()):
            if key != "filename":
                output.append(f"{key}: {metadata[key]}")
        output.append("--- METADATA END ---\n")

    try:
        root = ET.fromstring(xml_string)
        chapter = root.find(".//chapter")
        if chapter is None:
            return "\n".join(output) + "\nError: Could not find chapter content in XML."

        def _handle_table(table_element):
            """Internal helper to format informaltable as bracketed rows."""
            output.append("\n--- TABLE START ---")
            for row in table_element.findall(".//row"):
                row_content = []
                for entry in row.findall("entry"):
                    # Split into lines and clean
                    raw_lines = "".join(entry.itertext()).splitlines()
                    cleaned_lines = [
                        " ".join(line.split()).strip() 
                        for line in raw_lines if line.strip()
                    ]
                    cell_text = " <br> ".join(cleaned_lines)
                    row_content.append(f"[ {cell_text if cell_text else 'EMPTY'} ]")
                output.append(" ".join(row_content))
            output.append("--- TABLE END ---\n")

        # Iterate through chapter children
        for element in chapter:
            if element.tag == "para":
                table = element.find("informaltable")
                if table is not None:
                    _handle_table(table)
                else:
                    text = "".join(element.itertext()).strip()
                    if text:
                        output.append(text)
            elif element.tag == "informaltable":
                _handle_table(element)
            
        return "\n".join(output)
    except Exception as e:
        return "\n".join(output) + f"\nError parsing XML for bracketed view: {e}"
