document.addEventListener('DOMContentLoaded', async () => {
  // State
  let allImages = [];

  const downloadAllBtn = document.getElementById('download-all-btn');
  const convertAllBtn = document.getElementById('convert-all-btn');
  const imageList = document.getElementById('image-list');

  function updateButtons() {
    const count = allImages.length;
    downloadAllBtn.innerText = `Download All Images (${count})`;
    downloadAllBtn.disabled = count === 0;
    convertAllBtn.disabled = count === 0;
  }

  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab) {
    console.error("No active tab found");
    return;
  }

  // Inject content script if not already present
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
  } catch (e) {
    console.log("Script might already be injected or cannot inject:", e);
  }

  // Request assets
  chrome.tabs.sendMessage(tab.id, { action: "GET_ASSETS" }, (response) => {
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError);
      document.querySelector('.content-area').innerHTML = `<div class="empty-state">Error connecting to page. Try reloading the page.</div>`;
      return;
    }

    if (response && response.assets) {
      // Filter only images
      const images = response.assets.filter(a => a.type === 'image');
      renderAssets(images);
    } else {
      document.querySelector('.content-area').innerHTML = `<div class="empty-state">No images found.</div>`;
    }
  });

  function renderAssets(images) {
    allImages = images;
    imageList.innerHTML = ''; 
    
    if (images.length === 0) {
      imageList.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;">No images found.</div>`;
      updateButtons();
      return;
    }

    images.forEach(item => {
      const card = document.createElement('div');
      card.className = 'asset-card';

      const preview = document.createElement('img');
      preview.src = item.src;
      preview.className = 'asset-preview';

      const overlay = document.createElement('div');
      overlay.className = 'action-buttons';

      // Convert Button
      const convertBtn = document.createElement('button');
      convertBtn.className = 'icon-btn convert-btn';
      convertBtn.title = "Convert";
      convertBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
          <path d="M3 3v5h5"></path>
          <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path>
          <path d="M16 21h5v-5"></path>
        </svg>
      `;
      convertBtn.onclick = (e) => {
        e.stopPropagation();
        openConversionModal(item.src);
      };

      // Download Button
      const downloadBtn = document.createElement('button');
      downloadBtn.className = 'icon-btn';
      downloadBtn.title = "Download";
      downloadBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
      `;
      downloadBtn.onclick = (e) => {
        e.stopPropagation();
        chrome.downloads.download({ url: item.src });
      };

      overlay.appendChild(convertBtn);
      overlay.appendChild(downloadBtn);
      card.appendChild(preview);
      card.appendChild(overlay);
      
      // Lightbox click handler
      card.onclick = () => openLightbox(item.src);
      
      imageList.appendChild(card);
    });

    updateButtons();
  }

  // --- Conversion Logic (Canvas based) ---
  const conversionModal = document.getElementById('conversion-modal');
  const modalClose = document.querySelector('.modal-close');
  let conversionTarget = null; // src or 'all'

  function openConversionModal(src) {
    conversionTarget = src || 'all';
    conversionModal.style.display = 'flex';
    setTimeout(() => conversionModal.classList.add('visible'), 10);
  }

  function closeConversionModal() {
    conversionModal.classList.remove('visible');
    setTimeout(() => {
      conversionModal.style.display = 'none';
      conversionTarget = null;
    }, 200);
  }

  modalClose.onclick = closeConversionModal;
  conversionModal.onclick = (e) => {
    if (e.target === conversionModal) closeConversionModal();
  };

  document.querySelectorAll('.format-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (btn.classList.contains('disabled')) return;
      
      const format = btn.getAttribute('data-format');
      const ext = btn.getAttribute('data-ext');
      
      closeConversionModal();

      if (conversionTarget === 'all') {
        await convertAndDownloadAll(format, ext);
      } else {
        await convertAndDownloadSingle(conversionTarget, format, ext);
      }
    });
  });

  convertAllBtn.addEventListener('click', () => {
    openConversionModal(null);
  });

  async function convertImage(url, format) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Conversion failed"));
        }, format, 0.9);
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = url;
    });
  }

  async function convertAndDownloadSingle(url, format, ext) {
    try {
      const blob = await convertImage(url, format);
      const blobUrl = URL.createObjectURL(blob);
      chrome.downloads.download({
        url: blobUrl,
        filename: `converted_image.${ext}`,
        saveAs: true
      }, () => URL.revokeObjectURL(blobUrl));
    } catch (e) {
      console.error("Conversion error:", e);
      alert("Could not convert image. It might be protected.");
    }
  }

  async function convertAndDownloadAll(format, ext) {
    if (allImages.length === 0) return;

    const zip = new JSZip();
    const folder = zip.folder("converted_images");
    
    const originalText = convertAllBtn.innerText;
    convertAllBtn.innerText = "Converting...";
    convertAllBtn.disabled = true;

    const promises = allImages.map(async (asset, index) => {
      try {
        const blob = await convertImage(asset.src, format);
        folder.file(`image_${index + 1}.${ext}`, blob);
      } catch (e) {
        console.error("Failed to convert:", asset.src);
      }
    });

    await Promise.all(promises);

    zip.generateAsync({ type: "blob" }).then(function(content) {
      const url = URL.createObjectURL(content);
      chrome.downloads.download({
        url: url,
        filename: `converted_images_${ext}.zip`,
        saveAs: true
      }, () => {
        URL.revokeObjectURL(url);
        convertAllBtn.innerText = originalText;
        convertAllBtn.disabled = false;
      });
    });
  }

  // --- Lightbox Logic ---
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const closeBtn = document.querySelector('.lightbox-close');

  function openLightbox(src) {
    lightbox.style.display = 'flex';
    setTimeout(() => lightbox.classList.add('visible'), 10);
    lightboxImg.src = src;
  }

  function closeLightbox() {
    lightbox.classList.remove('visible');
    setTimeout(() => {
      lightbox.style.display = 'none';
      lightboxImg.src = '';
    }, 300);
  }

  closeBtn.onclick = closeLightbox;
  lightbox.onclick = (e) => {
    if (e.target === lightbox) closeLightbox();
  };

  downloadAllBtn.addEventListener('click', async () => {
    if (allImages.length === 0) return;

    const zip = new JSZip();
    const folder = zip.folder("images");
    
    const originalText = downloadAllBtn.innerText;
    downloadAllBtn.innerText = "Zipping...";
    downloadAllBtn.disabled = true;

    const promises = allImages.map(async (asset, index) => {
      try {
        const response = await fetch(asset.src);
        const blob = await response.blob();
        
        // Guess extension
        let ext = 'jpg';
        const mime = blob.type;
        if (mime.includes('png')) ext = 'png';
        else if (mime.includes('gif')) ext = 'gif';
        else if (mime.includes('svg')) ext = 'svg';
        else if (mime.includes('webp')) ext = 'webp';
        
        folder.file(`image_${index + 1}.${ext}`, blob);
      } catch (e) {
        console.error("Failed to fetch asset:", asset.src, e);
      }
    });

    await Promise.all(promises);

    zip.generateAsync({ type: "blob" }).then(function(content) {
      const url = URL.createObjectURL(content);
      chrome.downloads.download({
        url: url,
        filename: `images.zip`,
        saveAs: true
      }, () => {
        URL.revokeObjectURL(url);
        downloadAllBtn.innerText = originalText;
        downloadAllBtn.disabled = false;
      });
    });
  });
});
