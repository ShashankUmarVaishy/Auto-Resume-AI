import React from 'react';
import ReactDOM from 'react-dom/client';
import PopoverElement from './content/PopoverElement';
import styleText from '../assets/tailwind.css?inline';

export default defineContentScript({
  matches: ['*://*/*'],
  cssInjectionMode: 'ui',
  main(ctx) {
    // 1. Create root element for shadow host
    const host = document.createElement('div');
    host.id = 'autoresume-host';
    
    // Style the shadow host to sit fixed on top of the viewport
    // but transparent to pointer-events so it doesn't block underlying page interactions
    host.style.position = 'fixed';
    host.style.top = '0';
    host.style.left = '0';
    host.style.width = '100vw';
    host.style.height = '100vh';
    host.style.pointerEvents = 'none';
    host.style.zIndex = '2147483647'; // Max z-index
    
    document.body.appendChild(host);

    // 2. Create closed Shadow DOM
    const shadow = host.attachShadow({ mode: 'closed' });

    // 3. Inject compiled Tailwind styles inside the Shadow root
    const styleEl = document.createElement('style');
    styleEl.textContent = styleText;
    shadow.appendChild(styleEl);

    // 4. Create React render mountpoint
    const rootEl = document.createElement('div');
    rootEl.id = 'autoresume-app-root';
    shadow.appendChild(rootEl);

    // 5. Mount React popover element
    const reactRoot = ReactDOM.createRoot(rootEl);
    reactRoot.render(React.createElement(PopoverElement));

    // Register cleanup hooks for extension unloading / HMR refreshes
    ctx.onInvalidated(() => {
      reactRoot.unmount();
      host.remove();
    });
  },
});
