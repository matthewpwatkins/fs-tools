/**
 * Simple toast notification utility for FS Tools
 */

/**
 * Options for configuring toast notifications
 */
interface ToastOptions {
  /** The title to display in the toast */
  title: string;
  /** The message to display in the toast */
  message: string;
  /** Optional duration in milliseconds */
  durationMs?: number;
  /** Optional URL to open when the toast is clicked */
  url?: string;
}

export class Toast {
  private static readonly TOAST_ID = 'fs-tools-toast';
  private static hasBeenDismissed = false;
  
  /**
   * Show a toast notification
   * @param options Configuration options for the toast
   */
  public static show(options: ToastOptions): void {    
    // Don't show if already dismissed once in this session
    if (Toast.hasBeenDismissed) {
      return;
    }
    
    // Remove any existing toast
    Toast.hide();
    
    // Create toast element
    const toast = document.createElement('div');
    toast.id = Toast.TOAST_ID;
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.right = '20px';
    toast.style.backgroundColor = 'rgba(51, 51, 51, 0.9)';
    toast.style.color = 'white';
    toast.style.padding = '12px 16px';
    toast.style.borderRadius = '4px';
    toast.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
    toast.style.zIndex = '10000';
    toast.style.maxWidth = '300px';
    toast.style.fontFamily = 'Arial, sans-serif';
    toast.style.fontSize = '14px';
    toast.style.transition = 'opacity 0.3s ease-in-out';
    toast.style.display = 'flex';
    toast.style.flexDirection = 'column';
    
    // Make the toast clickable if URL is provided
    if (options.url) {
      toast.style.cursor = 'pointer';
      toast.onclick = (event) => {
        // Only open URL if the click wasn't on the close button
        if (!(event.target as HTMLElement).classList.contains('fs-tools-toast-close')) {
          window.open(options.url, '_blank');
        }
      };
    }
    
    // Create header container for icon and title
    const headerContainer = document.createElement('div');
    headerContainer.style.display = 'flex';
    headerContainer.style.alignItems = 'center';
    headerContainer.style.marginBottom = '8px';
    
    // Add favicon to header
    const favicon = document.createElement('img');
    favicon.src = chrome.runtime.getURL('icons/icon-32.png');
    favicon.style.width = '24px';
    favicon.style.height = '24px';
    favicon.style.marginRight = '10px';
    
    // Add title to header
    const titleElement = document.createElement('div');
    titleElement.textContent = options.title;
    titleElement.style.fontWeight = 'bold';
    titleElement.style.flexGrow = '1';
    
    // Add close button to header
    const closeBtn = document.createElement('span');
    closeBtn.innerHTML = '&times;';
    closeBtn.classList.add('fs-tools-toast-close'); // Add class for identifying close button in click handler
    closeBtn.style.marginLeft = '10px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.fontSize = '18px';
    closeBtn.style.lineHeight = '1';
    closeBtn.onclick = (e) => {
      e.stopPropagation(); // Prevent triggering the toast's click event
      Toast.hide();
    };
    
    // Assemble the header
    headerContainer.appendChild(favicon);
    headerContainer.appendChild(titleElement);
    headerContainer.appendChild(closeBtn);
    
    // Add message below header
    const messageElement = document.createElement('div');
    messageElement.textContent = options.message;
    messageElement.style.width = '100%';
    
    // Assemble the toast
    toast.appendChild(headerContainer);
    toast.appendChild(messageElement);
    
    // Add to DOM
    document.body.appendChild(toast);

    if (options.durationMs) {
      setTimeout(Toast.hide, options.durationMs);
    }
  }
  
  /**
   * Hide the current toast if it exists
   */
  public static hide(): void {
    const existingToast = document.getElementById(Toast.TOAST_ID);
    if (existingToast) {
      existingToast.remove();
      // Mark as dismissed for this session
      Toast.hasBeenDismissed = true;
    }
  }
}
