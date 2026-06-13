import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { Server } from 'socket.io';

import {publisher, subscriber, redis} from './redis-connection.js';


// its means when my server start it will create 100 checkboxes and all of them are false by default and when any client change the state of checkbox it will emit to server and server will emit to all clients that checkbox state is changed and all clients will update the state of that checkbox.
const CHECKBOX_COUNT = 100;
const CHECKBOX_KEY = 'checkbox-state';

const rateLimitingHashMap = new Map();

async function main() {
    const app = express();
    const server = http.createServer(app);

    const PORT = process.env.PORT ?? 8000;

    const io = new Server(server);

    await subscriber.subscribe('internal-server:checkbox:change')
    subscriber.on('message', (channel, message) => {
        if(channel === 'internal-server:checkbox:change') {
            const {index, checked} = JSON.parse(message);
            io.emit('server:checkbox:change', { index, checked });
        }
    });

    io.on('connection', (socket) => {
        console.log('socket connected', {
            id: socket.id
        });

        socket.on('client:checkbox:change', async (data) => {
            console.log(`[socket: ${socket.id}]: client:checkbox:change`, data);

            const lastOperationTime = rateLimitingHashMap.get(socket.id)
            if (lastOperationTime) {
                const timeElapsed = Date.now() - lastOperationTime;
                if (timeElapsed < 5.5 * 1000) {
                    socket.emit('server:error', {error: 'You are doing this too fast. Please wait a moment.' });
                    return;
                }
            } 
                rateLimitingHashMap.set(socket.id, Date.now()); 
            
            // io.emit('server:checkbox:change', data);  // this line means whatever client gave data emit to server that data 
            // state.checboxes[data.index] = data.checked; // this line means whatever client gave data emit to server that data and update the state of that checkbox
            const existingState = await redis.get(CHECKBOX_KEY);
            if(existingState) {
                const remoteData = JSON.parse(existingState);
                remoteData[data.index] = data.checked;
                await redis.set(CHECKBOX_KEY, JSON.stringify(remoteData));
            } else {
                redis.set(CHECKBOX_KEY, JSON.stringify(new Array(CHECKBOX_COUNT).fill(false)));
            }

        
            await publisher.publish(
                'internal-server:checkbox:change',
                 JSON.stringify(data));  // why here strinfy because we are sending data to redis and redis only accept string data so we need to stringify the data before sending it to redis
                
        })
    });

    app.use(express.static(path.resolve('./public')));

    app.get('/health', (req, res) => {
        res.json({ healthy: true });
    });
    app.get('/checkboxes', async(req, res) => {
        const existingState = await redis.get(CHECKBOX_KEY);
        if(existingState) {
            const remoteData = JSON.parse(existingState);
            return res.json( {checkboxes: remoteData});
        }
        return res.json( {checkboxes: new Array(CHECKBOX_COUNT).fill(false)});
    });
    server.listen(PORT, () => {
        console.log(`server is running on http://localhost:${PORT}`);
    });
}

main();