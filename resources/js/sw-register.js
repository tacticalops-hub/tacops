  if ('serviceWorker' in navigator) {
    let registration;

    function showUpdateButton() {
      document.getElementById('update-btn').style.display = 'block';
    }

  navigator.serviceWorker.register('./sw.js').then(reg => {
      registration = reg;
      if (reg.waiting) {
        showUpdateButton();
      }
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateButton();
          }
        });
      });
    });

    document.getElementById('update-btn').onclick = function() {
      if (registration && registration.waiting) {
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          window.location.reload();
        }, { once: true });
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    };
  }
