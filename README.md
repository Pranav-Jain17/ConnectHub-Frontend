## 📖 Project Description
ConnectHub is a high-performance, Peer-to-Peer (P2P) video chat application developed to facilitate seamless, real-time communication. Engineered with WebRTC for direct media streaming and WebSockets for real-time bidirectional communication, the application ensures low-latency, High-Definition (HD) video calls. A dedicated Socket.IO implementation handles the lightweight signaling process required to establish the P2P connections efficiently.

## ✨ Key Features
* **P2P Video & Audio:** Direct peer-to-peer connections using WebRTC for secure, high-quality media transmission.
* **HD Call Support:** Optimized streaming capabilities to support high-definition video resolutions.
* **Lightweight Signaling:** Socket.IO handles connection negotiation (SDP offers/answers and ICE candidates) with minimal overhead.
* **Low Latency:** WebRTC data channels and media streams ensure real-time communication without noticeable delays.

## 🛠️ Tech Stack
* **Core Communication:** WebRTC
* **Signaling Server:** WebSockets, Socket.IO, Node.js
* **Frontend UI:** JavaScript/React.js (Typical integration)

## 🚀 How to Run

### Prerequisites
* Node.js (v16.x or higher)
* npm or yarn

### Installation & Setup

1. **Clone the repository**
   ```bash
   git clone [https://github.com/your-username/ConnectHub.git](https://github.com/your-username/ConnectHub.git)
   ```
2. **Navigate to the project directory**
   ```bash
   cd ConnectHub
   ```

#### Setting up the Signaling Server (Backend)
1. Navigate to the server directory:
   ```bash
   cd server
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Socket.IO server:
   ```bash
   node index.js
   ```

#### Setting up the Client (Frontend)
1. Open a new terminal and navigate to the client directory:
   ```bash
   cd client
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm start
   ```

