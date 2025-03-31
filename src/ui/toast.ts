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
  private static readonly STORAGE_KEY = 'fs-tools-toast-collapsed';
  private static isCollapsed = false;
  
  /**
   * Show a toast notification
   * @param options Configuration options for the toast
   */
  public static show(options: ToastOptions): void {    
    // Load collapsed state from localStorage
    Toast.isCollapsed = localStorage.getItem(Toast.STORAGE_KEY) === 'true';
    
    // Remove any existing toast
    Toast.hide();
    
    // Create toast element
    const toast = document.createElement('div');
    toast.id = Toast.TOAST_ID;
    toast.style.position = 'fixed';
    toast.style.bottom = '10px';
    toast.style.right = '10px';
    toast.style.backgroundColor = 'rgba(51, 51, 51, 0.75)'; // More translucent
    toast.style.color = 'white';
    toast.style.padding = '12px 16px';
    toast.style.borderRadius = '4px';
    toast.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
    toast.style.zIndex = '10000';
    toast.style.maxWidth = '300px';
    toast.style.fontFamily = 'Arial, sans-serif';
    toast.style.fontSize = '14px';
    toast.style.transition = 'all 0.3s ease-in-out';
    toast.style.display = 'flex';
    toast.style.flexDirection = 'column';
    toast.style.opacity = '0.9';
    
    // Make the toast clickable if URL is provided
    if (options.url) {
      toast.style.cursor = 'pointer';
      toast.onclick = (event) => {
        // Only open URL if the click wasn't on the toggle button
        if (!(event.target as HTMLElement).classList.contains('fs-tools-toast-toggle')) {
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
    
    // Add collapse/expand toggle button
    const toggleBtn = document.createElement('span');
    toggleBtn.innerHTML = Toast.isCollapsed ? '&#9650;' : '&#9660;'; // Up arrow when collapsed, down arrow when expanded
    toggleBtn.classList.add('fs-tools-toast-toggle');
    toggleBtn.style.marginLeft = '10px';
    toggleBtn.style.cursor = 'pointer';
    toggleBtn.style.fontSize = '14px';
    toggleBtn.style.lineHeight = '1';
    toggleBtn.onclick = (e) => {
      e.stopPropagation(); // Prevent triggering the toast's click event
      Toast.toggleCollapse();
    };
    
    // Assemble the header
    headerContainer.appendChild(favicon);
    headerContainer.appendChild(titleElement);
    headerContainer.appendChild(toggleBtn);
    
    // Add message below header
    const messageElement = document.createElement('div');
    messageElement.textContent = options.message;
    messageElement.style.width = '100%';
    messageElement.style.transition = 'max-height 0.3s ease-in-out, opacity 0.3s ease-in-out';
    messageElement.style.overflow = 'hidden';
    
    // Apply collapsed state if needed
    if (Toast.isCollapsed) {
      messageElement.style.maxHeight = '0';
      messageElement.style.opacity = '0';
      messageElement.style.marginTop = '0';
    } else {
      messageElement.style.maxHeight = '100px';
      messageElement.style.opacity = '1';
      messageElement.style.marginTop = '8px';
    }
    
    // Assemble the toast
    toast.appendChild(headerContainer);
    toast.appendChild(messageElement);
    
    // Add to DOM
    document.body.appendChild(toast);

    if (options.durationMs) {
      setTimeout(() => {
        const toast = document.getElementById(Toast.TOAST_ID);
        if (toast) toast.remove();
      }, options.durationMs);
    }
  }
  
  /**
   * Hide the current toast if it exists
   */
  public static hide(): void {
    const existingToast = document.getElementById(Toast.TOAST_ID);
    if (existingToast) {
      localStorage.removeItem(Toast.STORAGE_KEY); // Clear the collapsed state
      existingToast.remove();
    }
  }
  
  /**
   * Toggle the collapsed state of the toast
   */
  private static toggleCollapse(): void {
    Toast.isCollapsed = !Toast.isCollapsed;
    
    // Store the collapsed state
    localStorage.setItem(Toast.STORAGE_KEY, Toast.isCollapsed.toString());
    
    const toast = document.getElementById(Toast.TOAST_ID);
    if (!toast) return;
    
    const messageElement = toast.querySelector('div:last-child') as HTMLElement;
    const toggleBtn = toast.querySelector('.fs-tools-toast-toggle') as HTMLElement;
    
    if (Toast.isCollapsed) {
      // Collapse animation
      messageElement.style.maxHeight = '0';
      messageElement.style.opacity = '0';
      messageElement.style.marginTop = '0';
      toggleBtn.innerHTML = '&#9650;'; // Up arrow
    } else {
      // Expand animation
      messageElement.style.maxHeight = '100px';
      messageElement.style.opacity = '1';
      messageElement.style.marginTop = '8px';
      toggleBtn.innerHTML = '&#9660;'; // Down arrow
    }
  }
}
