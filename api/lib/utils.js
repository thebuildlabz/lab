/**
 * Utility functions for API handlers
 * Includes timeout, retry, and other common patterns
 */

import { randomUUID } from 'crypto';

/**
 * Fetch with timeout
 * @param {string} url - URL to fetch
 * @param {object} options - Fetch options
 * @param {number} timeoutMs - Timeout in milliseconds (default: 10000)
 * @returns {Promise<Response>}
 */
export async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Retry function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Maximum number of retries (default: 3)
 * @param {Function} shouldRetry - Function to determine if error should be retried (default: retries on 5xx or connection errors)
 * @returns {Promise<any>}
 */
export async function withRetry(fn, maxRetries = 3, shouldRetry = null) {
  const defaultShouldRetry = async (err, response) => {
    // If we got a response, check status
    if (response && response.status >= 500) return true;
    
    // Check error properties
    if (err.status >= 500) return true;
    if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND') return true;
    if (err.name === 'AbortError') return true; // Timeout errors
    if (err.message && err.message.includes('fetch failed')) return true; // Network errors
    
    return false;
  };

  const retryCheck = shouldRetry || defaultShouldRetry;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      
      // If result is a Response object, check if it's an error status
      if (result instanceof Response && !result.ok && result.status >= 500) {
        const shouldRetryResponse = await retryCheck(null, result);
        if (attempt < maxRetries && shouldRetryResponse) {
          const delay = Math.pow(2, attempt) * 1000;
          console.warn(`[RETRY] HTTP ${result.status} on attempt ${attempt}/${maxRetries}, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        // Create error from response for consistent error handling
        const errorText = await result.text().catch(() => 'Unknown error');
        const error = new Error(`HTTP ${result.status}: ${errorText}`);
        error.status = result.status;
        throw error;
      }
      
      return result;
    } catch (err) {
      const isLastAttempt = attempt === maxRetries;
      const shouldRetryError = await retryCheck(err, null);

      if (isLastAttempt || !shouldRetryError) {
        throw err;
      }

      // Exponential backoff: 2^attempt seconds
      const delay = Math.pow(2, attempt) * 1000;
      const errorMsg = err.message || err.toString();
      console.warn(`[RETRY] Attempt ${attempt}/${maxRetries} failed, retrying in ${delay}ms...`, errorMsg);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Generate correlation ID for distributed tracing
 * @param {object} req - Request object
 * @returns {string} Correlation ID
 */
export function getCorrelationId(req) {
  // Try headers first, then generate UUID
  if (req.headers['x-correlation-id']) {
    return req.headers['x-correlation-id'];
  }
  if (req.headers['correlation-id']) {
    return req.headers['correlation-id'];
  }
  // Generate new UUID
  try {
    return randomUUID();
  } catch {
    // Fallback for environments without crypto.randomUUID
    return 'req_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 11);
  }
}

/**
 * Set correlation ID header on response
 * @param {object} res - Response object
 * @param {string} correlationId - Correlation ID
 */
export function setCorrelationId(res, correlationId) {
  res.setHeader('x-correlation-id', correlationId);
}

/**
 * Log with correlation ID
 * @param {string} correlationId - Correlation ID
 * @param {string} level - Log level (info, warn, error)
 * @param {string} message - Log message
 * @param {object} metadata - Additional metadata
 */
export function logWithCorrelation(correlationId, level, message, metadata = {}) {
  const logData = {
    correlationId,
    timestamp: new Date().toISOString(),
    level,
    message,
    ...metadata
  };

  const logFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  logFn(`[${level.toUpperCase()}]`, JSON.stringify(logData));
}
