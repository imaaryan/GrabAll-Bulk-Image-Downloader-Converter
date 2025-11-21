document.addEventListener('DOMContentLoaded', async () => {
  // State
  let allAssets = [];
  let displayedAssets = [];
  let selectedAssets = new Set(); // Set of src strings

  // UI Elements
  const imageList = document.getElementById('image-list');
  const downloadAllBtn = document.getElementById('download-all-btn');
  const convertAllBtn = document.getElementById('convert-all-btn');
  const selectAllCheckbox = document.getElementById('select-all-checkbox');
  const selectionCount = document.getElementById('selection-count');
  const filterType = document.getElementById('filter-type');
  const sortOrder = document.getElementById('sort-order');
  
  // Batch UI
  const batchToggleBtn = document.getElementById('batch-toggle-btn');
  const batchOptions = document.getElementById('batch-options');
  const filenamePrefix = document.getElementById('filename-prefix');
  const resizeCheck = document.getElementById('resize-check');
  const resizeWidth = document.getElementById('resize-width');

  // --- Event Listeners ---

  filterType.addEventListener('change', renderAssets);
  sortOrder.addEventListener('change', renderAssets);

  selectAllCheckbox.addEventListener('change', (e) => {
    if (e.target.checked) {
      displayedAssets.forEach(a => selectedAssets.add(a.src));
    } else {
      selectedAssets.clear();
    }
    renderAssets(false); // Don't re-sort/filter, just re-render for selection state
  });

  batchToggleBtn.addEventListener('click', () => {
    const isHidden = batchOptions.style.display === 'none';
    batchOptions.style.display = isHidden ? 'block' : 'none';
    batchToggleBtn.style.background = isHidden ? '#e4e4e7' : '';
  });

  resizeCheck.addEventListener('change', (e) => {
    resizeWidth.disabled = !e.target.checked;
  });

  // --- Main Logic ---

  function updateButtons() {
    const count = selectedAssets.size || displayedAssets.length;
    const mode = selectedAssets.size > 0 ? 'Selected' : 'All';
    
    downloadAllBtn.innerText = `Download ${mode} (${count})`;
    convertAllBtn.innerText = `Convert ${mode}`;
    
    const hasAssets = allAssets.length > 0;
    downloadAllBtn.disabled = !hasAssets;
    convertAllBtn.disabled = !hasAssets;

    selectionCount.innerText = `${selectedAssets.size} selected`;
    selectAllCheckbox.checked = selectedAssets.size === displayedAssets.length && displayedAssets.length > 0;
    selectAllCheckbox.indeterminate = selectedAssets.size > 0 && selectedAssets.size < displayedAssets.length;
  }

  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab) return;

  // Inject content script
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
  } catch (e) {
    console.log("Script injection error/already injected:", e);
  }

  // Request assets
  chrome.tabs.sendMessage(tab.id, { action: "GET_ASSETS" }, (response) => {
    if (chrome.runtime.lastError) {
      document.querySelector('.content-area').innerHTML = `<div class="empty-state">Error connecting. Reload page.</div>`;
      return;
    }

    if (response && response.assets) {
      allAssets = response.assets;
      // Enrich assets with size/dimensions if possible? 
      // We can't easily get size without fetching. We'll sort by dimensions after loading image.
      renderAssets();
    } else {
      document.querySelector('.content-area').innerHTML = `<div class="empty-state">No images found.</div>`;
    }
  });

  async function renderAssets(shouldFilter = true) {
    if (shouldFilter !== false) {
      // Filter
      const type = filterType.value;
      displayedAssets = allAssets.filter(asset => {
        if (type === 'all') return true;
        const ext = asset.src.split('.').pop().split(/[?#]/)[0].toLowerCase();
        if (type === 'jpg') return ext === 'jpg' || ext === 'jpeg';
        if (type === 'svg') return ext === 'svg';
        return ext === type;
      });

      // Sort
      const sort = sortOrder.value;
      if (sort === 'size-asc' || sort === 'size-desc') {
        const assetsToFetch = displayedAssets.filter(a => typeof a.size === 'undefined');
        
        if (assetsToFetch.length > 0) {
           imageList.innerHTML = '<div class="empty-state">Calculating file sizes...</div>';
           
           await Promise.all(assetsToFetch.map(async (asset) => {
             asset.size = await getFileSize(asset.src);
           }));
        }
        
        displayedAssets.sort((a, b) => {
          return sort === 'size-asc' ? a.size - b.size : b.size - a.size;
        });
      }
    }

    imageList.innerHTML = ''; 
    
    if (displayedAssets.length === 0) {
      imageList.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;">No images found.</div>`;
      updateButtons();
      return;
    }

    displayedAssets.forEach(item => {
      const card = document.createElement('div');
      card.className = `asset-card ${selectedAssets.has(item.src) ? 'selected' : ''}`;

      // Checkbox
      const checkbox = document.createElement('div');
      checkbox.className = 'card-checkbox';
      checkbox.innerHTML = `
        <label class="checkbox-container" style="font-size: 18px; padding-left: 0;">
          <input type="checkbox" ${selectedAssets.has(item.src) ? 'checked' : ''}>
          <span class="checkmark" style="position: relative;"></span>
        </label>
      `;
      checkbox.querySelector('input').onclick = (e) => {
        e.stopPropagation();
        toggleSelection(item.src);
      };
      card.appendChild(checkbox);

      const preview = document.createElement('img');
      preview.src = item.src;
      preview.className = 'asset-preview';
      
      // Add badge for source (CSS/Meta)
      if (item.source && item.source !== 'img') {
        const badge = document.createElement('span');
        badge.style.cssText = 'position:absolute; top:5px; right:5px; background:rgba(0,0,0,0.6); color:white; font-size:10px; padding:2px 4px; border-radius:4px;';
        badge.innerText = item.source.toUpperCase();
        card.appendChild(badge);
      }

      const overlay = document.createElement('div');
      overlay.className = 'action-buttons';

      // Convert Button
      const convertBtn = document.createElement('button');
      convertBtn.className = 'icon-btn convert-btn';
      convertBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path><path d="M16 21h5v-5"></path></svg>`;
      convertBtn.onclick = (e) => { e.stopPropagation(); openConversionModal(item.src); };

      // Download Button
      const downloadBtn = document.createElement('button');
      downloadBtn.className = 'icon-btn';
      downloadBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
      downloadBtn.onclick = (e) => { e.stopPropagation(); chrome.downloads.download({ url: item.src }); };

      overlay.appendChild(convertBtn);
      overlay.appendChild(downloadBtn);
      card.appendChild(preview);
      card.appendChild(overlay);
      
      card.onclick = (e) => {
        // If clicking card body (not buttons), open lightbox
        if (!e.target.closest('.icon-btn') && !e.target.closest('.card-checkbox')) {
          openLightbox(item.src);
        }
      };
      
      imageList.appendChild(card);
    });

    updateButtons();
  }

  function toggleSelection(src) {
    if (selectedAssets.has(src)) {
      selectedAssets.delete(src);
    } else {
      selectedAssets.add(src);
    }
    renderAssets(false);
  }

  // --- Conversion Logic ---
  const conversionModal = document.getElementById('conversion-modal');
  const modalClose = document.querySelector('.modal-close');
  let conversionTarget = null; // src or 'all'

  function openConversionModal(src) {
    conversionTarget = src || 'batch';
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
  conversionModal.onclick = (e) => { if (e.target === conversionModal) closeConversionModal(); };

  document.querySelectorAll('.format-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (btn.classList.contains('disabled')) return;
      const format = btn.getAttribute('data-format');
      const ext = btn.getAttribute('data-ext');
      closeConversionModal();

      if (conversionTarget === 'batch') {
        await processBatch('convert', { format, ext });
      } else {
        await convertAndDownloadSingle(conversionTarget, format, ext);
      }
    });
  });

  // --- Lightbox Logic ---
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxClose = document.querySelector('.lightbox-close');

  function openLightbox(src) {
    lightboxImg.src = src;
    lightbox.style.display = 'flex';
    setTimeout(() => lightbox.classList.add('visible'), 10);
  }

  function closeLightbox() {
    lightbox.classList.remove('visible');
    setTimeout(() => {
      lightbox.style.display = 'none';
      lightboxImg.src = '';
    }, 300);
  }

  lightboxClose.onclick = closeLightbox;
  lightbox.onclick = (e) => {
    if (e.target === lightbox) closeLightbox();
  };

  convertAllBtn.addEventListener('click', () => openConversionModal(null));

  // --- Batch Processing (Download & Convert) ---

  downloadAllBtn.addEventListener('click', () => processBatch('download'));

  async function processBatch(action, options = {}) {
    // Determine targets
    const targets = selectedAssets.size > 0 
      ? displayedAssets.filter(a => selectedAssets.has(a.src))
      : displayedAssets;

    if (targets.length === 0) return;

    const zip = new JSZip();
    const folder = zip.folder("images");
    
    const btn = action === 'download' ? downloadAllBtn : convertAllBtn;
    const originalText = btn.innerText;
    btn.innerText = "Processing...";
    btn.disabled = true;

    // Batch Options
    const prefix = filenamePrefix.value.trim() || 'image';
    const doResize = resizeCheck.checked;
    const targetWidth = parseInt(resizeWidth.value);

    const promises = targets.map(async (asset, index) => {
      try {
        let blob;
        let ext;

        if (action === 'convert') {
          blob = await convertImage(asset.src, options.format, doResize, targetWidth);
          ext = options.ext;
        } else {
          // Download
          if (doResize) {
            // If resizing, we must convert to canvas first, usually implies JPG/PNG
            blob = await convertImage(asset.src, 'image/png', true, targetWidth);
            ext = 'png';
          } else {
            const response = await fetch(asset.src);
            blob = await response.blob();
            ext = asset.src.split('.').pop().split(/[?#]/)[0] || 'jpg';
            if (ext.length > 4) ext = 'jpg'; // Fallback
          }
        }
        
        const filename = `${prefix}_${index + 1}.${ext}`;
        folder.file(filename, blob);
      } catch (e) {
        console.error("Failed to process:", asset.src, e);
      }
    });

    await Promise.all(promises);

    zip.generateAsync({ type: "blob" }).then(function(content) {
      const url = URL.createObjectURL(content);
      const zipName = action === 'convert' ? `converted_${options.ext}.zip` : `images.zip`;
      
      chrome.downloads.download({
        url: url,
        filename: zipName,
        saveAs: true
      }, () => {
        URL.revokeObjectURL(url);
        btn.innerText = originalText;
        btn.disabled = false;
      });
    });
  }

  async function convertImage(url, format, resize = false, width = 0) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.naturalWidth;
        let h = img.naturalHeight;

        if (resize && width > 0) {
          const ratio = h / w;
          w = width;
          h = width * ratio;
        }

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        
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
      alert("Could not convert image.");
    }
  }
  async function getFileSize(url) {
    try {
      if (url.startsWith('data:')) {
         const base64Length = url.length - (url.indexOf(',') + 1);
         const padding = (url.charAt(url.length - 1) === '=') ? (url.charAt(url.length - 2) === '=' ? 2 : 1) : 0;
         return (base64Length * 0.75) - padding;
      }
      const response = await fetch(url, { method: 'HEAD' });
      const size = response.headers.get('content-length');
      return size ? parseInt(size, 10) : 0;
    } catch (e) {
      return 0;
    }
  }
});
