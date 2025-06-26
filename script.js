let drawing = false;
let path = [];
let drawings = [];
let undone = [];
let markers = [];
let lastRenderTime = 0;
let lastMarkerUpdate = 0;
const RENDER_INTERVAL = 16; // ~60fps
const PATH_OPTIMIZATION_THRESHOLD = 2; // Minimum distance between points
const MARKER_UPDATE_THROTTLE = 100; // ms between marker updates

// Optimize path by reducing points
function optimizePath(points) {
  if (points.length <= 2) return points;
  
  const optimized = [points[0]];
  let lastPoint = points[0];
  
  for (let i = 1; i < points.length - 1; i++) {
    const current = points[i];
    const next = points[i + 1];
    
    // Only add point if it's significantly different from last point
    if (Math.abs(current.x - lastPoint.x) > PATH_OPTIMIZATION_THRESHOLD || 
        Math.abs(current.y - lastPoint.y) > PATH_OPTIMIZATION_THRESHOLD) {
      optimized.push(current);
      lastPoint = current;
    }
  }
  
  optimized.push(points[points.length - 1]);
  return optimized;
}

// Optimized redraw function with requestAnimationFrame
function redraw() {
  const now = performance.now();
  if (now - lastRenderTime < RENDER_INTERVAL) {
    requestAnimationFrame(redraw);
    return;
  }
  lastRenderTime = now;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Use a single path for all drawings
  ctx.beginPath();
  drawings.forEach(path => {
    if (!path.length) return;
    
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) {
      ctx.lineTo(path[i].x, path[i].y);
    }
  });
  ctx.stroke();
  
  // Draw arrowheads in a separate pass
  drawings.forEach(path => {
    if (path.length > 1) {
      const last = path[path.length - 1];
      const secondLast = path[path.length - 2];
      drawArrowhead(ctx, secondLast.x, secondLast.y, last.x, last.y);
    }
  });
}

function drawArrowhead(ctx, fromX, fromY, toX, toY) {
  const headlen = 10;
  const angle = Math.atan2(toY - fromY, toX - fromX);
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
  ctx.lineTo(toX, toY);
  ctx.fillStyle = ctx.strokeStyle;
  ctx.fill();
}

