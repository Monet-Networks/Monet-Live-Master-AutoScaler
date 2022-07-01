import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {});

io.on('connection', (socket) => {
  socket.emit('hello', 'world');
});

httpServer.listen(3000);
