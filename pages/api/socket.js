export default function handler(req, res) {
    if (res.socket.server.io) {
        console.log('Socket is already running');
    } else {
        console.log('Socket is initializing');
        // In a custom server, io is bound to the server instance. 
        // This file is just to allow the client to have a valid endpoint to fetch if needed.
    }
    res.end();
}
