# Asset Downloader & Converter

A powerful and lightweight Chrome Extension to extract, download, and convert images from any webpage. Now with advanced batch processing tools!

## Features

### 🔍 Deep Extraction
*   **Bulk Image Extraction**: Automatically detects and lists all images on the current webpage.
*   **Modern SaaS UI**: A clean, professional interface inspired by Untitled UI (Inter font, neutral grays).
*   **Smart Grid View**: Preview images in a clean, responsive grid layout.
*   **Base64 Support**: Handles embedded data URIs seamlessly.

### 🎛️ Advanced Control
*   **Filtering**: Filter images by type (JPG, PNG, SVG, WebP, GIF).
*   **Sorting**: Sort grid by File Size (Small/Big).
*   **Selection**: Select specific images using checkboxes or "Select All".

### ⚡ Batch Processing
*   **Bulk Download**: Download all or selected images as a ZIP file.
*   **Batch Renaming**: Give all downloaded files a custom prefix (e.g., `vacation_01.jpg`).
*   **Batch Resizing**: Automatically resize all images to a specific width before downloading.
*   **Batch Conversion**: Convert multiple images to **JPG**, **PNG**, or **WebP** at once.

### 🛡️ Privacy Focused
*   All processing happens locally on your device. No data is sent to external servers.

## Installation

1.  Clone or download this repository.
2.  Open Chrome and navigate to `chrome://extensions/`.
3.  Enable **Developer mode** (toggle in the top right corner).
4.  Click **Load unpacked**.
5.  Select the directory where you downloaded this project.

## Usage

1.  Navigate to any website.
2.  Click the **Asset Downloader** icon.
3.  **View & Select**: Click an image to view it in full size. Click the checkbox to select it for batch actions.
4.  **Batch Options**: Click the **Settings Icon** (bottom left) to open the Batch Panel. Set a filename prefix or resize width.
5.  **Action**: Click **Download Selected** or **Convert Selected**.

## Technologies

*   **Frontend**: HTML, CSS (Vanilla), JavaScript
*   **Libraries**: JSZip (for bulk downloads)
*   **Platform**: Chrome Extensions API (Manifest V3)

## License

MIT