function getCanvasCoords(e) {
  const rect = canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

// Enhanced error handling and user feedback
function handleError(error, context) {
  console.error(`Error in ${context}:`, error);
  showFeedback(`Error: ${error.message}`, 'error');
}

function showFeedback(message, type = 'info') {
  const feedback = document.createElement('div');
  feedback.textContent = message;
  feedback.style.position = 'fixed';
  feedback.style.top = '20px';
  feedback.style.left = '50%';
  feedback.style.transform = 'translateX(-50%)';
  feedback.style.padding = '10px';
  feedback.style.borderRadius = '5px';
  feedback.style.zIndex = '1000';
  
  // Style based on feedback type
  switch(type) {
    case 'error':
      feedback.style.background = '#ff4444';
      feedback.style.color = '#fff';
      break;
    case 'success':
      feedback.style.background = '#44ff44';
      feedback.style.color = '#000';
      break;
    default:
      feedback.style.background = '#0af';
      feedback.style.color = '#000';
  }
  
  document.body.appendChild(feedback);
  setTimeout(() => feedback.remove(), 3000);
}

// Enhanced save function with error handling
window.saveCurrentBoard = function () {
  try {
    const name = prompt('Enter board name:');
    if (!name) return;
    
    if (name.length > 50) {
      throw new Error('Board name must be less than 50 characters');
    }
    
    const data = {
      drawings,
      markers: markers.map(m => ({ 
        text: m.textContent, 
        left: m.style.left, 
        top: m.style.top 
      }))
    };
    
    localStorage.setItem('board_' + name, JSON.stringify(data));
    updateBoardList();
    mapTitle.textContent = `Standoff Tactical Map — ${name}`;
    showFeedback(`Board saved as ${name}`, 'success');
  } catch (error) {
    handleError(error, 'saveCurrentBoard');
  }
};

// Optimized board loading
window.loadSelectedBoard = function () {
  try {
    const name = boardSelect.value;
    if (!name) return;
    
    const saved = localStorage.getItem('board_' + name);
    if (!saved) {
      throw new Error('Board not found');
    }
    
    resetCanvas();
    const data = JSON.parse(saved);
    
    if (!data.drawings || !Array.isArray(data.drawings)) {
      throw new Error('Invalid board data format');
    }
    
    // Batch marker creation
    const fragment = document.createDocumentFragment();
    drawings = data.drawings;
    
    if (data.markers) {
      data.markers.forEach(({ text, left, top }) => {
        if (!text || !left || !top) {
          console.warn('Invalid marker data:', { text, left, top });
          return;
        }
        const marker = createMarker(text, parseInt(left), parseInt(top));
        fragment.appendChild(marker);
        markers.push(marker);
      });
    }
    
    canvas.parentElement.appendChild(fragment);
    redraw();
    mapTitle.textContent = `Standoff Tactical Map — ${name}`;
    showFeedback(`Board loaded: ${name}`, 'success');
  } catch (error) {
    handleError(error, 'loadSelectedBoard');
    resetCanvas();
  }
};

// Enhanced delete function with error handling
window.deleteSelectedBoard = function () {
  try {
    const name = boardSelect.value;
    if (!name) {
      showFeedback('Please select a board to delete', 'error');
      return;
    }
    
    if (!confirm(`Are you sure you want to delete board: ${name}?`)) {
      return;
    }
    
    localStorage.removeItem('board_' + name);
    updateBoardList();
    resetCanvas();
    mapTitle.textContent = 'Standoff Tactical Map';
    showFeedback(`Board deleted: ${name}`, 'success');
  } catch (error) {
    handleError(error, 'deleteSelectedBoard');
  }
};

// Optimized marker creation
function createMarker(text, x, y) {
  if (!text || typeof text !== 'string') {
    throw new Error('Invalid marker text');
  }
  
  if (isNaN(x) || isNaN(y)) {
    throw new Error('Invalid marker coordinates');
  }
  
  const marker = document.createElement('div');
  marker.className = 'text-marker';
  marker.textContent = text;
  marker.style.left = `${x}px`;
  marker.style.top = `${y}px`;
  marker.setAttribute('tabindex', '0');
  marker.setAttribute('draggable', 'true');
  marker.setAttribute('aria-label', `Tactical marker: ${text}`);

  // Add optimized drag handling
  setupMarkerDrag(marker);

  // Add keyboard event listener for marker
  marker.addEventListener('keydown', function(e) {
    try {
      if (e.key === 'Enter') {
        const newText = prompt('Edit marker text:', text);
        if (newText) {
          if (newText.length > 100) {
            throw new Error('Marker text must be less than 100 characters');
          }
          marker.textContent = newText;
          marker.setAttribute('aria-label', `Tactical marker: ${newText}`);
          showFeedback('Marker updated', 'success');
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        marker.remove();
        markers = markers.filter(m => m !== marker);
        showFeedback('Marker removed', 'success');
      }
    } catch (error) {
      handleError(error, 'marker keyboard event');
    }
  });

  marker.addEventListener('contextmenu', (ev) => {
    ev.preventDefault();
    marker.remove();
    markers = markers.filter(m => m !== marker);
    showFeedback('Marker removed', 'success');
  });

  return marker;
}

// Optimized marker dragging with throttling
function setupMarkerDrag(marker) {
  let isDragging = false;
  let startX, startY;
  let originalLeft, originalTop;

  marker.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    originalLeft = parseInt(marker.style.left);
    originalTop = parseInt(marker.style.top);
    marker.style.cursor = 'grabbing';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    const now = performance.now();
    if (now - lastMarkerUpdate < MARKER_UPDATE_THROTTLE) return;
    lastMarkerUpdate = now;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    
    marker.style.left = `${originalLeft + dx}px`;
    marker.style.top = `${originalTop + dy}px`;
  });

  document.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    marker.style.cursor = 'grab';
  });
}

