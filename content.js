if (!window.hasAssetDownloaderListener) {
  window.hasAssetDownloaderListener = true;
  
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "GET_ASSETS") {
      const assets = [];
      const seen = new Set();

      function addAsset(src, type, source) {
        if (src && !seen.has(src) && !src.startsWith('data:')) { // Filter out base64 for now if too large, or keep? Plan said "Ensure data URIs are captured". Let's keep them but maybe filter tiny ones later.
          // Actually, let's keep data URIs.
          seen.add(src);
          assets.push({ type, src, source });
        } else if (src && !seen.has(src)) {
           seen.add(src);
           assets.push({ type, src, source });
        }
      }

      // 1. Standard Images
      Array.from(document.images).forEach(img => {
        addAsset(img.src, 'image', 'img');
      });

      // 2. CSS Background Images
      const allElements = document.querySelectorAll('*');
      allElements.forEach(el => {
        const style = window.getComputedStyle(el);
        const bgImage = style.backgroundImage;
        if (bgImage && bgImage !== 'none' && bgImage.startsWith('url(')) {
          // Extract URL from url("...")
          let url = bgImage.slice(4, -1).replace(/["']/g, "");
          addAsset(url, 'image', 'css');
        }
      });

      // 3. Meta Tags (OG, Twitter)
      const metaSelectors = [
        'meta[property="og:image"]',
        'meta[name="twitter:image"]',
        'meta[itemprop="image"]'
      ];
      metaSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(meta => {
          addAsset(meta.content, 'image', 'meta');
        });
      });

      // 4. Favicons
      const linkSelectors = [
        'link[rel~="icon"]',
        'link[rel~="apple-touch-icon"]'
      ];
      linkSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(link => {
          addAsset(link.href, 'image', 'icon');
        });
      });



      sendResponse({ assets });
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
