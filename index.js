import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { Server } from 'socket.io';
import { log } from 'node:console';


// its means when my server start it will create 100 checkboxes and all of them are false by default and when any client change the state of checkbox it will emit to server and server will emit to all clients that checkbox state is changed and all clients will update the state of that checkbox.
const CHECKBOX_COUNT = 100;
const state = {
    checboxes: new Array(CHECKBOX_COUNT).fill(false)
}

async function main() {
    const app = express();
    const server = http.createServer(app);

    const PORT = process.env.PORT ?? 8000;

    const io = new Server(server);

    io.on('connection', (socket) => {
        console.log('socket connected', {
            id: socket.id
        });

        socket.on('client:checkbox:change', (data) => {
            console.log(`[socket: ${socket.id}]: client:checkbox:change`, data);
            io.emit('server:checkbox:change', data);  // this line means whatever client gave data emit to server that data 
            state.checboxes[data.index] = data.checked; // this line means whatever client gave data emit to server that data and update the state of that checkbox
        })
    });

    app.use(express.static(path.resolve('./public')));

    app.get('/health', (req, res) => {
        res.json({ healthy: true });
    });
    app.get('/checkboxes', (req, res) => {
        return res.json( {checkboxes: state.checboxes});
    });
    server.listen(PORT, () => {
        console.log(`server is running on http://localhost:${PORT}`);
    });
}

main();