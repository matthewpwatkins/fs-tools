import { LogLevel, parseLogLevel, Logger } from '../../util/logger';

describe('logger', () => {
  describe('parseLogLevel', () => {
    it('should return undefined for undefined input', () => {
      expect(parseLogLevel(undefined)).toBeUndefined();
    });

    it('should parse valid log levels', () => {
      expect(parseLogLevel('trace')).toBe(LogLevel.TRACE);
      expect(parseLogLevel('debug')).toBe(LogLevel.DEBUG);
      expect(parseLogLevel('info')).toBe(LogLevel.INFO);
      expect(parseLogLevel('warn')).toBe(LogLevel.WARN);
      expect(parseLogLevel('error')).toBe(LogLevel.ERROR);
    });

    it('should throw an error for invalid log levels', () => {
      expect(() => parseLogLevel('invalid')).toThrow('Invalid log level: invalid');
    });

    it('should handle log levels with different cases and trimming', () => {
      expect(parseLogLevel(' TrAcE ')).toBe(LogLevel.TRACE);
      expect(parseLogLevel('DEBUG')).toBe(LogLevel.DEBUG);
    });
  });

  describe('Logger', () => {
    beforeEach(() => {
      Logger.setLogLevel(LogLevel.TRACE);
    });

    it('should log messages at different levels', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      Logger.trace('trace message');
      Logger.debug('debug message');
      Logger.info('info message');
      expect(consoleSpy).toHaveBeenCalledTimes(3);
      expect(consoleSpy).toHaveBeenNthCalledWith(1, expect.stringContaining('[TRACE] trace message'));
      expect(consoleSpy).toHaveBeenNthCalledWith(2, expect.stringContaining('[DEBUG] debug message'));
      expect(consoleSpy).toHaveBeenNthCalledWith(3, expect.stringContaining('[INFO] info message'));
      consoleSpy.mockRestore();
    });

    it('should not log messages below the set log level', () => {
      Logger.setLogLevel(LogLevel.ERROR);
      const consoleSpy = jest.spyOn(console, 'log');
      Logger.trace('trace message');
      Logger.debug('debug message');
      Logger.info('info message');
      Logger.warn('warn message');
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log warn and error messages appropriately', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn');
      const consoleErrorSpy = jest.spyOn(console, 'error');
      Logger.warn('warn message');
      Logger.error('error message');
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('[WARN] warn message'));
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('[ERROR] error message'));
      consoleWarnSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });
});