const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// User data array (in-memory database)
const users = [
    { userID: 'user1', password: 'password1' },
    { userID: 'user2', password: 'password2' },
    { userID: 'user3', password: 'password3' }
];

// Store connected users
let connectedUsers = [];

// Initial document content
let documentContent = { text: '', user: 'Server' };

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// Handle WebSocket connections
wss.on('connection', ws => {
    let currentUser = null;

    // Handle incoming messages from clients
    ws.on('message', message => {
        const data = JSON.parse(message);

        console.log('Received message:', data); // Debug log

        // Handle authentication first
        if (data.type === 'auth') {
            const user = users.find(u => u.userID === data.userID && u.password === data.password);
            if (user) {
                currentUser = user.userID;
                connectedUsers.push(currentUser);

                console.log(`User authenticated: ${currentUser}`); // Debug log

                // Broadcast to all users who is connected
                broadcast({
                    type: 'userList',
                    connectedUsers,
                });

                // Send initial document to the authenticated user
                ws.send(JSON.stringify({ type: 'document', text: documentContent.text }));

                // Notify user authentication success and send back the userID
                ws.send(JSON.stringify({ type: 'auth', success: true, message: `Welcome, ${currentUser}`, userID: currentUser }));
            } else {
                ws.send(JSON.stringify({ type: 'auth', success: false, message: 'Invalid credentials' }));
            }
        } else if (data.type === 'update' && currentUser) {
            // Handle document updates if the user is authenticated
            documentContent.text = data.text;
            documentContent.user = currentUser;

            // Broadcast the updated document to all users
            broadcast({
                type: 'update',
                text: documentContent.text,
                user: currentUser,
            });
        }
    });

    // Handle WebSocket close event
    ws.on('close', () => {
        if (currentUser) {
            connectedUsers = connectedUsers.filter(user => user !== currentUser);

            console.log(`User disconnected: ${currentUser}`); // Debug log

            // Broadcast updated user list when someone disconnects
            broadcast({
                type: 'userList',
                connectedUsers,
            });
        }
    });

    // Function to broadcast a message to all connected clients
    function broadcast(message) {
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(message));
            }
        });
    }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});
