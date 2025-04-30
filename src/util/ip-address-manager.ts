import { DataStorage, IpAddressData } from "../data/data-storage";
import { Logger } from "./logger";

// IP address TTL in milliseconds (3 hours)
const IP_ADDRESS_TTL_MS = 3 * 60 * 60 * 1000;

export class IpAddressManager {
  /**
   * Checks if the stored IP address is valid, and if not, fetches a new one asynchronously
   */
  public static async checkAndUpdateIpAddress(dataStorage: DataStorage): Promise<void> {
    const ipAddressData = await dataStorage.getIpAddressData();
    const now = Date.now();
    
    // If IP address is missing or expired, fetch a new one
    if (!ipAddressData || now - ipAddressData.createdAt > IP_ADDRESS_TTL_MS) {
      // Use existing IP if available while we fetch a new one
      this.fetchAndUpdateIpAddress(dataStorage).catch(err => {
        Logger.error('Failed to update IP address:', err);
      });
    }
  }

  /**
   * Fetches the user's current IP address and stores it
   */
  private static async fetchAndUpdateIpAddress(dataStorage: DataStorage): Promise<void> {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      if (!response.ok) {
        throw new Error(`Failed to fetch IP address: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      if (data.ip) {
        const ipAddressData: IpAddressData = {
          ipAddress: data.ip,
          createdAt: Date.now()
        };
        await dataStorage.setIpAddressData(ipAddressData);
        Logger.info(`Updated IP address: ${data.ip}`);
      }
    } catch (error) {
      Logger.error('Error fetching IP address:', error);
    }
  }
}
