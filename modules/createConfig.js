const fs = require('fs');
const path = require('path');
const template = require('../static/config');

class createConfiguration {
  constructor(IPs) {
    this.config = this.confCreate(IPs);
    // this.writeToFile(this.config);
    console.log(this.config);
  }

  writeToFile = (config) => {
    try {
      fs.writeFileSync('/etc/nginx/nginx.conf', config);
    } catch (error) {
      console.log(error);
    }
  };

  confCreate = (IPs) => {
    const dashIPs = this.treatIPs(IPs);
    const finalTemplate = this.createTemplate(dashIPs);
    return fs
      .readFileSync(path.join(__dirname, '../static/nginx.conf'), { encoding: 'utf8' })
      .replaceAll('###################', finalTemplate);
  };

  treatIPs = (ips) => {
    const dashIPs = [];
    for (const ip of ips) dashIPs.push([ip.replaceAll('.', '_'), ip]);
    return dashIPs;
  };

  createTemplate = (ips) => {
    let finalTemplate = '';
    for (const ip of ips) {
      let temp = template.replaceAll('-:-', ip[0]);
      temp = temp.replaceAll('-+++-', ip[1]);
      finalTemplate = finalTemplate + temp;
    }
    return finalTemplate;
  };

  restartNginx = () => {};
}

const newConfig = new createConfiguration(['127.0.0.1', '0.0.0.0']);
