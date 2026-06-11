import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { Server } from 'socket.io';
import { log } from 'node:console';

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
        })
    });

    app.use(express.static(path.resolve('./public')));

    app.get('/health', (req, res) => {
        res.json({ healthy: true });
    });

    server.listen(PORT, () => {
        console.log(`server is running on http://localhost:${PORT}`);
    });
}

main();