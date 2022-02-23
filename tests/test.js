const socket = io('ws://localhost:3000', { path: '/sock', transports: ['websocket'] });

socket.on('connect', () => {
  console.log('socket connected.');
});

socket.on('avg-engagement-res', (data) => console.log(data));

console.log('Emitting avg engagement request.');

socket.emit('avg-engagement-req', { roomid: '1645607704518' });
