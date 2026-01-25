#!/bin/bash
# Convert WMA music files to MP3 for browser compatibility
# Usage: ./convert-music.sh

MUSIC_DIR="resources/Content/music"

# Check if ffmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
    echo "Error: ffmpeg is not installed."
    echo "Please install ffmpeg first:"
    echo "  Ubuntu/Debian: sudo apt-get install ffmpeg"
    echo "  macOS: brew install ffmpeg"
    echo "  Windows: Download from https://ffmpeg.org/download.html"
    exit 1
fi

echo "Converting WMA files to MP3..."
echo "Source directory: $MUSIC_DIR"

# Count files
total=$(find "$MUSIC_DIR" -type f -name "*.wma" 2>/dev/null | wc -l)
current=0

# Convert each WMA file to MP3
find "$MUSIC_DIR" -type f -name "*.wma" 2>/dev/null | sort | while IFS= read -r wma_file; do
    current=$((current + 1))
    filename=$(basename "$wma_file")
    basename="${filename%.wma}"
    mp3_file="${wma_file%.wma}.mp3"

    # Skip if MP3 already exists and is newer than WMA
    if [ -f "$mp3_file" ] && [ "$mp3_file" -nt "$wma_file" ]; then
        echo "[$current/$total] ✓ Skipping (already exists): $filename"
        continue
    fi

    echo "[$current/$total] Converting: $filename"

    # Convert with good quality settings, suppress verbose output
    if ffmpeg -i "$wma_file" -acodec libmp3lame -b:a 192k "$mp3_file" -loglevel warning -y 2>&1 | grep -v "^Enter command:"; then
        if [ -f "$mp3_file" ]; then
            echo "  ✓ Created: ${filename%.wma}.mp3"
        else
            echo "  ✗ Failed to create MP3 file"
        fi
    else
        echo "  ✗ Failed to convert: $filename"
    fi
done

echo ""
echo "Conversion complete!"
echo "You can now delete the .wma files if desired (but keep them as backup)"
