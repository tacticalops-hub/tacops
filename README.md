# CODM Tactical Map Guides - PWA

A Progressive Web App (PWA) for Call of Duty Mobile tactical map planning with drawing tools and route planning capabilities.

## Features

- **Interactive Maps**: 30+ CODM maps with tactical overlays
- **Drawing Tools**: Draw routes, strategies, and tactical plans
- **Markers**: Add and position tactical markers on maps
- **Save/Load**: Save and load your tactical boards
- **Export**: Export your plans as images
- **PWA**: Install as a native app on mobile and desktop
- **Offline**: Works offline with cached resources

## PWA Setup

### 1. Generate Icons

The app requires PWA icons in multiple sizes. To generate them:

1. Open `create-icons.html` in a web browser
2. Click "Generate All Icons" 
3. Download each icon and place them in the `icons/` directory with these names:
   - `icon-72x72.png`
   - `icon-96x96.png`
   - `icon-128x128.png`
   - `icon-144x144.png`
   - `icon-152x152.png`
   - `icon-192x192.png`
   - `icon-384x384.png`
   - `icon-512x512.png`

### 2. Deploy to HTTPS

PWAs require HTTPS to work properly. Deploy the files to a web server with SSL.

### 3. Install the App

Once deployed:
- **Mobile**: Open in Chrome/Safari and tap "Add to Home Screen"
- **Desktop**: Open in Chrome and click the install icon in the address bar

## File Structure

```
/
├── index.html          # Main app file
├── manifest.json       # PWA manifest
├── sw.js              # Service worker
├── icon.svg           # Base icon for generation
├── create-icons.html  # Icon generator
├── icons/             # PWA icons directory
│   ├── icon-72x72.png
│   ├── icon-96x96.png
│   └── ...
├── *.png              # Map images
└── README.md          # This file
```

## PWA Features

- **Offline Support**: All maps and resources cached for offline use
- **App-like Experience**: Full-screen standalone mode
- **Installable**: Can be installed on home screen
- **Fast Loading**: Cached resources for instant loading
- **Background Sync**: Ready for future offline features
- **Push Notifications**: Framework ready for notifications

## Browser Support

- Chrome 67+ (Desktop & Mobile)
- Firefox 67+ (Desktop & Mobile)
- Safari 11.1+ (iOS 11.3+)
- Edge 79+

## Development

To test locally:

1. Use a local HTTPS server (required for service worker)
2. Generate and place icons in `icons/` directory
3. Open in supported browser
4. Check browser dev tools for PWA status

## License

Fan-made project. Not affiliated with Activision. All rights belong to their respective owners. 