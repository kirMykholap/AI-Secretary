import { ConsoleLogger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export class FileLogger extends ConsoleLogger {
  private logFilePath: string;

  constructor() {
    super();
    const logDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    this.logFilePath = path.join(logDir, 'app.log');
  }

  private writeToFile(message: string) {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] ${message}\n`;
    
    try {
      if (fs.existsSync(this.logFilePath)) {
        const stats = fs.statSync(this.logFilePath);
        if (stats.size > 5 * 1024 * 1024) {
          // Truncate if larger than 5MB
          fs.writeFileSync(this.logFilePath, '');
        }
      }
      fs.appendFileSync(this.logFilePath, logLine);
    } catch (e) {
      console.error('Failed to write log', e);
    }
  }

  log(message: any, context?: string) {
    super.log(message, context);
    this.writeToFile(`LOG [${context || ''}] ${message}`);
  }

  error(message: any, stack?: string, context?: string) {
    super.error(message, stack, context);
    this.writeToFile(`ERROR [${context || ''}] ${message} ${stack ? '\n' + stack : ''}`);
  }

  warn(message: any, context?: string) {
    super.warn(message, context);
    this.writeToFile(`WARN [${context || ''}] ${message}`);
  }

  debug(message: any, context?: string) {
    super.debug(message, context);
    this.writeToFile(`DEBUG [${context || ''}] ${message}`);
  }

  verbose(message: any, context?: string) {
    super.verbose(message, context);
    this.writeToFile(`VERBOSE [${context || ''}] ${message}`);
  }
  
  /**
   * Helper to fetch the last N lines for the Telegram Dashboard
   */
  static getLastLogs(linesCount: number = 50): string {
    const logFilePath = path.join(process.cwd(), 'logs', 'app.log');
    if (!fs.existsSync(logFilePath)) return 'Logs not found.';
    
    try {
      const content = fs.readFileSync(logFilePath, 'utf8');
      const lines = content.trim().split('\n');
      return lines.slice(-linesCount).join('\n');
    } catch (e) {
      return 'Failed to read logs.';
    }
  }
}
