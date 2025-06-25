# Voice Chat Application

A custom voice chat web application built with WebRTC and WebSockets.

## Project Structure
- `server/`: Contains the signaling server files (`package.json`, `server.js`).
- `client/`: Contains the frontend files (`index.html`, `style.css`, `script.js`).
- `.htaccess`: Enforces HTTPS redirection for InfinityFree.

## Setup
1. **Signaling Server**:
   - Deploy the `server/` files to a free hosting platform (e.g., Render, Replit, Heroku).
   - Update `signalingServerUrl` in `client/script.js` with the deployed WebSocket URL (e.g., `wss://your-app-name.onrender.com`).
2. **Frontend**:
   - Upload `client/` files and `.htaccess` to your InfinityFree `htdocs` folder.
   - Enable SSL in InfinityFree control panel.
3. **Test**:
   - Access `https://voiceofbroz.rf.gd` on two devices with different nicknames and password "myfriends123".
   - Allow microphone access and test audio.

## Dependencies
- `ws` (WebSocket library) for the signaling server.

## Notes
- Ensure HTTPS is active for microphone access.
- Check browser console (F12) for debugging.
