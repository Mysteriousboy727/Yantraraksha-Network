// // src/services/apiClient.js

// class APIClient {
//   constructor(baseURL = "http://localhost:8000") {
//     this.baseURL = baseURL;
//     this.wsURL = baseURL.replace("http", "ws");
//   }

//   async getKPIs() {
//     const response = await fetch(`${this.baseURL}/api/v1/kpi`);
//     return await response.json();
//   }

//   async getAlerts() {
//     const response = await fetch(`${this.baseURL}/api/v1/alerts`);
//     return await response.json();
//   }

//   // Ye WebSocket connection hai jo bina refresh kiye alerts layega
//   connectWebSocket(onAlert) {
//     const ws = new WebSocket(`${this.wsURL}/ws/alerts`);
    
//     ws.onmessage = (event) => {
//       const message = JSON.parse(event.data);
//       if (message.type === "alert") {
//         onAlert(message.data);
//       }
//     };

//     ws.onclose = () => {
//       console.log("WebSocket Disconnected. Reconnecting...");
//       setTimeout(() => this.connectWebSocket(onAlert), 3000);
//     };
//   }
// }

// export default new APIClient();

// src/services/apiClient.js

class APIClient {
  constructor(baseURL = "http://127.0.0.1:8000") {
    this.baseURL = baseURL;
    // Replace http with ws for WebSocket connection
    this.wsURL = baseURL.replace("http", "ws");
  }

  // 1. Fetch overall system status (replaces the old getKPIs)
  async getStatus() {
    try {
      const response = await fetch(`${this.baseURL}/api/v1/status`);
      if (!response.ok) throw new Error("Failed to fetch status");
      return await response.json();
    } catch (error) {
      console.error("API Error (getStatus):", error);
      return null;
    }
  }

  // 2. Fetch historical alerts
  async getAlerts() {
    try {
      const response = await fetch(`${this.baseURL}/api/v1/alerts`);
      if (!response.ok) throw new Error("Failed to fetch alerts");
      return await response.json();
    } catch (error) {
      console.error("API Error (getAlerts):", error);
      return [];
    }
  }

  // 3. Fetch device registry
  async getDevices() {
    try {
      const response = await fetch(`${this.baseURL}/api/v1/devices`);
      if (!response.ok) throw new Error("Failed to fetch devices");
      return await response.json();
    } catch (error) {
      console.error("API Error (getDevices):", error);
      return [];
    }
  }

  // 4. Fetch incident response details
  async getIncidentDetails() {
    try {
      const response = await fetch(`${this.baseURL}/api/v1/incident-details`);
      if (!response.ok) throw new Error("Failed to fetch incident details");
      return await response.json();
    } catch (error) {
      console.error("API Error (getIncidentDetails):", error);
      return null;
    }
  }

  // 5. Connect to Live WebSocket for instant alerts
  connectWebSocket(onAlert) {
    const ws = new WebSocket(`${this.wsURL}/ws/alerts`);
    
    ws.onopen = () => {
      console.log("🟢 WebSocket Connected!");
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "alert") {
          console.log("🚨 Live Alert Received via WebSocket!");
          onAlert(message.data);
        }
      } catch (err) {
        console.error("Failed to parse WebSocket message:", err);
      }
    };

    ws.onclose = () => {
      console.log("🔴 WebSocket Disconnected. Reconnecting in 3s...");
      setTimeout(() => this.connectWebSocket(onAlert), 3000);
    };

    ws.onerror = (error) => {
      console.error("WebSocket Error:", error);
    };
  }
}

export default new APIClient();