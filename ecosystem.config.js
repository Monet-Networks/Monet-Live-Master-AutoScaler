module['exports'] = {
  apps: [
    {
      name: 'Autoscaling Master',
      script: 'node --inspect=0.0.0.0:9229 server.js',
      env: {
        // DEBUG: '',
      },
    },
  ],
};
