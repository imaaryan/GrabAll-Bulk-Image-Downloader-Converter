if (!window.hasAssetDownloaderListener) {
  window.hasAssetDownloaderListener = true;
  
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "GET_ASSETS") {
      const images = Array.from(document.images).map(img => ({
        type: 'image',
        src: img.src
      })).filter(item => item.src);

      const videos = Array.from(document.querySelectorAll('video')).map(video => {
        let src = video.src;
        if (!src && video.querySelector('source')) {
          src = video.querySelector('source').src;
        }
        return {
          type: 'video',
          src: src
        };
      }).filter(item => item.src);

      // Remove duplicates
      const uniqueAssets = [];
      const seen = new Set();
      [...images, ...videos].forEach(asset => {
        if (!seen.has(asset.src)) {
          seen.add(asset.src);
          uniqueAssets.push(asset);
        }
      });

      sendResponse({ assets: uniqueAssets });
    } else if (request.action === 'FETCH_AS_DATA_URL') {
      fetch(request.url)
        .then(response => response.blob())
        .then(blob => {
          const reader = new FileReader();
          reader.onloadend = () => {
            sendResponse({ success: true, dataUrl: reader.result });
          };
          reader.onerror = () => {
            sendResponse({ success: false, error: 'Failed to read blob' });
          };
          reader.readAsDataURL(blob);
        })
        .catch(error => {
          sendResponse({ success: false, error: error.message });
        });
      return true; // Keep channel open
    }
  });
}
