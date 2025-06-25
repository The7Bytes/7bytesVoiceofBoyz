const WebSocket = require("ws");
const wss = new WebSocket.Server({ port: process.env.PORT || 10000 }); // Match Render's detected port

const rooms = {};

wss.on("connection", (ws) => {
  console.log("New client connected");

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      const { roomId, type, payload, password } = data;

      const sharedPassword = "myfriends123"; // Must match client-side
      if (password !== sharedPassword) {
        ws.send(JSON.stringify({ type: "error", payload: "Incorrect password" }));
        return;
      }

      if (!rooms[roomId]) rooms[roomId] = new Set();
      rooms[roomId].add(ws);
      ws.roomId = roomId; // Assign roomId to the WebSocket instance

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
      ws.send(JSON.stringify({ type: "error", payload: "Invalid message format" }));
    }
  });

  ws.on("close", () => {
    if (ws.roomId && rooms[ws.roomId]) { // Use ws.roomId instead of roomId
      rooms[ws.roomId].delete(ws);
      if (rooms[ws.roomId].size === 0) delete rooms[ws.roomId];
      console.log("Client disconnected from room:", ws.roomId);
    } else {
      console.log("Client disconnected, no room assigned");
    }
  });

  ws.onerror = (error) => {
    console.error("WebSocket error:", error);
  };
});

console.log("WebSocket server running on port", process.env.PORT || 10000);
