    document.addEventListener('DOMContentLoaded', function() {
      // Set default outline for marker color buttons
      const markerBtns = document.querySelectorAll('.marker-color-btn');
      markerBtns.forEach(btn => {
        if (btn.getAttribute('data-color') === currentMarkerColor) {
          btn.style.outline = `2px solid ${currentMarkerColor}`;
        }
      });
    });

