"""Core logic for parsing antiword XML output into bracketed text."""

import xml.etree.ElementTree as ET

def transform_xml_to_bracketed(xml_string):
    """Parses antiword DocBook XML and returns a bracketed text representation.
    
    Args:
        xml_string: The raw XML string from antiword -x db.
    Returns:
        A string containing paragraphs and bracketed table rows, matching V1 style.
    """
    try:
        root = ET.fromstring(xml_string)
        output = []

        chapter = root.find(".//chapter")
        if chapter is None:
            return "Error: Could not find chapter content in XML."

        def _handle_table(table_element):
            """Internal helper to format informaltable as bracketed rows."""
            output.append("\n--- TABLE START ---")
            for row in table_element.findall(".//row"):
                row_content = []
                for entry in row.findall("entry"):
                    # Process multi-line content: clean each line and join with <br>
                    raw_lines = "".join(entry.itertext()).splitlines()
                    cleaned_lines = [
                        " ".join(line.split()).strip() 
                        for line in raw_lines if line.strip()
                    ]
                    cell_text = " <br> ".join(cleaned_lines)
                    row_content.append(f"[ {cell_text if cell_text else 'EMPTY'} ]")
                output.append(" ".join(row_content))
            output.append("--- TABLE END ---\n")

        # Iterate through chapter children (typically para tags)
        for element in chapter:
            if element.tag == "para":
                # Check if this paragraph is just a wrapper for a table
                table = element.find("informaltable")
                if table is not None:
                    _handle_table(table)
                else:
                    # Regular text paragraph
                    text = "".join(element.itertext()).strip()
                    if text:
                        output.append(text)
            elif element.tag == "informaltable":
                # Sometimes tables are siblings of para, not children
                _handle_table(element)
            
        return "\n".join(output)
    except Exception as e:
        return f"Error parsing XML for bracketed view: {e}"
