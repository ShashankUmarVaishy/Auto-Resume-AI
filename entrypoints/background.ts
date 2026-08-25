import { useResumeStore } from '../src/store/useResumeStore';

export default defineBackground(() => {
  console.log('Hello background!', { id: browser.runtime.id });
  
  // Run store initialization to set chrome.storage.session access level immediately
  useResumeStore.getState().init();
});
