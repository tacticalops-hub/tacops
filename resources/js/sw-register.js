  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      if (reg.waiting) {
        document.getElementById('update-btn').style.display = 'block';
      }
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            document.getElementById('update-btn').style.display = 'block';
          }
        });
      });
    });
    document.getElementById('update-btn').onclick = function() {
      location.reload();
    };
  }
