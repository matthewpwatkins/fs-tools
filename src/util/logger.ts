/**
 * Logger utility for FS Tools with support for different log levels.
 */

/**
 * Log levels for the logger
 */
export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4
}

export function parseLogLevel(logLevel: string | undefined): LogLevel | undefined {
  const standardLogLevel = logLevel?.trim().toLowerCase();
  if (!standardLogLevel) {
    return undefined;
  }

  switch (standardLogLevel.toLowerCase()) {
    case 'trace':
      return LogLevel.TRACE;
    case 'debug':
      return LogLevel.DEBUG;
    case 'info':
      return LogLevel.INFO;
    case 'warn':
      return LogLevel.WARN;
    case 'error':
      return LogLevel.ERROR;
    default:
      throw new Error(`Invalid log level: ${logLevel}`);
  }
}

/**
 * Logger class that wraps console functionality with support for different log levels
 */
export class Logger {
  private static currentLogLevel: LogLevel = LogLevel.WARN;
  private static readonly PREFIX = '[FS Tools]';
  
  /**
   * Set the current log level
   * @param level The log level to set
   */
  public static setLogLevel(level: LogLevel): void {
    Logger.currentLogLevel = level;
  }

  /**
   * Log a trace message
   * @param message The message to log
   * @param optionalParams Additional parameters to log
   */
  public static trace(message?: any, ...optionalParams: any[]): void {
    if (Logger.currentLogLevel <= LogLevel.TRACE) {
      console.log(`${Logger.PREFIX} [TRACE] ${message}`, ...optionalParams);
    }
  }

  /**
   * Log a debug message
   * @param message The message to log
   * @param optionalParams Additional parameters to log
   */
  public static debug(message?: any, ...optionalParams: any[]): void {
    if (Logger.currentLogLevel <= LogLevel.DEBUG) {
      console.log(`${Logger.PREFIX} [DEBUG] ${message}`, ...optionalParams);
    }
  }

  /**
   * Log an info message
   * @param message The message to log
   * @param optionalParams Additional parameters to log
   */
  public static info(message?: any, ...optionalParams: any[]): void {
    if (Logger.currentLogLevel <= LogLevel.INFO) {
      console.log(`${Logger.PREFIX} [INFO] ${message}`, ...optionalParams);
    }
  }

  /**
   * Log a warning message
   * @param message The message to log
   * @param optionalParams Additional parameters to log
   */
  public static warn(message?: any, ...optionalParams: any[]): void {
    if (Logger.currentLogLevel <= LogLevel.WARN) {
      console.warn(`${Logger.PREFIX} [WARN] ${message}`, ...optionalParams);
    }
  }

  /**
   * Log an error message
   * @param message The message to log
   * @param optionalParams Additional parameters to log
   */
  public static error(message?: any, ...optionalParams: any[]): void {
    if (Logger.currentLogLevel <= LogLevel.ERROR) {
      console.error(`${Logger.PREFIX} [ERROR] ${message}`, ...optionalParams);
    }
  }
}