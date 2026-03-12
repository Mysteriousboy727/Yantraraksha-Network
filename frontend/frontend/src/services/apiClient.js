// src/services/apiClient.js

class APIClient {
  constructor(baseURL = "http://localhost:8000") {
    this.baseURL = baseURL;
    this.wsURL = baseURL.replace("http", "ws");
  }

  async getKPIs() {
    const response = await fetch(`${this.baseURL}/api/v1/kpi`);
    return await response.json();
  }

  async getAlerts() {
    const response = await fetch(`${this.baseURL}/api/v1/alerts`);
    return await response.json();
  }

  // Ye WebSocket connection hai jo bina refresh kiye alerts layega
  connectWebSocket(onAlert) {
    const ws = new WebSocket(`${this.wsURL}/ws/alerts`);
    
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "alert") {
        onAlert(message.data);
      }
    };

    ws.onclose = () => {
      console.log("WebSocket Disconnected. Reconnecting...");
      setTimeout(() => this.connectWebSocket(onAlert), 3000);
    };
  }
}

export default new APIClient();