module['exports'] = {
  apps: [
    {
      name: 'Conference Call',
      script: 'node --inspect=0.0.0.0:9229 server.js',
      env: {
        // DEBUG: '',
      },
    },
  ],
};