// Initialize canvas
window.onload = function () {
  const canvas = document.getElementById('drawingCanvas');
  const ctx = canvas.getContext('2d');
  const mapTitle = document.getElementById('mapTitle');
  const boardSelect = document.getElementById('savedBoards');

  ctx.strokeStyle = '#0af';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';

  // Drawing event handlers
  canvas.addEventListener('mousedown', (e) => {
    drawing = true;
    path = [];
    const { x, y } = getCanvasCoords(e);
    path.push({ x, y });
    ctx.beginPath();
    ctx.moveTo(x, y);
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!drawing) return;
    
    const { x, y } = getCanvasCoords(e);
    path.push({ x, y });
    ctx.lineTo(x, y);
    ctx.stroke();
  });

  canvas.addEventListener('mouseup', () => {
    if (!drawing) return;
    drawing = false;
    ctx.closePath();
    drawings.push([...path]);
    undone = [];
  });

  // Touch event handlers
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    drawing = true;
    path = [];
    const touch = e.touches[0];
    const { x, y } = getCanvasCoords(touch);
    path.push({ x, y });
    ctx.beginPath();
    ctx.moveTo(x, y);
  });

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!drawing) return;
    
    const touch = e.touches[0];
    const { x, y } = getCanvasCoords(touch);
    path.push({ x, y });
    
    const now = performance.now();
    if (now - lastRenderTime >= RENDER_INTERVAL) {
      ctx.lineTo(x, y);
      ctx.stroke();
      lastRenderTime = now;
    }
  });

  canvas.addEventListener('touchend', () => {
    if (!drawing) return;
    drawing = false;
    ctx.closePath();
    
    // Optimize the path before saving
    const optimizedPath = optimizePath(path);
    if (optimizedPath.length > 1) {
      const last = optimizedPath[optimizedPath.length - 1];
      const secondLast = optimizedPath[optimizedPath.length - 2];
      drawArrowhead(ctx, secondLast.x, secondLast.y, last.x, last.y);
    }
    
    drawings.push(optimizedPath);
    undone = [];
  });

  // Click handler for markers
  canvas.addEventListener('click', (e) => {
    if (drawing) return;
    if (!e.shiftKey) return;
    
    const label = prompt('Enter tactical text:');
    if (!label) return;
    
    const { x, y } = getCanvasCoords(e);
    const marker = createMarker(label, x, y);
    canvas.parentElement.appendChild(marker);
    markers.push(marker);
  });

  // Keyboard event listeners
  document.addEventListener('keydown', function(e) {
    // Undo/Redo shortcuts (work anywhere)
    if (e.ctrlKey) {
      if (e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redoDrawing();
        } else {
          undoDrawing();
        }
      } else if (e.key === 'y') {
        e.preventDefault();
        redoDrawing();
      }
    }
    
    // Delete to clear canvas (only when canvas is focused)
    if (e.key === 'Delete' && document.activeElement === canvas) {
      e.preventDefault();
      resetCanvas();
      showFeedback('Canvas cleared');
    }

    // Show keyboard instructions when Tab is pressed
    if (e.key === 'Tab') {
      const instructions = document.querySelector('.keyboard-instructions');
      instructions.style.display = 'block';
      // Hide instructions after 5 seconds
      setTimeout(() => {
        instructions.style.display = 'none';
      }, 5000);
    }
  });

  // Window functions
  window.resetCanvas = function () {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawings = [];
    undone = [];
    markers.forEach(m => m.remove());
    markers = [];
    showFeedback('Canvas cleared');
  };

  window.undoDrawing = function () {
    if (drawings.length > 0) {
      undone.push(drawings.pop());
      redraw();
      showFeedback('Undo');
    }
  };

  window.redoDrawing = function () {
    if (undone.length > 0) {
      drawings.push(undone.pop());
      redraw();
      showFeedback('Redo');
    }
  };

  window.newBoard = function() {
    resetCanvas();
    mapTitle.textContent = 'Standoff Tactical Map';
    boardSelect.value = '';
  };

  function updateBoardList() {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('board_')).map(k => k.replace('board_', ''));
    boardSelect.innerHTML = '<option value="">Select a board...</option>' + 
      keys.map(name => `<option value="${name}">${name}</option>`).join('');
  }

  updateBoardList();
}; 