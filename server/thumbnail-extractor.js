const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');

class ThumbnailExtractor {
    constructor(threemfDirectory) {
        this.threemfDirectory = threemfDirectory;
        this.thumbnailCache = new Map();
    }

    /**
     * Extract thumbnail from a .3mf file
     * @param {string} filename - Name of the .3mf file (without path)
     * @returns {Buffer|null} - PNG image buffer or null if not found
     */
    extractThumbnail(filename) {
        // Check cache first
        if (this.thumbnailCache.has(filename)) {
            return this.thumbnailCache.get(filename);
        }

        const filePath = path.join(this.threemfDirectory, filename);

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            console.log(`3MF file not found: ${filePath}`);
            return null;
        }

        try {
            const zip = new AdmZip(filePath);
            const zipEntries = zip.getEntries();

            // Look for thumbnail in common locations
            // Bambu Studio typically stores thumbnails in Metadata/plate_*.png
            const thumbnailPatterns = [
                /Metadata\/plate_\d+\.png$/i,
                /Metadata\/thumbnail\.png$/i,
                /thumbnail\.png$/i,
                /preview\.png$/i
            ];

            for (const entry of zipEntries) {
                for (const pattern of thumbnailPatterns) {
                    if (pattern.test(entry.entryName)) {
                        console.log(`Found thumbnail in ${filename}: ${entry.entryName}`);
                        const thumbnailBuffer = entry.getData();

                        // Cache the thumbnail
                        this.thumbnailCache.set(filename, thumbnailBuffer);

                        return thumbnailBuffer;
                    }
                }
            }

            console.log(`No thumbnail found in ${filename}`);
            console.log('Available entries:', zipEntries.map(e => e.entryName));

            return null;
        } catch (error) {
            console.error(`Error extracting thumbnail from ${filename}:`, error);
            return null;
        }
    }

    /**
     * Clear the thumbnail cache
     */
    clearCache() {
        this.thumbnailCache.clear();
    }

    /**
     * Get thumbnail for a specific file, matching by base name
     * @param {string} gcodeFilename - The gcode filename from MQTT (e.g., "plate_1.gcode")
     * @returns {Buffer|null} - PNG image buffer or null if not found
     */
    getThumbnailForGcode(gcodeFilename) {
        if (!gcodeFilename) return null;

        // Extract base name without extension
        const baseName = path.basename(gcodeFilename, path.extname(gcodeFilename));

        // Try to find matching .3mf file
        const threemfFilename = `${baseName}.3mf`;

        return this.extractThumbnail(threemfFilename);
    }
}

module.exports = ThumbnailExtractor;
