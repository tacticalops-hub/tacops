    // Global variables
    let canvas, ctx, mapImg;
    let isDrawing = false;
    let currentDrawing = null;
    let markers = [];
    let currentMap = 'cage';
    let deferredPrompt;
    // Color state
    let currentRouteColor = '#0af';
    let currentMarkerColor = '#0af';

    // Utility to get contrasting text color for a given hex background
    function getContrastYIQ(hexcolor) {
      hexcolor = hexcolor.replace('#', '');
      if (hexcolor.length === 3) {
        hexcolor = hexcolor[0] + hexcolor[0] + hexcolor[1] + hexcolor[1] + hexcolor[2] + hexcolor[2];
      }
      const r = parseInt(hexcolor.substr(0, 2), 16);
      const g = parseInt(hexcolor.substr(2, 2), 16);
      const b = parseInt(hexcolor.substr(4, 2), 16);
      const yiq = (r * 299 + g * 587 + b * 114) / 1000;
      return yiq >= 128 ? '#111' : '#fff';
    }

    // Update Add Marker buttons (sidebar and FAB) to reflect the current color
    function updateAddMarkerButtons() {
      const sidebarBtn = document.getElementById('sidebarAddMarkerBtn');
      const fabBtn = document.getElementById('fabAddMarker');
      const contrast = getContrastYIQ(currentMarkerColor);
      if (sidebarBtn) {
        sidebarBtn.style.background = currentMarkerColor;
        sidebarBtn.style.color = contrast;
      }
      if (fabBtn) {
        fabBtn.style.background = currentMarkerColor;
        fabBtn.style.color = contrast;
      }
    }

    // ----- Rotation utilities -----
    function getRotation(element) {
      if (!element) return 0;
      const mapContent = element.querySelector('.map-content') || element;
      return parseInt(mapContent.getAttribute('data-rot') || '0', 10);
    }

    function rotatePoint(x, y, rotation) {
      const rad = rotation * Math.PI / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const cx = 0.5;
      const cy = 0.5;
      const dx = x - cx;
      const dy = y - cy;
      return {
        x: dx * cos - dy * sin + cx,
        y: dx * sin + dy * cos + cy
      };
    }

    // Convert event coordinates to canvas coordinates accounting for rotation
    function getCanvasCoords(e, canvas) {
      const rect = canvas.getBoundingClientRect();
      let clientX, clientY;
      if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }
      let x = (clientX - rect.left) / rect.width;
      let y = (clientY - rect.top) / rect.height;
      const rot = getRotation(canvas.parentElement);
      if (rot) {
        const pt = rotatePoint(x, y, -rot);
        x = pt.x;
        y = pt.y;
      }
      return {
        x: x * canvas.width,
        y: y * canvas.height,
        fracX: x,
        fracY: y
      };
    }

    // Convert pointer event to unrotated fraction within container
    function getContainerFraction(e, container) {
      const rect = container.getBoundingClientRect();
      let clientX, clientY;
      if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }
      let x = (clientX - rect.left) / rect.width;
      let y = (clientY - rect.top) / rect.height;
      const rot = getRotation(container);
      if (rot) {
        const pt = rotatePoint(x, y, -rot);
        x = pt.x;
        y = pt.y;
      }
      return { x, y };
    }

    // Convert unrotated fraction to display position on container
    function fractionToStylePos(x, y, container) {
      const rot = getRotation(container);
      if (rot) {
        const pt = rotatePoint(x, y, rot);
        x = pt.x;
        y = pt.y;
      }
      return { left: (x * 100) + '%', top: (y * 100) + '%' };
    }
    
    // Upload functionality
    let uploadedMaps = {};
    let uploadCounter = 0;
    
    // Persistent storage functions
    function saveUploadedMaps() {
      try {
        const dataToSave = {
          uploadedMaps: uploadedMaps,
          uploadCounter: uploadCounter,
          // Save drawings and markers for uploaded maps
          uploadedMapDrawings: {},
          uploadedMapMarkers: {}
        };
        
        // Save drawings and markers for each uploaded map
        Object.keys(uploadedMaps).forEach(mapId => {
          if (mapDrawings[mapId]) {
            dataToSave.uploadedMapDrawings[mapId] = mapDrawings[mapId];
          }
          if (mapMarkers[mapId]) {
            dataToSave.uploadedMapMarkers[mapId] = mapMarkers[mapId];
          }
        });
        
        localStorage.setItem('uploadedMapsData', JSON.stringify(dataToSave));
        console.log('Uploaded maps saved successfully');
      } catch (error) {
        console.error('Error saving uploaded maps:', error);
      }
    }
    
    function loadUploadedMaps() {
      try {
        const savedData = localStorage.getItem('uploadedMapsData');
        if (savedData) {
          const data = JSON.parse(savedData);
          uploadedMaps = data.uploadedMaps || {};
          uploadCounter = data.uploadCounter || 0;
          
          // Restore drawings and markers for uploaded maps
          if (data.uploadedMapDrawings) {
            Object.keys(data.uploadedMapDrawings).forEach(mapId => {
              mapDrawings[mapId] = data.uploadedMapDrawings[mapId];
            });
          }
          if (data.uploadedMapMarkers) {
            Object.keys(data.uploadedMapMarkers).forEach(mapId => {
              mapMarkers[mapId] = data.uploadedMapMarkers[mapId];
            });
          }
          
          // Recreate map entries and add to selector
          Object.keys(uploadedMaps).forEach(mapId => {
            recreateUploadedMap(mapId, uploadedMaps[mapId]);
          });
          
          console.log('Uploaded maps loaded successfully');
        }
      } catch (error) {
        console.error('Error loading uploaded maps:', error);
        // Clear corrupted data
        localStorage.removeItem('uploadedMapsData');
      }
    }
    
    function recreateUploadedMap(mapId, mapData) {
      // Create map entry HTML
      const mapEntry = document.createElement('div');
      mapEntry.className = 'map-entry';
      mapEntry.id = mapId;
      mapEntry.style.display = 'none';
      
      mapEntry.innerHTML = `
        <div class="map-container">
          <!-- .map-content wrapper exists only to sync rotation between image and canvas -->
          <div class="map-content">
            <img id="${mapId}MapImage" src="${mapData.base64}" alt="${mapData.name} Map">
            <canvas id="${mapId}DrawingCanvas"></canvas>
          </div>
        </div>
      `;
      
      // Add to main content
      document.querySelector('main').appendChild(mapEntry);
      
      // Add to custom uploaded maps list
      addToUploadedMapsList(mapId, mapData.name);
      
      // Setup canvas for the restored map with improved timing
      const canvas = document.getElementById(`${mapId}DrawingCanvas`);
      if (canvas) {
        setupCanvas(canvas);
        // Additional delay for restored uploaded maps to ensure proper rendering
        requestAnimationFrame(() => {
          setTimeout(() => {
            const mapImg = document.getElementById(`${mapId}MapImage`);
            if (mapImg && mapImg.complete) {
              // Trigger a single resize for the restored map
              const canvas = document.getElementById(`${mapId}DrawingCanvas`);
              if (canvas && canvas.dataset.resized !== 'true') {
                // Direct resize call with debouncing
                if (canvas.resizeTimeout) {
                  clearTimeout(canvas.resizeTimeout);
                }
                canvas.resizeTimeout = setTimeout(() => {
                  if (canvas.dataset.resized !== 'true') {
                    canvas.dataset.resized = 'true';
                    const parent = canvas.parentElement;
                    const img = parent.querySelector('img');
                    if (img && img.complete && img.naturalWidth > 0) {
                      const rect = img.getBoundingClientRect();
                      const width = Math.round(rect.width);
                      const height = Math.round(rect.height);
                      if (width > 0 && height > 0) {
                        canvas.width = width;
                        canvas.height = height;
                        canvas.style.width = width + 'px';
                        canvas.style.height = height + 'px';
                        canvas.style.left = '0px';
                        canvas.style.top = '0px';
                        redraw();
                      }
                    }
                    setTimeout(() => {
                      canvas.dataset.resized = 'false';
                    }, 100);
                  }
                }, 50);
              }
            }
          }, 100);
        });
      }
    }

    // PWA Installation
    window.addEventListener('beforeinstallprompt', (e) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Stash the event so it can be triggered later
      deferredPrompt = e;
      // Show install button if it exists
      showInstallButton();
    });

    function showInstallButton() {
      // Show install button in sidebar
      const installBtn = document.getElementById('installBtn');
      if (installBtn) {
        installBtn.style.display = 'block';
      }
      
      // Show install button in FAB menu for mobile
      const fabInstallBtn = document.getElementById('fabInstall');
      if (fabInstallBtn) {
        fabInstallBtn.style.display = 'block';
      }
    }

    function hideInstallBanner() {
      const installBanner = document.getElementById('installBanner');
      if (installBanner) {
        installBanner.style.display = 'none';
      }
    }

    function installApp() {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
          if (choiceResult.outcome === 'accepted') {
            console.log('User accepted the install prompt');
            hideInstallBanner();
          } else {
            console.log('User dismissed the install prompt');
          }
          deferredPrompt = null;
        });
      }
    }

    // Register service worker for PWA features (make sure sw.js is in the project root)
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        const isLocalhost = ['localhost', '127.0.0.1'].includes(location.hostname);
        
        navigator.serviceWorker.register('./sw.js')
          .then((registration) => {
            console.log('SW registered: ', registration);
            // Prompt user to reload when a new SW is available (only on production)
            if (!isLocalhost) {
            registration.onupdatefound = () => {
              const newWorker = registration.installing;
              newWorker.onstatechange = () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  if (confirm('A new version is available. Reload now?')) {
                    window.location.reload();
                  }
                }
              };
            };
            }
          })
          .catch((registrationError) => {
            console.log('SW registration failed: ', registrationError);
          });
      });
    }

    // Handle app installed event
    window.addEventListener('appinstalled', (evt) => {
      console.log('App was installed');
    });

    // Handle online/offline status
    window.addEventListener('online', () => {
      const indicator = document.getElementById('offlineIndicator');
      if (indicator) {
        indicator.style.display = 'none';
      }
    });

    window.addEventListener('offline', () => {
      const indicator = document.getElementById('offlineIndicator');
      if (indicator) {
        indicator.style.display = 'block';
      }
    });

    // Drawing state per map
    const mapDrawings = {
      standoff: { drawings: [], undone: [] },
      firing_range: { drawings: [], undone: [] },
      zoo: { drawings: [], undone: [] },
      terminal: { drawings: [], undone: [] },
      tunisia: { drawings: [], undone: [] },
      monastery: { drawings: [], undone: [] },
      oasis: { drawings: [], undone: [] },
      rust: { drawings: [], undone: [] },
      hacienda: { drawings: [], undone: [] },
      highrise: { drawings: [], undone: [] },
      icebreaker: { drawings: [], undone: [] },
      takeoff: { drawings: [], undone: [] },
      vacant: { drawings: [], undone: [] },
      hackney_yard: { drawings: [], undone: [] },
      hovec_sawmill: { drawings: [], undone: [] },
      shipment: { drawings: [], undone: [] },
      scrapyard_2019: { drawings: [], undone: [] },
      suldal_harbor: { drawings: [], undone: [] },
      dome: { drawings: [], undone: [] },
      slums: { drawings: [], undone: [] },
      nuketown_russia: { drawings: [], undone: [] },
      meltdown: { drawings: [], undone: [] },
      summit: { drawings: [], undone: [] },
      hijacked: { drawings: [], undone: [] },
      crash: { drawings: [], undone: [] },
      crossfire: { drawings: [], undone: [] },
      raid: { drawings: [], undone: [] },
      nuketown: { drawings: [], undone: [] },
      killhouse: { drawings: [], undone: [] },
      hardhat: { drawings: [], undone: [] },
      saloon: { drawings: [], undone: [] },
      pine: { drawings: [], undone: [] },
      king: { drawings: [], undone: [] },
      docks: { drawings: [], undone: [] },
      shoot_house: { drawings: [], undone: [] },
      cage: { drawings: [], undone: [] },
      coastal: { drawings: [], undone: [] },
      diesel: { drawings: [], undone: [] },
      kurohana_metropolis: { drawings: [], undone: [] },
      combine: { drawings: [], undone: [] },
      cheshire_park: { drawings: [], undone: [] },
      khandor_hideout: { drawings: [], undone: [] }
    };

    // Markers state per map
    const mapMarkers = {
      standoff: [],
      firing_range: [],
      zoo: [],
      terminal: [],
      tunisia: [],
      monastery: [],
      oasis: [],
      rust: [],
      hacienda: [],
      highrise: [],
      icebreaker: [],
      takeoff: [],
      vacant: [],
      hackney_yard: [],
      hovec_sawmill: [],
      shipment: [],
      scrapyard_2019: [],
      suldal_harbor: [],
      dome: [],
      slums: [],
      nuketown_russia: [],
      meltdown: [],
      summit: [],
      hijacked: [],
      crash: [],
      crossfire: [],
      raid: [],
      nuketown: [],
      killhouse: [],
      hardhat: [],
      saloon: [],
      pine: [],
      king: [],
      docks: [],
      shoot_house: [],
      cage: [],
      coastal: [],
      diesel: [],
      kurohana_metropolis: [],
      combine: [],
      cheshire_park: [],
      khandor_hideout: []
    };

    // Helper to get current map's drawing state
    function getCurrentDrawingState() {
      return mapDrawings[currentMap];
    }

    // Helper to get current map's markers array
    function getCurrentMarkers() {
      return mapMarkers[currentMap];
    }

    // Save board function
    function saveBoard() {
      const boardName = document.getElementById('boardName').value;
      if (!boardName) {
        alert('Please enter a board name');
        return;
      }
      const activeMap = document.querySelector('.map-entry:not([style*="display: none"])');
      const mapId = activeMap.id;
      const boardData = {
        mapId: mapId,
        drawings: getCurrentDrawingState().drawings,
        markers: mapMarkers[mapId]
      };
      const savedBoards = JSON.parse(localStorage.getItem('savedBoards') || '{}');
      savedBoards[boardName] = boardData;
      localStorage.setItem('savedBoards', JSON.stringify(savedBoards));
      document.getElementById('boardName').value = '';
      updateBoardList();
    }

    // Redraw function for the active canvas
    function redraw() {
      const canvas = getActiveCanvas();
      if (!canvas) return;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const { drawings } = getCurrentDrawingState();
      drawings.forEach(route => {
        // Support old format (array of points) and new format ({color, path})
        let color = '#0af';
        let path = route;
        if (route && route.path && Array.isArray(route.path)) {
          color = route.color || '#0af';
          path = route.path;
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        if (path.length > 0) {
          ctx.beginPath();
          ctx.moveTo(path[0].x, path[0].y);
          for (let i = 1; i < path.length; i++) {
            ctx.lineTo(path[i].x, path[i].y);
          }
          ctx.stroke();
        }
      });
      // Draw bomb sites and spawns overlays
      drawSitesAndSpawns();
    }

    // Drawing event handlers
    let path = [];
    let drawingColor = currentRouteColor;
    
    // Drawing is now allowed at any rotation
    function isDrawingAllowed() {
      return true;
    }

    function showRotationWarning() {}
    
    function startDrawing(e) {
      isDrawing = true;
      const canvas = e.target;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      drawingColor = currentRouteColor;
      const coords = getCanvasCoords(e, canvas);
      path = [{ x: coords.x, y: coords.y }];
      ctx.beginPath();
      ctx.moveTo(coords.x, coords.y);
    }
    function draw(e) {
      if (!isDrawing) return;

      const canvas = e.target;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.strokeStyle = drawingColor;
      const coords = getCanvasCoords(e, canvas);
      path.push({ x: coords.x, y: coords.y });
      ctx.lineWidth = 2;
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(coords.x, coords.y);
    }
    function stopDrawing(e) {
      if (!isDrawing) return;
      isDrawing = false;
      if (path.length > 1) {
        const { drawings, undone } = getCurrentDrawingState();
        // Store as { color, path } using the color at draw start
        drawings.push({ color: drawingColor, path: [...path] });
        undone.length = 0; // Clear redo stack
        
        // Auto-save uploaded map data
        if (currentMap.startsWith('uploaded_')) {
          saveUploadedMaps();
        }
      }
      redraw();
    }

    // Undo/Redo functions
    function undoDrawing() {
      const { drawings, undone } = getCurrentDrawingState();
      if (drawings.length > 0) {
        undone.push(drawings.pop());
        redraw();
      }
    }
    function redoDrawing() {
      const { drawings, undone } = getCurrentDrawingState();
      if (undone.length > 0) {
        drawings.push(undone.pop());
        redraw();
      }
    }

    // Wire up Undo/Redo buttons
    window.onload = function() {
        // Hide all maps initially
        document.querySelectorAll('.map-entry').forEach(entry => {
            entry.style.display = 'none';
        });
        // Find the first real map option (skip placeholder)
        const mapSelector = document.getElementById('sidebarMapSelect');
        let firstMapValue = '';
        if (mapSelector) {
            for (let i = 0; i < mapSelector.options.length; i++) {
                const opt = mapSelector.options[i];
                if (opt.value && !opt.disabled) {
                    firstMapValue = opt.value;
                    mapSelector.value = firstMapValue;
                    break;
                }
            }
        }
        if (firstMapValue) {
            currentMap = firstMapValue;
            const firstMapDiv = document.getElementById(firstMapValue);
            if (firstMapDiv) {
                firstMapDiv.style.display = 'block';
            }
            // Set the current map label
            const mapLabel = document.getElementById('currentMapLabel');
            if (mapLabel) {
                // Use the option's text as the label
                const selectedOption = mapSelector.querySelector(`option[value="${firstMapValue}"]`);
                mapLabel.textContent = selectedOption ? selectedOption.textContent : firstMapValue;
            }
            mapSelector.addEventListener('change', function() {
                switchMap(this.value);
            });
        }
        // Set up save button
        const saveButton = document.getElementById('saveBoardBtn');
        if (saveButton) {
            saveButton.addEventListener('click', saveBoard);
        }
            // Wire up Undo/Redo buttons
    document.getElementById('undoBtn').onclick = undoDrawing;
    document.getElementById('redoBtn').onclick = redoDrawing;
    // Load saved boards
    updateBoardList();
        
        // Load uploaded maps from localStorage
        loadUploadedMaps();
        
        // Setup all canvases
        const allCanvases = document.querySelectorAll('canvas[id$="DrawingCanvas"]');
        allCanvases.forEach(canvas => {
          setupCanvas(canvas);
        });
        
        // Setup upload functionality
        const uploadBtn = document.getElementById('uploadBtn');
        const imageUpload = document.getElementById('imageUpload');
        
        if (uploadBtn && imageUpload) {
          uploadBtn.addEventListener('click', () => {
            imageUpload.click();
          });
          
          imageUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
              if (file.type.startsWith('image/')) {
                handleImageUpload(file);
              } else {
                const statusDiv = document.getElementById('uploadStatus');
                statusDiv.textContent = 'Please select an image file.';
                statusDiv.className = 'upload-status error';
              }
            }
          });
        }
    
    // Handle URL parameters for PWA shortcuts
    const urlParams = new URLSearchParams(window.location.search);
    const mapParam = urlParams.get('map');
    if (mapParam && mapParam !== 'standoff') {
      // Switch to the specified map
      setTimeout(() => {
        switchMap(mapParam);
        // Update the select dropdown
        const mapSelect = document.getElementById('sidebarMapSelect');
        if (mapSelect) {
          mapSelect.value = mapParam;
        }
      }, 100);
    }
    };

    function setupCanvas(canvas) {
        if (!canvas) return;
        
        function attachEventListeners() {
          // Remove existing listeners to prevent duplicates
          canvas.removeEventListener('mousedown', startDrawing);
          canvas.removeEventListener('mousemove', draw);
          canvas.removeEventListener('mouseup', stopDrawing);
          canvas.removeEventListener('mouseout', stopDrawing);
          canvas.removeEventListener('touchstart', handleTouchStart);
          canvas.removeEventListener('touchmove', handleTouchMove);
          canvas.removeEventListener('touchend', handleTouchEnd);
          canvas.removeEventListener('touchcancel', handleTouchEnd);
          // Add event listeners
          canvas.addEventListener('mousedown', startDrawing);
          canvas.addEventListener('mousemove', draw);
          canvas.addEventListener('mouseup', stopDrawing);
          canvas.addEventListener('mouseout', stopDrawing);
          canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
          canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
          canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
          canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });
        }
        
        // Debounce timeout for resize operations
        let resizeTimeout = null;
        
        function resizeCanvas() {
          // Prevent multiple resize calls for the same canvas
          if (canvas.dataset.resized === 'true') {
            return;
          }
          
          const parent = canvas.parentElement;
          const mapImg = parent.querySelector('img');
          if (mapImg && mapImg.complete && mapImg.naturalWidth > 0) {
            const mapRect = mapImg.getBoundingClientRect();
            const width = Math.round(mapRect.width);
            const height = Math.round(mapRect.height);
            if (width === 0 || height === 0) return; // Skip if not visible
            
            // Set flag to prevent multiple resizes
            canvas.dataset.resized = 'true';
            
            canvas.width = width;
            canvas.height = height;
            canvas.style.width = width + 'px';
            canvas.style.height = height + 'px';
            canvas.style.left = '0px';
            canvas.style.top = '0px';
            attachEventListeners();
            redraw();
            
            // Reset flag after a short delay to allow future resizes if needed
            setTimeout(() => {
              canvas.dataset.resized = 'false';
            }, 100);
          }
        }
        
        // Throttle rapid resize events
        function handleResize() {
          if (resizeTimeout) {
            clearTimeout(resizeTimeout);
          }
          resizeTimeout = setTimeout(resizeCanvas, 50);
        }

        // Enhanced resize function with requestAnimationFrame
        function resizeCanvasWithDelay() {
          requestAnimationFrame(() => {
            handleResize();
          });
        }
        
        // Wait for image to load before initial resize
        const mapImg = canvas.parentElement.querySelector('img');
        if (mapImg) {
          if (mapImg.complete && mapImg.naturalWidth > 0) {
            // For preloaded maps, use immediate resize
            resizeCanvas();
          } else {
            // For uploaded maps, use delayed resize to ensure proper rendering
            mapImg.onload = function() {
              resizeCanvasWithDelay();
            };
          }
        }
        
        window.addEventListener('resize', handleResize);
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.strokeStyle = '#0af';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        attachEventListeners();
    }
    
    // Touch event handlers
    function handleTouchStart(e) {
      e.preventDefault();
      startDrawing(e);
    }
    
    function handleTouchMove(e) {
      e.preventDefault();
      draw(e);
    }
    
    function handleTouchEnd(e) {
      e.preventDefault();
      stopDrawing(e);
    }

    // Update resetCanvas to clear drawings and markers for current map
    window.resetCanvas = function() {
      const canvas = getActiveCanvas();
      if (canvas) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      document.querySelectorAll('.text-marker').forEach(m => m.remove());
      mapMarkers[currentMap] = [];
      const { drawings, undone } = getCurrentDrawingState();
      drawings.length = 0;
      undone.length = 0;
    };

    // Update switchMap to redraw on map change
    function switchMap(mapId) {
      // Hide all maps
      document.querySelectorAll('.map-entry').forEach(entry => {
        entry.style.display = 'none';
      });
      // Show selected map
      const selectedMap = document.getElementById(mapId);
      if (selectedMap) {
        selectedMap.style.display = 'block';
      }
      // Update current map
      currentMap = mapId;
      
      // Update selected state in custom uploaded maps list
      if (mapId.startsWith('uploaded_')) {
        updateSelectedMapItem(mapId);
      }
      
      // Resize canvas for the newly active map
      setTimeout(() => {
        const activeCanvas = getActiveCanvas();
        if (activeCanvas) {
          // Trigger the resize handler attached in setupCanvas
          if (activeCanvas.dataset.resized !== 'true') {
            window.dispatchEvent(new Event('resize'));
          }
          
          // Additional delay for uploaded maps to ensure proper rendering
          if (mapId.startsWith('uploaded_')) {
            requestAnimationFrame(() => {
              setTimeout(() => {
                const mapImg = activeCanvas.parentElement.querySelector('img');
                if (mapImg && mapImg.complete && activeCanvas.dataset.resized !== 'true') {
                  // Use the global resize handler for uploaded maps
                  window.dispatchEvent(new Event('resize'));
                }
              }, 50);
            });
          }
          
          // Ensure drawing is ready
          setTimeout(() => {
            const ctx = activeCanvas.getContext('2d', { willReadFrequently: true });
            ctx.strokeStyle = '#0af';
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
          }, 50);
        }
      }, 100);
      
      redraw();
      updateMarkers();
      // Update map label
      var mapLabel = document.getElementById('currentMapLabel');
      if (mapLabel) {
        if (mapId === 'standoff') mapLabel.textContent = 'Standoff';
        else if (mapId === 'firing_range') mapLabel.textContent = 'Firing Range';
        else if (mapId === 'zoo') mapLabel.textContent = 'Zoo';
        else if (mapId === 'terminal') mapLabel.textContent = 'Terminal';
        else if (mapId === 'tunisia') mapLabel.textContent = 'Tunisia';
        else if (mapId === 'monastery') mapLabel.textContent = 'Monastery';
        else if (mapId === 'oasis') mapLabel.textContent = 'Oasis';
        else if (mapId === 'rust') mapLabel.textContent = 'Rust';
        else if (mapId === 'hacienda') mapLabel.textContent = 'Hacienda';
        else if (mapId === 'highrise') mapLabel.textContent = 'Highrise';
        else if (mapId === 'icebreaker') mapLabel.textContent = 'Icebreaker';
        else if (mapId === 'takeoff') mapLabel.textContent = 'Takeoff';
        else if (mapId === 'vacant') mapLabel.textContent = 'Vacant';
        else if (mapId === 'hackney_yard') mapLabel.textContent = 'Hackney Yard';
        else if (mapId === 'hovec_sawmill') mapLabel.textContent = 'Hovec Sawmill';
        else if (mapId === 'shipment') mapLabel.textContent = 'Shipment';
        else if (mapId === 'scrapyard_2019') mapLabel.textContent = 'Scrapyard 2019';
        else if (mapId === 'suldal_harbor') mapLabel.textContent = 'Suldal Harbor';
        else if (mapId === 'dome') mapLabel.textContent = 'Dome';
        else if (mapId === 'slums') mapLabel.textContent = 'Slums';
        else if (mapId === 'nuketown_russia') mapLabel.textContent = 'Nuketown Russia';
        else if (mapId === 'meltdown') mapLabel.textContent = 'Meltdown';
        else if (mapId === 'summit') mapLabel.textContent = 'Summit';
        else if (mapId === 'hijacked') mapLabel.textContent = 'Hijacked';
        else if (mapId === 'crash') mapLabel.textContent = 'Crash';
        else if (mapId === 'crossfire') mapLabel.textContent = 'Crossfire';
        else if (mapId === 'raid') mapLabel.textContent = 'Raid';
        else if (mapId === 'nuketown') mapLabel.textContent = 'Nuketown';
        else if (mapId === 'killhouse') mapLabel.textContent = 'Killhouse';
        else if (mapId === 'hardhat') mapLabel.textContent = 'Hardhat';
        else if (mapId === 'saloon') mapLabel.textContent = 'Saloon';
        else if (mapId === 'pine') mapLabel.textContent = 'Pine';
        else if (mapId === 'king') mapLabel.textContent = 'King';
        else if (mapId === 'docks') mapLabel.textContent = 'Docks';
        else if (mapId === 'shoot_house') mapLabel.textContent = 'Shoot House';
        else if (mapId === 'cage') mapLabel.textContent = 'Cage';
        else if (mapId === 'coastal') mapLabel.textContent = 'Coastal';
        else if (mapId === 'diesel') mapLabel.textContent = 'Diesel';
        else if (mapId === 'kurohana_metropolis') mapLabel.textContent = 'Kurohana Metropolis';
        else if (mapId === 'combine') mapLabel.textContent = 'Combine';
        else if (mapId === 'cheshire_park') mapLabel.textContent = 'Cheshire Park';
        else if (mapId === 'khandor_hideout') mapLabel.textContent = 'Khandor Hideout';
        else mapLabel.textContent = '';
      }
    }

    // Export function
    function exportAsImage() {
      // Always get the currently visible map's canvas and image
      const canvas = getActiveCanvas();
      const mapImg = getActiveMapImg();
      if (!canvas || !mapImg) {
        console.error('Canvas or map image not found');
        return;
      }
      
      // Create a temporary canvas for export
      const exportCanvas = document.createElement('canvas');
      const exportCtx = exportCanvas.getContext('2d');
      
      // Use canvas dimensions (which now match the map image's aspect ratio)
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      exportCanvas.width = canvasWidth;
      exportCanvas.height = canvasHeight;
      
      // Draw the map image at canvas size
      exportCtx.drawImage(mapImg, 0, 0, canvasWidth, canvasHeight);
      
      // Draw the routes using stored coordinates and colors
      const { drawings } = getCurrentDrawingState();
      drawings.forEach(route => {
        let color = '#0af';
        let path = route;
        if (route && route.path && Array.isArray(route.path)) {
          color = route.color || '#0af';
          path = route.path;
        }
        exportCtx.strokeStyle = color;
        exportCtx.lineWidth = 2;
        exportCtx.lineCap = 'round';
        if (path.length > 0) {
          exportCtx.beginPath();
          exportCtx.moveTo(path[0].x, path[0].y);
          for (let i = 1; i < path.length; i++) {
            exportCtx.lineTo(path[i].x, path[i].y);
          }
          exportCtx.stroke();
        }
      });
      
      // Draw markers
      const markers = getCurrentMarkers();
      markers.forEach(markerData => {
        // Calculate pixel position using canvas dimensions
        const x = markerData.x * canvasWidth;
        const y = markerData.y * canvasHeight;
        // Draw marker background
        exportCtx.save();
        exportCtx.font = 'bold 18px Arial';
        exportCtx.textAlign = 'center';
        exportCtx.textBaseline = 'middle';
        exportCtx.fillStyle = markerData.color || 'rgba(0,0,0,0.8)';
        const text = markerData.text || '';
        const padding = 10;
        const metrics = exportCtx.measureText(text);
        const textWidth = metrics.width;
        const textHeight = 24;
        exportCtx.beginPath();
        exportCtx.roundRect(x - textWidth/2 - padding/2, y - textHeight/2, textWidth + padding, textHeight, 6);
        exportCtx.fill();
        // Draw marker text
        exportCtx.fillStyle = '#fff';
        exportCtx.fillText(text, x, y);
        exportCtx.restore();
      });
      
      // Export as PNG
      const link = document.createElement('a');
      link.download = 'codm_board.png';
      link.href = exportCanvas.toDataURL('image/png');
      link.click();
    }

    // Global functions
    window.deleteSelectedBoard = function() {
      const name = document.getElementById('savedBoards').value;
      if (!name || !confirm('Delete board: ' + name + '?')) return;
      
      // Remove the board from the savedBoards object
      const savedBoards = JSON.parse(localStorage.getItem('savedBoards') || '{}');
      delete savedBoards[name];
      localStorage.setItem('savedBoards', JSON.stringify(savedBoards));
      
      updateBoardList();
      resetCanvas();
      document.getElementById('currentMapLabel').textContent = 'Standoff';
    };

    window.newBoard = function() {
      resetCanvas();
      document.getElementById('currentMapLabel').textContent = 'Standoff';
      document.getElementById('savedBoards').value = '';
    };

    // Add these functions to handle the new buttons
    function addMarkerGlobal() {
      const canvas = getActiveCanvas();
      const mapContainer = canvas ? canvas.parentElement : null;
      if (!canvas || !mapContainer) return;
      const text = prompt('Enter marker text:', 'New Marker');
      if (!text) return;
      // Default to center
      const x = 0.5;
      const y = 0.5;
      // Always use the global currentMarkerColor
      const color = currentMarkerColor;
      const marker = createMarker(text, x, y, false, color);
      mapContainer.appendChild(marker);
      getCurrentMarkers().push({ text, x, y, color });
      
      // Auto-save uploaded map data
      if (currentMap.startsWith('uploaded_')) {
        saveUploadedMaps();
      }
    }

    // Refactor sidebar button handlers to always use the active map/canvas/markers
    function getActiveCanvas() {
      const activeMap = document.getElementById(currentMap);
      return activeMap ? activeMap.querySelector('canvas') : null;
    }
    function getActiveMapImg() {
      const activeMap = document.getElementById(currentMap);
      return activeMap ? activeMap.querySelector('img') : null;
    }
    function getActiveMarkers() {
      return markers;
    }

    // Board management functions
    function updateBoardList() {
      const savedBoards = JSON.parse(localStorage.getItem('savedBoards') || '{}');
      const select = document.getElementById('savedBoards');
      select.innerHTML = '<option value="">Select a saved board</option>';
      
      Object.keys(savedBoards).forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        select.appendChild(option);
      });
    }

    window.loadBoard = function() {
      const boardName = document.getElementById('savedBoards').value;
      if (!boardName) return;
      const savedBoards = JSON.parse(localStorage.getItem('savedBoards') || '{}');
      const boardData = savedBoards[boardName];
      if (!boardData) return;
      
      // Switch to the correct map
      switchMap(boardData.mapId);
      
      // Restore drawings
      if (boardData.drawings) {
        const { drawings, undone } = getCurrentDrawingState();
        drawings.length = 0; // Clear current drawings
        undone.length = 0;   // Clear undo stack
        drawings.push(...boardData.drawings); // Restore saved drawings
        redraw(); // Redraw the canvas
      }
      
      // Restore markers
      mapMarkers[boardData.mapId] = boardData.markers || [];
      updateMarkers();
    };

    // Update updateMarkers to use per-map markers
    function updateMarkers() {
      document.querySelectorAll('.text-marker').forEach(m => m.remove());
      const activeMap = document.querySelector('.map-entry:not([style*="display: none"]) .map-container');
      if (!activeMap) return;
      const markers = getCurrentMarkers();
      markers.forEach(markerData => {
        const marker = createMarker(markerData.text, markerData.x, markerData.y, true, markerData.color);
        activeMap.appendChild(marker);
      });
    }

    // Improved createMarker function with color support
    function createMarker(text, x, y, isRestoring, color) {
      const marker = document.createElement('div');
      marker.className = 'text-marker';
      marker.textContent = text;
      const container = document.querySelector('.map-entry:not([style*="display: none"]) .map-container');
      const pos = fractionToStylePos(x, y, container);
      marker.style.left = pos.left;
      marker.style.top = pos.top;
      marker.style.transform = `rotate(${getRotation(container)}deg)`;
      marker.draggable = true;
      marker.tabIndex = 0;
      marker.setAttribute('aria-label', `Tactical marker: ${text}`);
      // Set marker background color
      const markerColor = color || '#0af';
      marker.style.background = markerColor;
      // Set marker text color for contrast
      marker.style.color = getContrastYIQ(markerColor);
      // Drag logic (mouse)
      marker.addEventListener('dragstart', function(e) {
        e.dataTransfer.setData('text/plain', '');
        this.style.opacity = '0.5';
        marker._dragStartX = e.clientX;
        marker._dragStartY = e.clientY;
        marker._origLeft = parseFloat(marker.style.left);
        marker._origTop = parseFloat(marker.style.top);
      });
      marker.addEventListener('dragend', function(e) {
        this.style.opacity = '1';
        const mapContainer = marker.parentElement;
        const pos = getContainerFraction(e, mapContainer);
        const stylePos = fractionToStylePos(pos.x, pos.y, mapContainer);
        this.style.left = stylePos.left;
        this.style.top = stylePos.top;
        this.style.transform = `rotate(${getRotation(mapContainer)}deg)`;
        // Update marker in array
        const markers = getCurrentMarkers();
        const idx = Array.from(mapContainer.querySelectorAll('.text-marker')).indexOf(marker);
        if (markers[idx]) {
          markers[idx].x = pos.x;
          markers[idx].y = pos.y;
          // Auto-save uploaded map data
          if (currentMap.startsWith('uploaded_')) {
            saveUploadedMaps();
          }
        }
      });
      // Touch drag logic
      let touchDragging = false;
      marker.addEventListener('touchstart', function(e) {
        if (e.touches.length !== 1) return;
        touchDragging = true;
        marker.style.opacity = '0.5';
      }, { passive: false });
      marker.addEventListener('touchmove', function(e) {
        if (!touchDragging || e.touches.length !== 1) return;
        e.preventDefault();
        const mapContainer = marker.parentElement;
        const pos = getContainerFraction(e, mapContainer);
        const stylePos = fractionToStylePos(pos.x, pos.y, mapContainer);
        marker.style.left = stylePos.left;
        marker.style.top = stylePos.top;
      }, { passive: false });
      marker.addEventListener('touchend', function(e) {
        if (!touchDragging) return;
        touchDragging = false;
        marker.style.opacity = '1';
        const mapContainer = marker.parentElement;
        const pos = getContainerFraction(e, mapContainer);
        const stylePos = fractionToStylePos(pos.x, pos.y, mapContainer);
        marker.style.left = stylePos.left;
        marker.style.top = stylePos.top;
        marker.style.transform = `rotate(${getRotation(mapContainer)}deg)`;
        const markers = getCurrentMarkers();
        const idx = Array.from(mapContainer.querySelectorAll('.text-marker')).indexOf(marker);
        if (markers[idx]) {
          markers[idx].x = pos.x;
          markers[idx].y = pos.y;
          if (currentMap.startsWith('uploaded_')) {
            saveUploadedMaps();
          }
        }
      }, { passive: false });
      // Double-click to edit
      marker.addEventListener('dblclick', function() {
        const newText = prompt('Edit marker text:', marker.textContent);
        if (newText) {
          marker.textContent = newText;
          marker.setAttribute('aria-label', `Tactical marker: ${newText}`);
          // Update marker in array
          const mapContainer = marker.parentElement;
          const markers = getCurrentMarkers();
          const idx = Array.from(mapContainer.querySelectorAll('.text-marker')).indexOf(marker);
          if (markers[idx]) {
            markers[idx].text = newText;
            // Ensure color is preserved
            markers[idx].color = color;
            // Auto-save uploaded map data
            if (currentMap.startsWith('uploaded_')) {
              saveUploadedMaps();
            }
          }
        }
      });
      // Right-click to delete
      marker.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        const mapContainer = marker.parentElement;
        const markers = getCurrentMarkers();
        const idx = Array.from(mapContainer.querySelectorAll('.text-marker')).indexOf(marker);
        if (idx > -1) {
          markers.splice(idx, 1);
        }
        marker.remove();
      });
      return marker;
    }

    // Keyboard shortcuts for Undo/Redo
    document.addEventListener('keydown', function(e) {
      // Ignore if focused on input or textarea
      const tag = document.activeElement.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      // Undo: Ctrl+Z or Cmd+Z
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undoDrawing();
      }
      // Redo: Ctrl+Y or Ctrl+Shift+Z or Cmd+Shift+Z
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        e.preventDefault();
        redoDrawing();
      }
    });

    // Sidebar toggle for mobile and sidebar logic
    document.addEventListener('DOMContentLoaded', function() {
      var mapSelect = document.getElementById('sidebarMapSelect');
      if (mapSelect) mapSelect.selectedIndex = 0;
      const sidebar = document.querySelector('.sidebar');
      const toggleBtn = document.getElementById('sidebarToggle');

      function closeSidebar() {
        sidebar.classList.remove('open');
        var overlay = document.getElementById('sidebarOverlay');
        if (overlay) overlay.style.display = 'none';
      }
      function openSidebar() {
        sidebar.classList.add('open');
        var overlay = document.getElementById('sidebarOverlay');
        if (overlay) overlay.style.display = 'block';
      }
      function setSidebarInitialState() {
        if (window.innerWidth <= 768) {
          closeSidebar(); // Always closed on mobile by default
        } else {
          openSidebar();  // Always open on desktop
        }
      }
      if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          openSidebar();
        });
        var overlay = document.getElementById('sidebarOverlay');
        if (overlay) {
          overlay.addEventListener('click', function() {
            closeSidebar();
          });
        }
      }
      setSidebarInitialState();
      window.addEventListener('resize', setSidebarInitialState);
    });

    // FAB logic for mobile
    function isMobile() {
      return window.innerWidth <= 768;
    }
    function closeFabMenu() {
      document.getElementById('fab').classList.remove('open');
    }
    document.addEventListener('DOMContentLoaded', function() {
      // ... existing sidebar toggle ...
      // FAB setup
      const fab = document.getElementById('fab');
      const fabMainBtn = document.getElementById('fabMainBtn');
      const fabMenu = document.getElementById('fabMenu');
      if (fab && fabMainBtn && fabMenu) {
        fabMainBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          const isOpen = fab.classList.toggle('open');
          fabMainBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });
        // Close FAB menu when clicking outside
        document.addEventListener('click', function(e) {
          if (isMobile() && fab.classList.contains('open') && !fab.contains(e.target)) {
            closeFabMenu();
          }
        });
        // FAB actions
        document.getElementById('fabAddMarker').onclick = function() { addMarkerGlobal(); closeFabMenu(); };
        document.getElementById('fabSaveBoard').onclick = function() { saveBoard(); closeFabMenu(); };
        document.getElementById('fabExportBoard').onclick = function() { exportAsImage(); closeFabMenu(); };
        document.getElementById('fabClearBoard').onclick = function() { resetCanvas(); closeFabMenu(); };
        document.getElementById('fabUndo').onclick = function() { undoDrawing(); closeFabMenu(); };
        document.getElementById('fabRedo').onclick = function() { redoDrawing(); closeFabMenu(); };
        document.getElementById('fabInstall').onclick = function() { installApp(); closeFabMenu(); };
      }
    });

    // Color button logic (single handler for marker color)
    document.addEventListener('DOMContentLoaded', function() {
      // Route color buttons
      const routeBtns = document.querySelectorAll('.route-color-btn');
      routeBtns.forEach(btn => {
        btn.addEventListener('click', function() {
          currentRouteColor = btn.getAttribute('data-color');
          routeBtns.forEach(b => b.style.outline = 'none');
          btn.style.outline = `2px solid ${currentRouteColor}`;
        });
      });
      // Marker color buttons (single handler)
      const markerBtns = document.querySelectorAll('.marker-color-btn');
      markerBtns.forEach(btn => {
        btn.addEventListener('click', function() {
          currentMarkerColor = btn.getAttribute('data-color');
          markerBtns.forEach(b => b.style.outline = 'none');
          btn.style.outline = `2px solid ${currentMarkerColor}`;
          updateAddMarkerButtons();
        });
      });
      // Set default outline on page load
      markerBtns.forEach(btn => {
        if (btn.getAttribute('data-color') === currentMarkerColor) {
          btn.style.outline = `2px solid ${currentMarkerColor}`;
        }
      });
      updateAddMarkerButtons();
    });

    // Ensure FAB/mobile Add Marker also uses the correct color
    document.addEventListener('DOMContentLoaded', function() {
      const fabAddMarkerBtn = document.getElementById('fabAddMarker');
      if (fabAddMarkerBtn) {
        fabAddMarkerBtn.onclick = function() { addMarkerGlobal(); closeFabMenu(); };
      }
    });

    // Wire up Add Marker buttons after DOM is loaded
    document.addEventListener('DOMContentLoaded', function() {
      var sidebarAddMarkerBtn = document.getElementById('sidebarAddMarkerBtn');
      if (sidebarAddMarkerBtn) {
        sidebarAddMarkerBtn.onclick = addMarkerGlobal;
      }
      var fabAddMarkerBtn = document.getElementById('fabAddMarker');
      if (fabAddMarkerBtn) {
        fabAddMarkerBtn.onclick = function() { addMarkerGlobal(); closeFabMenu(); };
      }
    });

    // Check for Update button logic
    document.addEventListener('DOMContentLoaded', function() {
      const checkUpdateBtn = document.getElementById('checkUpdateBtn');
      if (checkUpdateBtn) {
        checkUpdateBtn.onclick = function() {
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistration().then(function(reg) {
              if (reg) {
                reg.update().then(function() {
                  if (reg.waiting) {
                    reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                    setTimeout(function() { window.location.reload(); }, 500);
                  } else {
                    alert('No update available.');
                  }
                });
              } else {
                alert('No service worker registered.');
              }
            });
          } else {
            alert('Service workers are not supported in this browser.');
          }
        };
      }
    });

    // 1. Hardcoded bomb sites and spawns for 'standoff'
    const mapSitesAndSpawns = {
      standoff: {
        bombSites: [
          { type: "A", x: 0.209, y: 0.425 },
          { type: "B", x: 0.409, y: 0.587 }
        ],
        spawns: [
          { type: "attacker", x: 0.649, y: 0.207 },
          { type: "defender", x: 0.209, y: 0.768 }
        ]
      }
      // Add more maps as needed
    };

    // 2. Draw bomb sites and spawns on the canvas
    function drawSitesAndSpawns() {
      const canvas = getActiveCanvas();
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const mapData = mapSitesAndSpawns[currentMap];
      if (!mapData) return;

      // Bomb Sites
      mapData.bombSites.forEach(site => {
        const x = site.x * canvas.width;
        const y = site.y * canvas.height;
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, 18, 0, 2 * Math.PI);
        ctx.fillStyle = site.type === "A" ? "#e53935" : "#1976d2";
        ctx.fill();
        ctx.font = "bold 18px Arial";
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(site.type, x, y);
        ctx.restore();
      });

      // Spawns
      mapData.spawns.forEach(spawn => {
        const x = spawn.x * canvas.width;
        const y = spawn.y * canvas.height;
        ctx.save();
        // Use compact label
        const label = spawn.type === "attacker" ? "Atk" : "Def";
        ctx.font = "bold 13px Arial";
        const rectWidth = 40;
        const rectHeight = 22;
        const radius = 6;
        // Draw smaller rounded rectangle
        ctx.beginPath();
        ctx.moveTo(x - rectWidth/2 + radius, y - rectHeight/2);
        ctx.lineTo(x + rectWidth/2 - radius, y - rectHeight/2);
        ctx.quadraticCurveTo(x + rectWidth/2, y - rectHeight/2, x + rectWidth/2, y - rectHeight/2 + radius);
        ctx.lineTo(x + rectWidth/2, y + rectHeight/2 - radius);
        ctx.quadraticCurveTo(x + rectWidth/2, y + rectHeight/2, x + rectWidth/2 - radius, y + rectHeight/2);
        ctx.lineTo(x - rectWidth/2 + radius, y + rectHeight/2);
        ctx.quadraticCurveTo(x - rectWidth/2, y + rectHeight/2, x - rectWidth/2, y + rectHeight/2 - radius);
        ctx.lineTo(x - rectWidth/2, y - rectHeight/2 + radius);
        ctx.quadraticCurveTo(x - rectWidth/2, y - rectHeight/2, x - rectWidth/2 + radius, y - rectHeight/2);
        ctx.closePath();
        ctx.fillStyle = spawn.type === "attacker" ? "#ff9800" : "#43a047";
        ctx.fill();
        // Draw text
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, x, y);
        ctx.restore();
      });
    }

    // Image upload and processing functions
    function isStorageNearLimit(newDataSizeBytes = 0) {
      let total = 0;
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          total += ((localStorage[key].length + key.length) * 2); // bytes
        }
      }
      return (total + newDataSizeBytes) > 4.9 * 1024 * 1024; // ~5MB
    }

    function resizeImage(file) {
      return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = function() {
          // Calculate new dimensions (max 1920px width or height)
          const maxSize = 1920;
          let { width, height } = img;
          
          if (width > height) {
            if (width > maxSize) {
              height = (height * maxSize) / width;
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width = (width * maxSize) / height;
              height = maxSize;
            }
          }
          
          // Resize image
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);
          
          // Convert to base64
          const base64 = canvas.toDataURL('image/jpeg', 0.9);
          resolve(base64);
        };
        
        img.src = URL.createObjectURL(file);
      });
    }

    function addUploadedMap(base64Data, fileName) {
      uploadCounter++;
      const mapId = `uploaded_${uploadCounter}`;
      const mapName = fileName.replace(/\.[^/.]+$/, ""); // Remove file extension
      
      // Create map entry HTML
      const mapEntry = document.createElement('div');
      mapEntry.className = 'map-entry';
      mapEntry.id = mapId;
      mapEntry.style.display = 'none';
      
      mapEntry.innerHTML = `
        <div class="map-container">
          <!-- .map-content wrapper exists only to sync rotation between image and canvas -->
          <div class="map-content">
            <img id="${mapId}MapImage" src="${base64Data}" alt="${mapName} Map">
            <canvas id="${mapId}DrawingCanvas"></canvas>
          </div>
        </div>
      `;
      
      // Add to main content
      document.querySelector('main').appendChild(mapEntry);
      
      // Add to custom uploaded maps list
      addToUploadedMapsList(mapId, mapName);
      
      // Store map data
      uploadedMaps[mapId] = {
        name: mapName,
        base64: base64Data
      };
      
      // Setup canvas for the new map with improved timing for uploaded maps
      const canvas = document.getElementById(`${mapId}DrawingCanvas`);
      if (canvas) {
        setupCanvas(canvas);
        // Additional delay for uploaded maps to ensure proper rendering
        requestAnimationFrame(() => {
          setTimeout(() => {
            const mapImg = document.getElementById(`${mapId}MapImage`);
            if (mapImg && mapImg.complete) {
              // Trigger a single resize for the uploaded map
              const canvas = document.getElementById(`${mapId}DrawingCanvas`);
              if (canvas && canvas.dataset.resized !== 'true') {
                // Direct resize call with debouncing
                if (canvas.resizeTimeout) {
                  clearTimeout(canvas.resizeTimeout);
                }
                canvas.resizeTimeout = setTimeout(() => {
                  if (canvas.dataset.resized !== 'true') {
                    canvas.dataset.resized = 'true';
                    const parent = canvas.parentElement;
                    const img = parent.querySelector('img');
                    if (img && img.complete && img.naturalWidth > 0) {
                      const rect = img.getBoundingClientRect();
                      const width = Math.round(rect.width);
                      const height = Math.round(rect.height);
                      if (width > 0 && height > 0) {
                        canvas.width = width;
                        canvas.height = height;
                        canvas.style.width = width + 'px';
                        canvas.style.height = height + 'px';
                        canvas.style.left = '0px';
                        canvas.style.top = '0px';
                        redraw();
                      }
                    }
                    setTimeout(() => {
                      canvas.dataset.resized = 'false';
                    }, 100);
                  }
                }, 50);
              }
            }
          }, 100);
        });
      }
      
      // Add to drawing state
      mapDrawings[mapId] = { drawings: [], undone: [] };
      mapMarkers[mapId] = [];
      
      // Save to localStorage
      saveUploadedMaps();
      
      return mapId;
    }

    function handleImageUpload(file) {
      const statusDiv = document.getElementById('uploadStatus');
      statusDiv.textContent = 'Processing image...';
      statusDiv.className = 'upload-status';
      
      resizeImage(file)
        .then(base64Data => {
          // Storage limit check before saving
          if (isStorageNearLimit(base64Data.length * 2)) {
            alert('Storage is full. Please delete older uploads to continue.');
            statusDiv.textContent = '';
            statusDiv.className = 'upload-status';
            document.getElementById('imageUpload').value = '';
            return;
          }
          const mapId = addUploadedMap(base64Data, file.name);
          
          // Switch to the uploaded map
          switchMap(mapId);
          
          // Update selector
          const mapSelector = document.getElementById('sidebarMapSelect');
          mapSelector.value = mapId;
          
          statusDiv.textContent = 'Upload successful!';
          statusDiv.className = 'upload-status success';
          
          // Clear the file input
          document.getElementById('imageUpload').value = '';
        })
        .catch(error => {
          console.error('Upload error:', error);
          statusDiv.textContent = 'Upload failed. Please try again.';
          statusDiv.className = 'upload-status error';
        });
    }

    // Rename functionality
    function renameUploadedMap(mapId) {
      const currentName = uploadedMaps[mapId]?.name || '';
      const newName = prompt('Enter new name for this map:', currentName);
      
      if (newName && newName.trim() && newName !== currentName) {
        // Update the stored name
        uploadedMaps[mapId].name = newName.trim();
        
        // Update the display
        updateUploadedMapName(mapId, newName.trim());
        
        // Update the alt text of the image
        const mapImg = document.getElementById(`${mapId}MapImage`);
        if (mapImg) {
          mapImg.alt = `${newName.trim()} Map`;
        }
        
        // Save to localStorage
        saveUploadedMaps();
        
        console.log(`Map renamed from "${currentName}" to "${newName.trim()}"`);
      }
    }

    function createRenameButton(mapId) {
      const button = document.createElement('button');
      button.className = 'rename-btn';
      button.innerHTML = '✏️';
      button.title = 'Rename this map';
      button.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        renameUploadedMap(mapId);
      };
      return button;
    }

    function addToUploadedMapsList(mapId, mapName) {
      const uploadedMapsList = document.getElementById('uploadedMapsList');
      if (!uploadedMapsList) return;
      
      const mapItem = document.createElement('div');
      mapItem.className = 'uploaded-map-item';
      mapItem.setAttribute('data-map-id', mapId);
      
      const mapNameSpan = document.createElement('span');
      mapNameSpan.className = 'uploaded-map-name';
      mapNameSpan.textContent = `📁 ${mapName}`;
      
      const renameBtn = createRenameButton(mapId);
      // Create Delete button
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'rename-btn';
      deleteBtn.innerHTML = '🗑️';
      deleteBtn.title = 'Delete this map';
      deleteBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (confirm('Delete this uploaded map?')) {
          // Remove from uploadedMaps
          delete uploadedMaps[mapId];
          // Remove drawing and marker state
          delete mapDrawings[mapId];
          delete mapMarkers[mapId];
          // Remove map entry from DOM
          const mapEntry = document.getElementById(mapId);
          if (mapEntry) mapEntry.remove();
          // Save to localStorage
          saveUploadedMaps();
          // Re-render uploaded maps list
          renderUploadedMapsList();
          // If the deleted map was selected, switch to the first built-in map
          if (currentMap === mapId) {
            const mapSelector = document.getElementById('sidebarMapSelect');
            if (mapSelector && mapSelector.options.length > 0) {
              for (let i = 0; i < mapSelector.options.length; i++) {
                if (!mapSelector.options[i].value.startsWith('uploaded_')) {
                  switchMap(mapSelector.options[i].value);
                  mapSelector.value = mapSelector.options[i].value;
                  break;
                }
              }
            }
          }
        }
      };
      
      mapItem.appendChild(mapNameSpan);
      mapItem.appendChild(renameBtn);
      mapItem.appendChild(deleteBtn);
      
      // Add click handler to switch to this map
      mapItem.addEventListener('click', (e) => {
        if (e.target !== renameBtn) {
          switchMap(mapId);
          updateSelectedMapItem(mapId);
        }
      });
      
      // Insert at the top of the list
      if (uploadedMapsList.firstChild) {
        uploadedMapsList.insertBefore(mapItem, uploadedMapsList.firstChild);
      } else {
        uploadedMapsList.appendChild(mapItem);
      }
    }

    // Helper to re-render the uploaded maps list
    function renderUploadedMapsList() {
      const uploadedMapsList = document.getElementById('uploadedMapsList');
      if (!uploadedMapsList) return;
      uploadedMapsList.innerHTML = '';
      Object.keys(uploadedMaps).forEach(mapId => {
        addToUploadedMapsList(mapId, uploadedMaps[mapId].name);
      });
    }

    function updateSelectedMapItem(mapId) {
      // Remove selected class from all items
      document.querySelectorAll('.uploaded-map-item').forEach(item => {
        item.classList.remove('selected');
      });
      
      // Add selected class to current map
      const currentItem = document.querySelector(`[data-map-id="${mapId}"]`);
      if (currentItem) {
        currentItem.classList.add('selected');
      }
    }

    function updateUploadedMapName(mapId, newName) {
      // Update in the custom list
      const mapItem = document.querySelector(`[data-map-id="${mapId}"]`);
      if (mapItem) {
        const nameSpan = mapItem.querySelector('.uploaded-map-name');
        if (nameSpan) {
          nameSpan.textContent = `📁 ${newName}`;
        }
      }
    }

    // Render uploaded images with delete buttons (for keys starting with 'upload_')
    function renderUploads() {
      const container = document.getElementById('uploadsContainer');
      if (!container) return;
      container.innerHTML = '';
      let found = false;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('upload_')) {
          found = true;
          const dataUrl = localStorage.getItem(key);
          const wrapper = document.createElement('div');
          wrapper.style.display = 'flex';
          wrapper.style.alignItems = 'center';
          wrapper.style.marginBottom = '0.5rem';
          const img = document.createElement('img');
          img.src = dataUrl;
          img.alt = key;
          img.style.maxWidth = '60px';
          img.style.maxHeight = '60px';
          img.style.marginRight = '0.5rem';
          img.style.borderRadius = '6px';
          img.style.border = '1px solid #333';
          const delBtn = document.createElement('button');
          delBtn.textContent = '🗑️ Delete';
          delBtn.style.marginLeft = '0.5rem';
          delBtn.style.background = '#222';
          delBtn.style.color = '#ff4444';
          delBtn.style.border = '1px solid #444';
          delBtn.style.borderRadius = '5px';
          delBtn.style.cursor = 'pointer';
          delBtn.onclick = function() {
            localStorage.removeItem(key);
            renderUploads();
          };
          wrapper.appendChild(img);
          wrapper.appendChild(delBtn);
          container.appendChild(wrapper);
        }
      }
      if (!found) {
        container.innerHTML = '<div style="color:#888;font-size:0.95em;">No uploaded images found.</div>';
      }
    }

    // Call renderUploads on page load
    document.addEventListener('DOMContentLoaded', renderUploads);

    // Robust map rotation logic - targets .map-content to rotate both image and canvas together
    function rotateActiveMap() {
      // Find the currently visible map entry by checking all map entries
      let visibleMapEntry = null;
      const allMapEntries = document.querySelectorAll('.map-entry');
      
      for (const entry of allMapEntries) {
        if (entry.style.display !== 'none' && entry.offsetParent !== null) {
          visibleMapEntry = entry;
          break;
        }
      }
      
      if (!visibleMapEntry) {
        console.warn('No visible map entry found for rotation');
        return;
      }
      
      // Get the map content wrapper within the visible map entry - this wraps both image and canvas
      const activeMapContent = visibleMapEntry.querySelector('.map-content');
      if (!activeMapContent) {
        console.warn('No map content wrapper found in visible map entry:', visibleMapEntry.id);
        return;
      }
      
      // Remove any previous rotation classes
      activeMapContent.classList.remove('rot-90', 'rot-180', 'rot-270');
      
      // Get current rotation from data attribute
      let rot = parseInt(activeMapContent.getAttribute('data-rot') || '0', 10);
      rot = (rot + 90) % 360;
      
      // Apply the correct rotation class to sync image and canvas rotation
      if (rot === 90) {
        activeMapContent.classList.add('rot-90');
      } else if (rot === 180) {
        activeMapContent.classList.add('rot-180');
      } else if (rot === 270) {
        activeMapContent.classList.add('rot-270');
      }
      
      // Save current rotation
      activeMapContent.setAttribute('data-rot', rot);

      updateMarkers();
      
      // Debug log
      console.log('Rotated map to', rot, 'degrees');
      console.log('Active map content:', activeMapContent);
      console.log('Visible map entry ID:', visibleMapEntry.id);
    }

    // Attach rotate handler after DOM is ready
    document.addEventListener('DOMContentLoaded', function() {
      const rotateBtn = document.getElementById('rotateMapBtn');
      if (rotateBtn) {
        rotateBtn.onclick = rotateActiveMap;
      }
    });
