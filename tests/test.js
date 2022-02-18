const socket = io('ws://localhost:3000', { path: '/sock', transports: ['websocket'] });

socket.on('connect', () => {
  console.log('socket connected.');
});

socket.emit('register-userId', { name: 'kyubi' });

socket.on('fetch-userId', () => {
  socket.emit('register-userId', { name: 'kyubi' });
});
