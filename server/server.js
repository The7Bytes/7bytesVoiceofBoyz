const WebSocket = require("ws");
const wss = new WebSocket.Server({ port: process.env.PORT || 10000 });

const rooms = {};
const clients = new Map(); // Track active clients with their room IDs

wss.on("connection", (ws) => {
  console.log("New client connected");
  let clientRoomId = null; // Track roomId per connection

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      const { roomId, type, payload, password } = data;

      const sharedPassword = "myfriends123"; // Must match client-side
      if (password !== sharedPassword) {
        ws.send(JSON.stringify({ type: "error", payload: "Incorrect password" }));
        ws.close();
        return;
      }

      if (!rooms[roomId]) rooms[roomId] = new Set();
      rooms[roomId].add(ws);
      clientRoomId = roomId;
      clients.set(ws, { roomId: clientRoomId, nickname: payload.nickname });

      // Notify other clients in the room
      rooms[roomId].forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: "user-joined", payload: payload }));
        }
      });

      // Relay WebRTC signaling messages
      if (type === "offer" || type === "answer" || type === "ice-candidate") {
        rooms[roomId].forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type, payload }));
          }
        });
      }
    } catch (error) {
      console.error("Error processing message:", error);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "error", payload: "Invalid message format" }));
      }
    }
  });

  ws.on("close", () => {
    if (clientRoomId && rooms[clientRoomId]) {
      rooms[clientRoomId].delete(ws);
      const clientData = clients.get(ws);
      if (clientData) {
        console.log(`Client ${clientData.nickname} disconnected from room: ${clientRoomId}`);
        clients.delete(ws);
        if (rooms[clientRoomId].size === 0) {
          delete rooms[clientRoomId];
          console.log(`Room ${clientRoomId} deleted`);
        } else {
          // Notify remaining clients of the disconnection
          rooms[clientRoomId].forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ type: "user-left", payload: { nickname: clientData.nickname } }));
            }
          });
        }
      }
    } else {
      console.log("Client disconnected, no room assigned");
    }
  });

  ws.onerror = (error) => {
    console.error("WebSocket error:", error);
    if (clientRoomId && rooms[clientRoomId]) {
      rooms[clientRoomId].delete(ws);
      clients.delete(ws);
    }
  });

  // Keep-alive to prevent Render sleep
  setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
      console.log("Sent ping to client");
    }
  }, 240000); // Every 4 minutes
}); // Closing brace for wss.on("connection")

console.log("WebSocket server running on port", process.env.PORT || 10000);
