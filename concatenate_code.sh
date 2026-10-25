#!/bin/bash

# =============================================================================
# Script: concatenate_code.sh
# Purpose: Concatenate all code files (including .manifest) from a project
#          directory into a single .txt file, excluding specified folders
#          and specific files.
# =============================================================================

# --- Configuration -----------------------------------------------------------
SOURCE_DIR="/home/iburu/finance-erp"
OUTPUT_FILE="${SOURCE_DIR}/all-codes.txt"

# Folders to exclude (relative to SOURCE_DIR)
EXCLUDE_DIRS=(
    ".git"
    "node-modules"
    "node_modules"
    "import-files"
    "dist"
    "android"
    "assets"
)

# Specific files to exclude (by filename, matched anywhere in tree)
EXCLUDE_FILES=(
    "seedData.js"
    "package-lock.json"
)

# File extensions to include (leave empty to include ALL file types)
INCLUDE_EXTENSIONS=(
    "manifest"
    "js" "jsx" "ts" "tsx"
    "json"
    "html" "htm"
    "css" "scss" "sass" "less"
    "vue"
    "php"
    "py"
    "sh" "bash"
    "yml" "yaml"
    "xml"
    "sql"
    "md"
    "env"
    "txt"
    "gitignore"
    "editorconfig"
)

# --- Sanity checks -----------------------------------------------------------
if [ ! -d "$SOURCE_DIR" ]; then
    echo "ERROR: Source directory '$SOURCE_DIR' does not exist."
    exit 1
fi

echo "Scanning: $SOURCE_DIR"
echo "Output:   $OUTPUT_FILE"
echo

# --- Build find command with exclusions --------------------------------------
FIND_CMD=(find "$SOURCE_DIR" -type f)

# Add directory exclusions
for dir in "${EXCLUDE_DIRS[@]}"; do
    FIND_CMD+=(-not -path "*/${dir}/*")
done

# Add specific file exclusions (basename match anywhere)
for fname in "${EXCLUDE_FILES[@]}"; do
    FIND_CMD+=(-not -name "${fname}")
done

# Also exclude the output file itself to avoid self-inclusion on re-runs
FIND_CMD+=(-not -path "${OUTPUT_FILE}")

# Build extension filter
if [ ${#INCLUDE_EXTENSIONS[@]} -gt 0 ]; then
    FIND_CMD+=( \( )
    first=1
    for ext in "${INCLUDE_EXTENSIONS[@]}"; do
        if [ $first -eq 0 ]; then
            FIND_CMD+=(-o)
        fi
        FIND_CMD+=(-name "*.${ext}")
        first=0
    done
    FIND_CMD+=( \) )
fi

# Execute find and sort results
mapfile -t FILES < <("${FIND_CMD[@]}" | sort)

# --- Write output ------------------------------------------------------------
: > "$OUTPUT_FILE"

# Header
{
    echo "================================================================"
    echo "  CODE CONCATENATION DUMP"
    echo "  Source:  $SOURCE_DIR"
    echo "  Created: $(date)"
    echo "  Files:   ${#FILES[@]}"
    echo "================================================================"
    echo
} >> "$OUTPUT_FILE"

# Concatenate each file
count=0
for file in "${FILES[@]}"; do
    rel_path="${file#$SOURCE_DIR/}"
    count=$((count + 1))

    {
        echo
        echo "================================================================"
        echo "FILE: $rel_path"
        echo "================================================================"
        cat "$file"
        echo
        echo "--- END OF FILE: $rel_path ---"
    } >> "$OUTPUT_FILE"
done

# --- Report ------------------------------------------------------------------
echo "Done. Concatenated $count files."
echo "Output saved to: $OUTPUT_FILE"
echo "Size: $(du -h "$OUTPUT_FILE" | cut -f1)"
