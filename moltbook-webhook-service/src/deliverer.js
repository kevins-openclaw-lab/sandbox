/**
 * Webhook Deliverer
 * 
 * Delivers webhooks with retry logic
 */

const fetch = require('node-fetch');
const crypto = require('crypto');

class WebhookDeliverer {
  constructor() {
    this.deliveryQueue = [];
    this.retryAttempts = new Map();
    this.maxRetries = 3;
  }
  
  /**
   * Deliver a webhook event
   */
  async deliver(subscription, event, data) {
    const payload = {
      event,
      timestamp: new Date().toISOString(),
      data
    };
    
    // Sign payload if secret provided
    let signature = null;
    if (subscription.secret) {
      signature = crypto
        .createHmac('sha256', subscription.secret)
        .update(JSON.stringify(payload))
        .digest('hex');
    }
    
    const deliveryId = crypto.randomBytes(16).toString('hex');
    
    try {
      const response = await fetch(subscription.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Moltbook-Event': event,
          'X-Moltbook-Delivery': deliveryId,
          ...(signature && { 'X-Moltbook-Signature': signature })
        },
        body: JSON.stringify(payload),
        timeout: 5000 // 5 second timeout
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      // Success - clear retry count
      this.retryAttempts.delete(deliveryId);
      
      return { success: true, deliveryId };
      
    } catch (error) {
      console.error(`Webhook delivery failed: ${error.message}`);
      
      // Track retry attempts
      const attempts = (this.retryAttempts.get(deliveryId) || 0) + 1;
      this.retryAttempts.set(deliveryId, attempts);
      
      if (attempts < this.maxRetries) {
        // Schedule retry with exponential backoff
        const delay = Math.pow(2, attempts) * 1000; // 2s, 4s, 8s
        
        console.log(`Scheduling retry ${attempts}/${this.maxRetries} in ${delay}ms`);
        
        setTimeout(() => {
          this.deliver(subscription, event, data);
        }, delay);
      } else {
        console.error(`Max retries exceeded for delivery ${deliveryId}`);
        this.retryAttempts.delete(deliveryId);
      }
      
      return { success: false, error: error.message, deliveryId };
    }
  }
  
  /**
   * Deliver multiple events in batch
   */
  async deliverBatch(subscription, events) {
    const results = [];
    
    for (const { event, data } of events) {
      const result = await this.deliver(subscription, event, data);
      results.push(result);
      
      // Small delay between deliveries to avoid overwhelming the endpoint
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return results;
  }
}

module.exports = { WebhookDeliverer };
