#!/bin/bash

# concat_code.sh - Concatenate all code files into a single file with separators.
# Usage: ./concat_code.sh [SOURCE_DIR] [OUTPUT_FILE]
#   SOURCE_DIR   Directory to scan (default: current directory ".")
#   OUTPUT_FILE  Output file path   (default: "all_code.txt")
#
# Examples:
#   ./concat_code.sh
#   ./concat_code.sh ./my_project combined.txt

set -euo pipefail

SOURCE_DIR="${1:-.}"
OUTPUT_FILE="${2:-all_code.txt}"

# Resolve to absolute paths so we can safely exclude the output file
SOURCE_DIR="$(cd "$SOURCE_DIR" && pwd)"
mkdir -p "$(dirname "$OUTPUT_FILE")"
OUTPUT_FILE="$(cd "$(dirname "$OUTPUT_FILE")" && pwd)/$(basename "$OUTPUT_FILE")"

if [[ ! -d "$SOURCE_DIR" ]]; then
    echo "Error: '$SOURCE_DIR' is not a directory." >&2
    exit 1
fi

# ---- File extensions to include -------------------------------------------
EXTENSIONS=(
    # Web / React / Node
    js jsx mjs cjs ts tsx html htm css scss sass less
    # Data / config / docs
    json yaml yml toml ini cfg conf xml sql md markdown txt
    # App manifests (e.g. public/manifest.webmanifest)
    webmanifest manifest
    # Shell scripts
    sh bash zsh
)

# Build a find expression: -iname '*.ext' -o -iname '*.ext' ...
FIND_ARGS=()
first=1
for ext in "${EXTENSIONS[@]}"; do
    if [[ $first -eq 1 ]]; then
        FIND_ARGS+=( -iname "*.${ext}" )
        first=0
    else
        FIND_ARGS+=( -o -iname "*.${ext}" )
    fi
done

# Directories to skip entirely
PRUNE_DIRS=( 
    .git .svn .hg node_modules dist build target out bin obj
    .idea .vscode .venv venv env __pycache__ .pytest_cache
    .mypy_cache .tox .cache coverage .next .nuxt public/icons
)

PRUNE_EXPR=()
for d in "${PRUNE_DIRS[@]}"; do
    PRUNE_EXPR+=( -name "$d" -o )
done
# Drop the trailing -o
unset 'PRUNE_EXPR[${#PRUNE_EXPR[@]}-1]'

# ---- Collect files ---------------------------------------------------------
echo "Scanning: $SOURCE_DIR"
echo "Writing : $OUTPUT_FILE"

mapfile -t FILES < <(
    find "$SOURCE_DIR" \
        \( "${PRUNE_EXPR[@]}" \) -prune -o \
        -type f \( "${FIND_ARGS[@]}" \) -print \
    | grep -vxF "$OUTPUT_FILE" \
    | grep -v "/.env" \
    | grep -v "package-lock.json" \
    | sort
)

if [[ ${#FILES[@]} -eq 0 ]]; then
    echo "No matching files found." >&2
    exit 1
fi

# ---- Write output ----------------------------------------------------------
: > "$OUTPUT_FILE"

total=0
for f in "${FILES[@]}"; do
    rel="${f#"$SOURCE_DIR"/}"
    {
        echo
        echo "================================================================================"
        echo "FILE: $rel"
        echo "PATH: $f"
        echo "SIZE: $(stat -c%s "$f") bytes    LINES: $(wc -l < "$f")"
        echo "================================================================================"
        echo
    } >> "$OUTPUT_FILE"

    # Warn on binary files (contains NUL byte) and skip their content
    if grep -Iq . "$f"; then
        cat "$f" >> "$OUTPUT_FILE"
    else
        echo "[binary file skipped]" >> "$OUTPUT_FILE"
    fi

    # Ensure a trailing newline before the next separator
    [[ -s "$OUTPUT_FILE" && "$(tail -c1 "$OUTPUT_FILE")" != "" ]] && echo >> "$OUTPUT_FILE"

    (( total++ )) || true
done

echo
echo "Done. Concatenated $total files into:"
echo "  $OUTPUT_FILE ($(du -h "$OUTPUT_FILE" | cut -f1))"
