const roomId = "voicechat-room";
const sharedPassword = "myfriends123"; // Must match server
const signalingServerUrl = "wss://your-app-name.onrender.com"; // Replace with your deployed server URL
let ws;
let peerConnections = {};
let localStream;
let isMuted = false;
let volume = 1;
let nickname = "";

async function joinChat() {
    nickname = document.getElementById("nickname").value;
    const password = document.getElementById("password").value;

    if (!nickname) {
        document.getElementById("status").textContent = "Error: Please enter a nickname";
        return;
    }
    if (password !== sharedPassword) {
        document.getElementById("status").textContent = "Error: Incorrect password";
        return;
    }

    if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") {
        document.getElementById("status").textContent = "Error: HTTPS is required. Enable SSL on your domain.";
        return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        document.getElementById("status").textContent = "Error: Browser does not support microphone access. Use Chrome or Firefox.";
        return;
    }

    document.getElementById("login").style.display = "none";
    document.getElementById("chat").style.display = "block";

    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 },
            video: false
        });
    } catch (error) {
        document.getElementById("status").textContent = `Microphone error: ${error.message}`;
        return;
    }

    ws = new WebSocket(signalingServerUrl);

    ws.onopen = () => {
        console.log("Connected to signaling server");
        ws.send(JSON.stringify({ type: "join", roomId, payload: { nickname }, password }));
        document.getElementById("status").textContent = "Connected to server";
    };

    ws.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        const { type, payload } = data;

        if (type === "error") {
            document.getElementById("status").textContent = `Error: ${payload}`;
            ws.close();
            return;
        }

        if (type === "user-joined") {
            const peerId = payload.nickname;
            if (!peerConnections[peerId] && peerId !== nickname) {
                await createPeerConnection(peerId);
                if (Object.keys(peerConnections).length === 1) await makeOffer(peerId);
            }
            updateUserList();
        }

        if (type === "offer") {
            const peerId = payload.from;
            if (!peerConnections[peerId] && peerId !== nickname) {
                await createPeerConnection(peerId);
                await peerConnections[peerId].setRemoteDescription(new RTCSessionDescription(payload.offer));
                const answer = await peerConnections[peerId].createAnswer();
                await peerConnections[peerId].setLocalDescription(answer);
                ws.send(JSON.stringify({ type: "answer", roomId, payload: { answer, to: peerId, from: nickname } }));
            }
        }

        if (type === "answer") {
            const peerId = payload.from;
            await peerConnections[peerId].setRemoteDescription(new RTCSessionDescription(payload.answer));
        }

        if (type === "ice-candidate") {
            const peerId = payload.from;
            if (peerConnections[peerId]) {
                await peerConnections[peerId].addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(e => console.error("ICE Error:", e));
            }
        }
    };

    ws.onerror = (error) => {
        document.getElementById("status").textContent = `WebSocket error: ${error.message}`;
    };

    ws.onclose = () => {
        document.getElementById("status").textContent = "Disconnected from server";
        Object.values(peerConnections).forEach(pc => pc.close());
        peerConnections = {};
        updateUserList();
    };
}

async function createPeerConnection(peerId) {
    const pc = new RTCPeerConnection({
        iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
            { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" }
        ]
    });

    peerConnections[peerId] = pc;

    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    pc.ontrack = (event) => {
        const audio = new Audio();
        audio.srcObject = event.streams[0];
        audio.autoplay = true;
        audio.volume = volume;
        document.body.appendChild(audio);
    };

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            console.log("ICE Candidate:", event.candidate);
            ws.send(JSON.stringify({
                type: "ice-candidate",
                roomId,
                payload: { candidate: event.candidate, to: peerId, from: nickname }
            }));
        }
    };

    pc.oniceconnectionstatechange = () => {
        console.log("ICE State:", pc.iceConnectionState);
        if (pc.iceConnectionState === "failed") {
            pc.restartIce();
        }
    };

    pc.onconnectionstatechange = () => {
        if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
            delete peerConnections[peerId];
            updateUserList();
        }
    };
}

async function makeOffer(peerId) {
    const offer = await peerConnections[peerId].createOffer();
    await peerConnections[peerId].setLocalDescription(offer);
    ws.send(JSON.stringify({
        type: "offer",
        roomId,
        payload: { offer, to: peerId, from: nickname }
    }));
}

function toggleMic() {
    isMuted = !isMuted;
    localStream.getAudioTracks().forEach(track => track.enabled = !isMuted);
    const micButton = document.getElementById("micButton");
    micButton.textContent = isMuted ? "Unmute" : "Mute";
    micButton.className = isMuted ? "muted" : "";
}

function adjustVolume() {
    volume = document.getElementById("volumeSlider").value;
    document.querySelectorAll("audio").forEach(audio => audio.volume = volume);
}

function updateUserList() {
    const usersDiv = document.getElementById("users");
    const users = Object.keys(peerConnections).length > 0 ? Object.keys(peerConnections).join(", ") : "None";
    usersDiv.textContent = `Connected users: ${users}`;
}

window.onbeforeunload = () => {
    if (ws) ws.close();
    Object.values(peerConnections).forEach(pc => pc.close());
};
