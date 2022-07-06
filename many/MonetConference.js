let socket,
  Online = true,
  dynamoIp,
  dynamoLink,
  myPubUser = null,
  inSession = true,
  sub_list = {},
  subscriber = null,
  MediaStreams = [],
  pc_subscribe = {},
  ID,
  Name,
  RoomId;
const streams = [];
// ID = params.get('id'),
// Name = params.get('name'),
// RoomId = params.get('roomid');

// const check_speed = (cb) => {
//     cb(navigator.connection.downlink);
// }

// noinspection JSDeprecatedSymbols
class PubUser {
  static webRTCAdapter = this.adapter;

  constructor(name, uuid, room_id, user_type, serverIP, socket, streamType, mediaStream, email, log = false) {
    const params = new URLSearchParams(window.location.search);
    (ID = params.get('id')), (Name = params.get('name')), (RoomId = params.get('roomid'));
    console.log(`ID - Name - RoomId : ${ID} -:- ${Name} -:- ${RoomId}`);
    if (!room_id || !uuid || !name || !user_type || !socket || !streamType)
      return console.error(
        "PubUser contructor : invalid parameters provided to the class object. Please check what's missing",
        `${name} -:- ${uuid} -:- ${user_type} -:- ${socket} -:- ${streamType}`
      );
    this.videoStreams = {};
    this.screen = false;
    this.callbacks = {};
    this.callCount = {};
    this.streamType = streamType;
    this.screen = this.streamType === 'screen';
    this.mediaStream = mediaStream;
    this.socket = socket || null;
    this.video = true;
    this.audio = true;
    this.count = 0;
    this.timer = null;
    this.log = log;
    this.user = {
      proctor: user_type ? user_type : 'proctor',
      uuid: uuid,
      name: name,
      roomid: room_id,
      serverIP: serverIP,
      callType: 'publish',
      email,
    };
    this.once = {
      webcam: true,
      audio: true,
      screen: true,
    };
    if (!streamType) {
      console.error(
        'No media provided to the object. So not proceeding any further. Please provide the media to the object. Returning'
      );
      return;
    }
    this.init();
  }

  get uuid() {
    return this.user.uuid;
  }

  get self() {
    return this.user;
  }

  set sock(val) {
    this.socket = val;
  }

  /**
   * @param {boolean} flag
   */
  set newAudioStatus(flag) {
    this.audio = flag;
  }

  /**
   * @param {boolean} flag
   */
  set newVideoStatus(flag) {
    this.video = flag;
  }

  static isWebrtcSupported() {
    return (
      window.RTCPeerConnection !== undefined &&
      window.RTCPeerConnection !== null &&
      navigator.mediaDevices.getUserMedia !== undefined &&
      navigator.mediaDevices.getUserMedia !== null
    );
  }

  static attachMediaStream(element, stream) {
    try {
      element.srcObject = stream;
    } catch (e) {
      try {
        element.src = URL.createObjectURL(stream);
      } catch (e) {
        console.error('Error attaching stream to element');
      }
    }
  }

  static reattachMediaStream(to, from) {
    try {
      to.srcObject = from.srcObject;
    } catch (e) {}
    try {
      to.src = from.src;
    } catch (e) {
      console.error('Error reattaching stream to element');
    }
  }

  noop = () => {};

  on = (event, callback) => {
    this.callbacks[event] = callback;
  };

  init = () => {
    console.log('Details init : >>>>>>>>>>>>>>>>>> ', ID, Name, RoomId);
    socket.io.opts.query = { ID, Name, RoomId };
    // mediaDev.on('toggle-video', (flag) => this.toggleVideo(this.streamType, flag));
    // mediaDev.on('toggle-audio', (flag) => this.toggleAudio(this.streamType, flag));
    this.transactions = {};
    this.one = null;
    this.streams = {
      local: {},
      remote: {},
    };
    this.pc = {
      sdpSend: false,
    };
    this.myStream = {};
    this.callbacks = {};
    this.createStreams();
    this.session_handler();
  };

  createStreams = () => {
    if (!this.mediaStream) return;
    if (typeof this.mediaStream === 'object')
      this.mediaStream.getTracks().forEach((track) => {
        if (track.kind === 'audio') {
          // Get audio stream
          this.streams['local']['audio'] = new MediaStream();
          this.streams['local']['audio'].addTrack(track);
        } else if (track.kind === 'video') {
          // Get video stream
          this.streams['local']['webcam'] = new MediaStream();
          this.streams['local']['webcam'].addTrack(track);
        } else {
          console.error('Unknown track type : ', track.kind);
        }
      });
    // }
  };

  session_handler = () => {
    const { user, socket, callbacks, noop } = this;
    if (!user) {
      console.error('Please provide user information to MonetRTC. I need to know you.');
      return;
    }
    socket.prependAny((eventName, ...args) => {
      let response = args[0];
      if (!response) return;
      if (response.msg) {
        let msg = response.msg;
        if (msg['id']) {
          const transaction = this.transactions[msg['id']];
          if (transaction) {
            transaction(msg);
            delete this.transactions[msg['id']];
          }
        }
      }
    });

    socket.emit('create-user', { user, type: this.streamType });

    socket.on('toggle-audio', (data) => {
      const { type, status, from } = data;
      console.warn('fn:toggle-audio');
      let toggleAudioCB =
        typeof this.callbacks['toggleAudio'] === 'function' ? this.callbacks['toggleAudio'] : this.noop;
      toggleAudioCB(data);
      if (from === this.user.uuid) {
        if (!this.streams[type]) return;
        const mediaStream = this.streams[type].getAudioTracks()[0];
        mediaStream.enabled = status;
        let toggleAudioCB =
          typeof this.callbacks['toggleAudio'] === 'function' ? this.callbacks['toggleAudio'] : this.noop;
        toggleAudioCB(type, mediaStream);
      }
    });
    socket.on('toggle-video', (data) => {
      const { type, status, from } = data;
      console.warn('fn:toggle-video');
      let toggleVideoCB =
        typeof this.callbacks['toggleVideo'] === 'function' ? this.callbacks['toggleVideo'] : this.noop;
      toggleVideoCB(data);
      if (from === this.user.uuid) {
        if (!this.streams[type]) return;
        const mediaStream = this.streams[type].getVideoTracks()[0];
        mediaStream.enabled = status;
        let toggleVideoCB =
          typeof this.callbacks['toggleVideo'] === 'function' ? this.callbacks['toggleVideo'] : this.noop;
        toggleVideoCB(type, mediaStream);
      }
    });
    socket.on('error', ({ msg }) => {
      console.error(msg);
    });
    socket.on('connected', ({ iceServers }) => {
      console.log('Connected to server.');
      this.iceServers = iceServers;
      this.publish(
        {
          stream: this.streamType,
          roomid: this.user.roomid,
          iceServers: iceServers,
        },
        (err) => {
          if (err) console.error('There is an error publishing stream : ', err);
        }
      );
    });
    socket.on('error', ({ msg }) => {
      const errorCB = typeof callbacks['error'] == 'function' ? callbacks['error'] : noop;
      errorCB(msg);
    });
    socket.on('success', ({ msg }) => {
      const successCB = typeof callbacks['success'] == 'function' ? callbacks['success'] : noop;
      successCB(msg);
    });
    socket.on('webrtc', ({ msg }) => {
      if (!msg) return;
      let info = msg['payload'];
      let webrtcCB = typeof callbacks['webrtc'] == 'function' ? callbacks['webrtc'] : noop;
      webrtcCB(info);
      // if (info.status === 'down') {
      //   console.log('WebRTC is down. hanging up');
        // hangup(info.stream);
      
    });
    socket.on('join', ({ msg }) => {
      const info = msg['payload'];
      const webrtcCB = typeof callbacks['join'] == 'function' ? callbacks['join'] : noop;
      webrtcCB(info);
      if (info.status === 'down') {
        console.log('WebRTC is down. hanging up');
        // hangup(info.stream);
      }
    });
  };

  publish = (details, callback) => {
    const { noop, pc, publishWebcam, publishScreen, publishAudio } = this;
    callback = typeof callback === 'function' ? callback : noop;
    if (!details || !details.stream || (details.stream !== 'webcam' && details.stream !== 'screen')) {
      callback('Invalid argument.');
      return;
    }
    const { stream: type } = details;
    if (!this.once[type]) return console.error('Publish have been called once. Returning');
    this.once[type] = false;
    if (pc[type]) {
      callback('Already publishing the ' + type);
      console.error('Already publishing the ' + type);
      pc[type].close();
      pc[type] = null;
      return;
    }
    if (type === 'webcam') {
      publishWebcam(callback);
      publishAudio(callback);
    } else if (type === 'screen') {
      publishScreen(callback);
    } else {
      callback('Unsupported media type ' + type);
    }
  };

  publishWebcam = (callback) => {
    const { callbacks, noop, myStream, pc, trID, iceServers, send, user } = this;
    const consentCB = typeof callbacks['consent'] === 'function' ? callbacks['consent'] : this.noop;
    consentCB(true);
    const stream = this.streams['local']['webcam'];
    if (!stream) {
      console.log(
        'Is there a stream in the streams dictionary ? Please check ! Since no video stream was found. I am returning.'
      );
      return;
    }
    const pc_constraints = {
      optional: [{ DtlsSrtpKeyAgreement: true }],
    };
    pc['webcam'] = new RTCPeerConnection({
      iceServers: iceServers,
      pc_constraints,
    });
    pc['webcam'].onicecandidate = (event) => {
      // Trickle candidate (or the end of the gathering process)
      let candidate;
      if (event.candidate === null) {
        candidate = { completed: true };
      } else {
        candidate = {
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
        };
      }
      const msg = {
        monet: 'trickle',
        id: trID(16),
        payload: {
          stream: 'webcam',
          candidate,
        },
      };
      send(msg);
    };
    pc['webcam'].addStream(stream);
    pc['webcam'].ontrack = (event) => {
      if (!event.streams) return;
      const remoteCB = typeof callbacks['remote'] === 'function' ? callbacks['remote'] : noop;
      remoteCB('webcam', event.streams[0]);
    };
    // Create offer
    pc['webcam']
      .createOffer(
        (offer) => {
          if (pc['sdpSend_video'] === true) return console.error('SDP already sent. Please check.');
          pc['sdpSend_video'] = true;
          pc['webcam'].setLocalDescription(offer).then(() => {});
          const jsep = {
            type: offer.type,
            sdp: offer.sdp,
          };
          // Send the publish request
          const msg = {
            monet: 'publish',
            id: trID(16),
            payload: {
              id: this.user.uuid,
              stream: 'webcam',
              jsep,
              roomid: user.roomid,
            },
          };
          send(msg, (result) => {
            if (result['monet'] === 'error') {
              // hangup("webcam");
              callback(result['payload']['reason']);
              return console.error('Error publishing webcam stream. ', result);
            }
            const remoteJsep = result['payload']['jsep'];
            pc['webcam']
              .setRemoteDescription(
                new RTCSessionDescription(remoteJsep),
                () => {},
                (error) => {
                  // hangup("webcam");
                  callback(error);
                }
              )
              .then(() => {});
          });
        },
        (error) => {
          // hangup("webcam");
          callback(error);
        }
      )
      .then(() => {
        // stream.getVideoTracks()[0].applyConstraints({"height":{"min":480},"width":{"min":720}}).then(() => {});
        // const previewCB =
        //     typeof callbacks['preview'] === 'function'
        //         ? callbacks['preview']
        //         : noop;
        // previewCB('webcam', stream);
      });
    const previewCB = typeof callbacks['local'] === 'function' ? callbacks['local'] : noop;
    previewCB('webcam', stream);
    this.pc = pc;
    // })
    // .catch((err) => {
    //   consentCB(false);
    //   callback(err);
    // });
  };

  getSpeakingThreshold(stream, analyzer, dataArray) {
    if (!stream.getAudioTracks()) {
      console.error('Audio not found in media stream');
      return false;
    }
    analyzer.getByteFrequencyData(dataArray);
    let values = 0;
    const length = dataArray.length;
    for (let i = 0; i < length; i++) {
      values += dataArray[i];
    }
    return Math.round(values / length);
  }

  sendSpeakingInfo(stream = this.mediaStream) {
    const params = new Proxy(new URLSearchParams(window.location.search), {
      get: (searchParams, prop) => searchParams.get(prop),
    });
    const delay =
      typeof localStorage.getItem('realTimeScore') === 'number'
        ? localStorage.getItem('realTimeScore')
        : null || typeof JSON.parse(localStorage.getItem('userPlanDetails'))?.realTimeScores === 'number'
        ? JSON.parse(localStorage.getItem('userPlanDetails'))?.realTimeScores
        : null || params.matrixScore || 5;
    const context = new AudioContext();
    const track = context.createMediaStreamSource(stream);
    const gainNode = context.createGain();
    const analyzer = context.createAnalyser();
    track.connect(gainNode);
    track.connect(analyzer);
    // track.connect(context.destination);
    const bufferLength = analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let interval;
    interval = setInterval(() => {
      if (this.audio) {
        const speakingValue = this.getSpeakingThreshold(stream, analyzer, dataArray);
        if (speakingValue && speakingValue > 5) {
          socket.emit('speaking', { status: 1, uuid: this.user.uuid });
        }
      } else socket.emit('speaking', { status: 0, uuid: this.user.uuid });
    }, delay * 1000);
  }

  publishAudio = (callback) => {
    const { callbacks, noop, myStream, pc, trID, iceServers, send, user } = this;
    const consentCB = typeof callbacks['consent'] === 'function' ? callbacks['consent'] : this.noop;
    consentCB(true);
    // const constraints = { audio: true };
    // navigator.mediaDevices
    //   .getUserMedia(constraints)
    //   .then((stream) => {
    //     this.streams['local']['audio'] = stream;
    //     myStream['audio'] = stream;
    const stream = this.streams['local']['audio'];
    if (!stream) {
      console.log(
        'Is there a stream in the streams dictionary ? Please check ! Since no audio stream was found. I am returning.'
      );
      return;
    }
    const pc_constraints = {
      optional: [{ DtlsSrtpKeyAgreement: true }],
    };
    pc['audio'] = new RTCPeerConnection({
      iceServers: iceServers,
      pc_constraints,
    });
    pc['audio'].onicecandidate = (event) => {
      // Trickle candidate (or the end of the gathering process)
      let candidate;
      if (event.candidate === null) {
        candidate = { completed: true };
      } else {
        candidate = {
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
        };
      }
      const msg = {
        monet: 'trickle',
        id: trID(16),
        payload: {
          stream: 'audio',
          candidate,
        },
      };
      send(msg);
    };
    pc['audio'].addStream(stream);
    pc['audio'].ontrack = (event) => {
      if (!event.streams) return;
      const remoteCB = typeof callbacks['remote'] === 'function' ? callbacks['remote'] : noop;
      remoteCB('audio', event.streams[0]);
    };
    // Create offer
    pc['audio']
      .createOffer(
        (offer) => {
          if (pc['sdpSend_audio'] === true) {
            return;
          }
          pc['sdpSend_audio'] = true;
          pc['audio'].setLocalDescription(offer).then(() => {});
          const jsep = {
            type: offer.type,
            sdp: offer.sdp,
          };
          // Send the publish request
          const msg = {
            monet: 'publish',
            id: trID(16),
            payload: {
              id: this.user.uuid,
              stream: 'audio',
              jsep,
              roomid: user.roomid,
            },
          };
          send(msg, (result) => {
            if (result['monet'] === 'error') {
              // hangup("webcam");
              callback(result['payload']['reason']);
              return;
            }
            const remoteJsep = result['payload']['jsep'];
            console.log('Remote JSEP for Audio : ', result);
            pc['audio']
              .setRemoteDescription(
                new RTCSessionDescription(remoteJsep),
                () => {},
                (error) => {
                  // hangup("webcam");
                  callback(error);
                }
              )
              .then(() => {});
          });
        },
        (error) => {
          // hangup("webcam");
          callback(error);
        }
      )
      .then(() => {});
    // })
    // .catch((err) => {
    //   consentCB(false);
    //   callback(err);
    // });
  };

  publishScreen = (callback) => {
    const { callbacks, noop, myStream, pc, trID, iceServers, send, user } = this;
    const consentCB = typeof callbacks['consent'] === 'function' ? callbacks['consent'] : this.noop;
    consentCB(true);
    let displayMediaStreamConstraints = {
      video: { width: 1920, height: 1080 }, // or pass HINTS
      audio: true,
    };
    navigator.mediaDevices
      .getDisplayMedia(displayMediaStreamConstraints)
      .then((stream) => {
        this.streams['screen'] = stream;
        myStream['screen'] = stream;
        const previewCB = typeof callbacks['preview'] === 'function' ? callbacks['preview'] : noop;
        previewCB('screen', stream);
        const pc_constraints = {
          optional: [{ DtlsSrtpKeyAgreement: true }],
        };
        pc['screen'] = this.peer = new RTCPeerConnection({
          iceServers: iceServers,
          pc_constraints,
        });
        pc['screen'].onicecandidate = (event) => {
          // Trickle candidate (or the end of the gathering process)
          let candidate;
          if (event.candidate === null) {
            candidate = { completed: true };
          } else {
            candidate = {
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid,
              sdpMLineIndex: event.candidate.sdpMLineIndex,
            };
          }
          const msg = {
            monet: 'trickle',
            id: trID(16),
            payload: {
              stream: 'screen',
              candidate,
            },
          };
          send(msg);
        };
        pc['screen'].addStream(stream);
        // pc["screen"].addTrack(stream.getTracks());
        pc['screen'].ontrack = (event) => {
          if (!event.streams) return;
          const remoteCB = typeof callbacks['remote'] === 'function' ? callbacks['remote'] : noop;
          remoteCB('webcam', event.streams[0]);
        };
        // Create offer
        pc['screen']
          .createOffer(
            (offer) => {
              pc['screen'].setLocalDescription(offer).then(() => {});
              const jsep = {
                type: offer.type,
                sdp: offer.sdp,
              };
              // Send the publish request
              const msg = {
                monet: 'publish',
                id: trID(16),
                payload: {
                  id: this.user.uuid,
                  stream: 'screen',
                  jsep,
                  roomid: user.roomid,
                },
              };
              send(msg, (result) => {
                if (result['monet'] === 'error') {
                  // hangup("webcam");
                  callback(result['payload']['reason']);
                  return;
                }
                const remoteJsep = result['payload']['jsep'];
                pc['screen']
                  .setRemoteDescription(
                    new RTCSessionDescription(remoteJsep),
                    () => {},
                    (error) => {
                      // hangup("webcam");
                      callback(error);
                    }
                  )
                  .then(() => {});
              });
            },
            (error) => {
              // hangup("webcam");
              callback(error);
            }
          )
          .then(() => {});
      })
      .catch((error) => {
        const screenDeniedCB =
          typeof callbacks['screen-share-denied'] === 'function' ? callbacks['screen-share-denied'] : noop;
        screenDeniedCB(error, user.uuid);
        console.error('There is an error sharing screen', error);
      });
  };

  send = (message, callback) => {
    const { noop, trID, transactions, socket, user } = this;
    if (!user) {
      console.error('No user!');
    }
    const { uuid } = user;
    callback = typeof callback === 'function' ? callback : noop;
    if (!message['id']) message['id'] = trID(16);
    message['session_id'] = uuid;
    transactions[message['id']] = callback;
    socket.emit(`${message.monet}`, { msg: message });
  };

  trID = (len) => {
    const charSet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let randomString = '';
    for (let i = 0; i < len; i++) {
      let randomPoz = Math.floor(Math.random() * charSet.length);
      randomString += charSet.substring(randomPoz, randomPoz + 1);
    }
    return randomString;
  };

  hangup = () => {
    const { streams, pc } = this;
    if (streams['local']['webcam']) {
      const tracks = streams['local']['webcam'].getTracks();
      tracks[0].stop();
    }
    if (streams['local']['audio']) {
      const tracks = streams['local']['audio'].getTracks();
      tracks[0].stop();
    }
    try {
      pc['webcam'].close();
      pc['audio'].close();
    } catch (e) {
      // Do nothing
    }
    pc['webcam'] = null;
    pc['audio'] = null;
  };

  connect() {}

  register() {
    if (this.log) console.log('connected');
    this.monet_user.on('connected', (info) => {
      this.iceServers = info;
      if ('ice' in this.callbacks) {
        let connectCB = typeof this.callbacks['ice'] == 'function' ? this.callbacks['ice'] : this.noop;
        connectCB();
      }
      this.connectCB();
      // this.monet_user.publish({stream:"webcam"});
      setTimeout(() => {
        this.socketHandler();
      }, 3000);
    });

    this.monet_user.on('error', (error) => {
      // Something went wrong?
      console.error(error);
    });

    this.monet_user.on('success', (success) => {
      Janus.log('Success : ', success);
    });

    this.monet_user.on('preview', (type, stream) => {
      // Local stream available/unavailable
      MediaStreams.push({ id: this.user.uuid, type, stream });
      this.videoStreams[type] = stream;
      const mediaCB = typeof this.callbacks['local'] === 'function' ? this.callbacks['local'] : this.noop;
      mediaCB(type, stream, this.user);
      // this.monet_user.sendStudent({ to: this.user.uuid, text: String(this.user.roomid), from: this.user.uuid });
      setTimeout(
        () =>
          this.monet_user.declare({
            from: this.user.uuid,
            roomid: this.user.roomid,
          }),
        3000
      );
    });
  }

  connectCB() {
    const details = {
      stream: this.streamType,
      roomid: this.user.roomid,
      iceServers: this.iceServers.iceServers,
    };
    this.monet_user.publish(details, (err) => {
      if (err) {
        this.callCount = {
          count: 0,
          timer: 3000,
          limit: 5,
        };
        console.error(err);
        let { count, limit, timer } = this.callCount;
        if (count < limit) {
          if (this.log) `Reattempting publishing ${this.streamType} feed in ${timer / 1000} seconds.`;
          setTimeout(() => {
            if (this.log) `Republishing user ${this.user.uuid}`;
            this.connectCB();
          }, timer);
          this.callCount.timer = timer + 3000;
          this.callCount.count++;
        } else {
          if (this.log) console.log(`callback count exceeded the limit of ${limit}. Returning.`);
        }
      }
    });
  }

  mediaCB = (stream) => {
    const canvas = document.createElement('canvas');
    const vid = document.createElement('video');
    canvas.width = 300;
    canvas.height = 300;
    canvas.style.visibility = 'hidden';
    canvas.style.position = 'absolute';
    canvas.autoplay = true;
    canvas.muted = true;
    vid.id = 'canvasReference';
    vid.width = 300;
    vid.height = 300;
    vid.muted = true;
    vid.autoplay = true;
    vid.srcObject = stream;
    canvas.srcObject = stream;
    document.body.appendChild(vid);
    document.body.appendChild(canvas);
    this.faceData(canvas, vid, 4000);
  };

  create_UUID() {
    let dt = new Date().getTime();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      let r = (dt + Math.random() * 16) % 16 | 0;
      dt = Math.floor(dt / 16);
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  toggleVideo(type = 'webcam', flag = true) {
    this.video = flag;
    mediaDev.toggleVideo(flag);
    if (this.streams['local'][type] === undefined) {
      console.warn(`No such ${type} of media stream in this object. Returning.`);
      return;
    }
    if (this.streams['local'][type].getVideoTracks()[0] === undefined) {
      console.warn('No video stream in this media stream object. Returning.');
      return;
    }
    this.streams['local'][type].getVideoTracks()[0].enabled = flag;
    // const bool = this.streams['local'][type].getVideoTracks()[0].enabled;
    // switch (bool) {
    //   case false:
    //     this.streams['local'][type].getVideoTracks()[0].enabled = true;
    //     break;
    //   case true:
    //     this.streams['local'][type].getVideoTracks()[0].enabled = false;
    //     break;
    // }
    this.socket.emit('toggle-video', {
      roomid: this.user.roomid,
      event: 'video',
      type, // status: this.streams['local'][type].getVideoTracks()[0].enabled,
      status: flag,
      from: this.user.uuid,
    });
  }

  toggleAudio(type = 'webcam', flag = true) {
    mediaDev.toggleAudio(flag);
    if (type === 'webcam') {
      this.audio = flag;
      if (!this.streams['local']['audio']) return;
      if (!this.streams['local']['audio'].getAudioTracks()) return;
      if (this.streams['local']['audio'].getAudioTracks()[0] === undefined) {
        console.warn('No video stream in this media stream object. Returning.');
        return;
      }
      this.streams['local']['audio'].getAudioTracks()[0].enabled = flag;
      this.socket.emit('toggle-audio', {
        roomid: this.user.roomid,
        event: 'audio',
        type, // status: this.streams['local']['audio'].getAudioTracks()[0].enabled,
        status: flag,
        from: this.user.uuid,
      });
    } else if (type === 'screen') {
      if (!this.streams['screen']) return;
      this.streams['screen'].getAudioTracks()[0].enabled = flag;
      this.socket.emit('toggle-audio', {
        roomid: this.user.roomid,
        event: 'audio',
        type, // status: this.streams['local']['audio'].getAudioTracks()[0].enabled,
        status: flag,
        from: `${this.user.uuid}___${this.user.uuid}`,
      });
    } else console.error('Unknown type : ', type);
  }

  destroy(type = 'webcam') {
    switch (type) {
      case 'webcam':
        mediaDev.stop();
        this.hangup();
        break;
      case 'screen':
        this.socket.emit('leave', { uuid: this.user.uuid });
        const tracks = this.streams['screen'].getTracks();
        tracks.forEach((track) => track.stop());
        break;
      default:
        console.error('This method got fired away at this point.');
        break;
    }
  }
}

class StateSubscription {
  // noinspection JSUnusedLocalSymbols
  constructor(janus_uri, publisher_uuid, room, socket, selectiveUUID = null) {
    if (!Janus) {
      console.error('The Janus adapter does not exists. Please look into this issue');
      return;
    }
    this.socket = socket;
    this.publisher_uuid = publisher_uuid;
    this.myroom = room;
    this.init(janus_uri);
  }

  noop = () => {};

  on = (event, callback) => {
    if (typeof callback === 'function' && typeof event === 'string') this.callbacks[event] = callback;
  };

  init(uri) {
    this.userList = [];
    this.mid_check = {};
    this.pubID_uuid = {};
    this.user_context = null;
    this.server = uri;
    this.callbacks = {};
    this.sfutest = null;
    this.opaqueId = 'monet-' + Janus.randomString(12);
    this.myusername = 'subscriber-' + Janus.randomString(12);
    // We use this other ID just to map our subscriptions to us
    this.myid = null;
    this.remoteFeed = null;
    this.feeds = {};
    this.feedStreams = {};
    this.subStreams = {};
    this.slots = {};
    this.mids = {};
    this.subscriptions = {};
    this.remoteTracks = {};
    this.bitrateTimer = [];
    this.simulcastStarted = {};
    this.creatingFeed = false;
    this.state = 0;
  }

  start() {
    Janus.init({
      debug: false,
      callback: () => {
        this.janus = new Janus({
          server: this.server,
          success: () => {
            // Attach to video room test plugin
            // getUsers(9999);
            // noinspection JSUnusedLocalSymbols
            this.janus.attach({
              plugin: 'janus.plugin.videoroom',
              opaqueId: this.opaqueId,
              success: (pluginHandle) => {
                this.sfutest = pluginHandle;
                Janus.log('Plugin attached! (' + this.sfutest.getPlugin() + ', id=' + this.sfutest.getId() + ')');
                Janus.log('  -- This is a manager');
                // Prepare the username registration
                this.registerUsername();
              },
              error: (error) => {
                Janus.error('  -- Error attaching plugin...', error);
              },
              consentDialog: (on) => {
                Janus.debug('Consent dialog should be ' + (on ? 'on' : 'off') + ' now');
              },
              iceState: (state) => {
                Janus.log('ICE state changed to ' + state);
              },
              mediaState: (medium, on, mid) => {
                Janus.log('Janus ' + (on ? 'started' : 'stopped') + ' receiving our ' + medium + ' (mid=' + mid + ')');
              },
              webrtcState: (on) => {
                Janus.log('Janus says our WebRTC PeerConnection is ' + (on ? 'up' : 'down') + ' now');
                // if (!on) return;
                // This controls allows us to override the global room bitrate cap
              },
              slowLink: (uplink, lost, mid) => {
                console.log('The client seems to be slow. uplink : ', uplink, ' -:- lost: ', lost, ' -:- mid: ', mid);
                Janus.warn(
                  'Janus reports problems ' +
                    (uplink ? 'sending' : 'receiving') +
                    ' packets on mid ' +
                    mid +
                    ' (' +
                    lost +
                    ' lost packets)'
                );
              },
              onmessage: (msg, jsep) => {
                Janus.debug(' ::: Got a message (publisher) :::', msg);
                let event = msg['videoroom'];
                Janus.debug('Event: ' + event);
                if (event !== undefined && event != null) {
                  if (event === 'joined') {
                    // Publisher/manager created, negotiate WebRTC and attach to existing feeds, if any
                    this.myid = msg['id'];
                    this.mypvtid = msg['private_id'];
                    Janus.log('Successfully joined room ' + msg['room'] + ' with ID ' + this.myid);
                    // Any new feed to attach to?
                    if (msg['publishers']) {
                      let list = msg['publishers'];
                      Janus.debug('Got a list of available publishers/feeds:', list);
                      let sources = null;
                      for (let f in list) {
                        let id = list[f]['id'];
                        let display = list[f]['display'];
                        let streams = list[f]['streams'];
                        if (this.subscriptions[id]) {
                          continue;
                        }
                        for (let i in streams) {
                          let stream = streams[i];
                          stream['id'] = id;
                          stream['display'] = display;
                        }
                        this.feedStreams[id] = {
                          id: id,
                          display: display,
                          streams: streams,
                        };
                        Janus.debug('  >> [' + id + '] ' + display + ':', streams);
                        if (!sources) sources = [];
                        sources.push(streams);
                        sub_list[id] = sources;
                      }
                      // Janus.log('subscribing to these users: ', sources);
                      if (sources) {
                        if (sources.length !== 0) this.subscribeTo(sources);
                        // this.newSubscription(sources);
                      }
                    }
                  } else if (event === 'destroyed') {
                    // The room has been destroyed
                    Janus.warn('The room has been destroyed!');
                  } else if (event === 'event') {
                    // Any info on our streams or a new feed to attach to?
                    if (msg['streams']) {
                      let streams = msg['streams'];
                      for (let i in streams) {
                        let stream = streams[i];
                        stream['id'] = this.myid;
                        stream['display'] = this.myusername;
                      }
                      this.feedStreams[myid] = {
                        id: myid,
                        display: myusername,
                        streams: streams,
                      };
                    } else if (msg['publishers']) {
                      let list = msg['publishers'];
                      Janus.debug('Got a list of available publishers/feeds:', list);
                      let sources = null;
                      for (let f in list) {
                        let id = list[f]['id'];
                        let display = list[f]['display'];
                        let streams = list[f]['streams'];
                        if (this.subscriptions[id]) {
                          continue;
                        }
                        for (let i in streams) {
                          let stream = streams[i];
                          stream['id'] = id;
                          stream['display'] = display;
                        }
                        this.feedStreams[id] = {
                          id: id,
                          display: display,
                          streams: streams,
                        };
                        Janus.debug('  >> [' + id + '] ' + display + ':', streams);
                        if (!sources) sources = [];
                        sources.push(streams);
                      }
                      if (sources) {
                        if (sources.length !== 0) this.subscribeTo(sources);
                        // this.newSubscription(sources);
                      }
                    } else if (msg['leaving']) {
                      // One of the publishers has gone away?
                      let leaving = msg['leaving'];
                      Janus.log('Publisher left: ' + leaving);
                      this.unsubscribeFrom(leaving);
                    } else if (msg['unpublished']) {
                      // One of the publishers has unpublished?
                      let unpublished = msg['unpublished'];
                      Janus.log('Publisher left: ' + unpublished);
                      if (unpublished === 'ok') {
                        // That's us
                        this.sfutest.hangup();
                        return;
                      }
                      this.unsubscribeFrom(unpublished);
                    } else if (msg['error']) {
                      if (msg['error_code'] === 426) {
                        // This is a "no such room" error: give a more meaningful description
                        Janus.log(
                          'Apparently room' +
                            this.myroom +
                            ' (the one this demo uses as a test room) ' +
                            'does not exist...Do you have an updated <code>janus.plugin.videoroom.cfg' +
                            'configuration file? If not, make sure you copy the details of room' +
                            this.myroom +
                            ' ' +
                            'from that sample in your current configuration file, then restart Janus and try again.'
                        );
                      } else {
                        Janus.error(msg['error']);
                      }
                    }
                  }
                }
                if (jsep) {
                  Janus.debug('Handling SDP as well...', jsep);
                  this.sfutest.handleRemoteJsep({ jsep: jsep });
                  // Check if any of the media we wanted to publish has
                  // been rejected (e.g., wrong or unsupported codec)
                  let audio = msg['audio_codec'];
                  if (mystream && mystream.getAudioTracks() && mystream.getAudioTracks().length > 0 && !audio) {
                    // Audio has been rejected
                    toastr.warning("Our audio stream has been rejected, viewers won't hear us");
                  }
                  let video = msg['video_codec'];
                  if (mystream && mystream.getVideoTracks() && mystream.getVideoTracks().length > 0 && !video) {
                    // Video has been rejected
                    toastr.warning("Our video stream has been rejected, viewers won't see us");
                    // Hide the webcam video
                    $('#myvideo').hide();
                    $('#videolocal').append(
                      '<div class="no-video-container">' +
                        '<i class="fa fa-video-camera fa-5 no-video-icon" style="height: 100%;"></i>' +
                        '<span class="no-video-text" style="font-size: 16px;">Video rejected, no webcam</span>' +
                        '</div>'
                    );
                  }
                }
              },
              onlocaltrack: (track, on) => {
                Janus.debug(' ::: Got a local track event :::');
                Janus.debug('Local track ' + (on ? 'added' : 'removed') + ':', track);
              },
              onremotetrack: (track, mid, on) => {
                // The publisher stream is send only, we don't expect anything here
              },
              oncleanup: () => {
                Janus.log(' ::: Got a cleanup notification: we are unpublished now :::');
                let mystream = null;
                delete feedStreams[this.myid];
                let localTracks = {};
                let localVideos = 0;
              },
            });
          },
          error: (error) => {
            Janus.error(error);
          },
          destroyed: () => {
            Janus.warn('The session have been destroyed.');
          },
        });
      },
    });
  }

  registerUsername() {
    // Try a registration
    let username = 'MonetPublisher' + Janus.randomString(5);
    let register = {
      request: 'join',
      room: this.myroom,
      ptype: 'publisher',
      display: username,
    };
    this.myusername = username;
    this.sfutest.send({ message: register });
  }

  subscribeTo(sources) {
    // New feeds are available, do we need create a new plugin handle first?
    if (this.remoteFeed) {
      // Prepare the streams to subscribe to, as an array: we have the list of
      // streams the feeds are publishing, so we can choose what to pick or skip
      let subscription = [];
      for (let s in sources) {
        let streams = sources[s];
        for (let i in streams) {
          let stream = streams[i];
          // If the publisher is VP8/VP9 and this is an older Safari, let's avoid video
          if (
            stream.type === 'video' &&
            Janus.webRTCAdapter.browserDetails.browser === 'safari' &&
            (stream.codec === 'vp9' || (stream.codec === 'vp8' && !Janus.safariVp8))
          ) {
            Janus.debug(
              'Publisher is using ' +
                stream.codec.toUpperCase +
                ", but Safari doesn't support it: disabling video stream #" +
                stream.mindex
            );
            continue;
          }
          if (stream.disabled) {
            Janus.log('Disabled stream:', stream);
            // TODO Skipping for now, we should unsubscribe
            continue;
          }
          if (this.subscriptions[stream.id] && this.subscriptions[stream.id][stream.mid]) {
            Janus.log('Already subscribed to stream, skipping:', stream);
            continue;
          }
          // Find an empty slot in the UI for each new source
          if (!this.feedStreams[stream.id].slot) {
            let slot;
            for (let i = 1; i < 6; i++) {
              if (!this.feeds[i]) {
                slot = i;
                this.feeds[slot] = stream.id;
                this.feedStreams[stream.id].slot = slot;
                this.feedStreams[stream.id].remoteVideos = 0;
                $('#remote' + slot)
                  .removeClass('hide')
                  .html(stream.display)
                  .show();
                break;
              }
            }
          }
          subscription.push({
            feed: stream.id, // This is mandatory
            mid: stream.mid, // This is optional (all streams, if missing)
          });
          if (!this.subscriptions[stream.id]) this.subscriptions[stream.id] = {};
          this.subscriptions[stream.id][stream.mid] = true;
        }
      }
      if (subscription.length === 0) {
        // Nothing to do
        return;
      }
      this.remoteFeed.send({
        message: {
          request: 'subscribe',
          streams: subscription,
        },
      });
      return;
    }
    // We don't have a handle yet, but we may be creating one already
    if (this.creatingFeed) {
      // Still working on the handle
      setTimeout(() => {
        this.subscribeTo(sources);
      }, 500);
      return;
    }
    this.creatingFeed = true;
    this.janus.attach({
      plugin: 'janus.plugin.videoroom',
      opaqueId: this.opaqueId,
      success: (pluginHandle) => {
        this.remoteFeed = pluginHandle;
        this.remoteTracks = {};
        Janus.log('Plugin attached! (' + this.remoteFeed.getPlugin() + ', id=' + this.remoteFeed.getId() + ')');
        Janus.log('  -- This is a multi stream subscriber');
        // Prepare the streams to subscribe to, as an array: we have the list of
        // streams the feed is publishing, so we can choose what to pick or skip
        let subscription = [];
        for (let s in sources) {
          let streams = sources[s];
          for (let i in streams) {
            let stream = streams[i];
            // If the publisher is VP8/VP9 and this is an older Safari, let's avoid video
            if (
              stream.type === 'video' &&
              Janus.webRTCAdapter.browserDetails.browser === 'safari' &&
              (stream.codec === 'vp9' || (stream.codec === 'vp8' && !Janus.safariVp8))
            ) {
              Janus.debug(
                'Publisher is using ' +
                  stream.codec.toUpperCase +
                  ", but Safari doesn't support it: disabling video stream #" +
                  stream.mindex
              );
              continue;
            }
            if (stream.disabled) {
              Janus.log('Disabled stream:', stream);
              // TODO Skipping for now, we should unsubscribe
              continue;
            }
            Janus.log('Subscribed to ' + stream.id + '/' + stream.mid + '?', this.subscriptions);
            if (this.subscriptions[stream.id] && this.subscriptions[stream.id][stream.mid]) {
              Janus.log('Already subscribed to stream, skipping:', stream);
              continue;
            }
            // Find an empty slot in the UI for each new source
            if (!this.feedStreams[stream.id].slot) {
              let slot;
              for (let i = 1; i < 6; i++) {
                if (!this.feeds[i]) {
                  slot = i;
                  this.feeds[slot] = stream.id;
                  this.feedStreams[stream.id].slot = slot;
                  this.feedStreams[stream.id].remoteVideos = 0;
                  $('#remote' + slot)
                    .removeClass('hide')
                    .html(stream.display)
                    .show();
                  break;
                }
              }
            }
            subscription.push({
              feed: stream.id, // This is mandatory
              mid: stream.mid, // This is optional (all streams, if missing)
            });
            if (!this.subscriptions[stream.id]) this.subscriptions[stream.id] = {};
            this.subscriptions[stream.id][stream.mid] = true;
          }
        }
        // We wait for the plugin to send us an offer
        let subscribe = {
          request: 'join',
          room: this.myroom,
          ptype: 'subscriber',
          streams: subscription,
          private_id: this.mypvtid,
        };
        this.remoteFeed.send({ message: subscribe });
      },
      error: (error) => {
        Janus.error('  -- Error attaching plugin...', error);
      },
      iceState: (state) => {
        Janus.log('ICE state (remote feed) changed to ' + state);
      },
      webrtcState: (on) => {
        Janus.log('Janus says this WebRTC PeerConnection (remote feed) is ' + (on ? 'up' : 'down') + ' now');
      },
      slowLink: (uplink, lost, mid) => {
        Janus.warn(
          'Janus reports problems ' +
            (uplink ? 'sending' : 'receiving') +
            ' packets on mid ' +
            mid +
            ' (' +
            lost +
            ' lost packets)'
        );
      },
      onmessage: (msg, jsep) => {
        Janus.debug(' ::: Got a message (subscriber) :::', msg);
        let event = msg['videoroom'];
        Janus.debug('Event: ' + event);
        if (msg['error']) {
          Janus.error(msg['error']);
        } else if (event) {
          if (event === 'attached') {
            this.creatingFeed = false;
            Janus.log('Successfully attached to feed in room ' + msg['room']);
          } else if (event === 'event') {
            // Check if we got an event on a simulcast-related event from this publisher
            let mid = msg['mid'];
            let substream = msg['substream'];
            let temporal = msg['temporal'];
            if ((substream !== null && substream !== undefined) || (temporal !== null && temporal !== undefined)) {
              // Check which this feed this refers to
              let sub = this.subStreams[mid];
              let feed = this.feedStreams[sub.feed_id];
              let slot = this.slots[mid];
              if (!simulcastStarted[slot]) {
                simulcastStarted[slot] = true;
                // Add some new buttons
                addSimulcastButtons(slot, true);
              }
              // We just received notice that there's been a switch, update the buttons
              updateSimulcastButtons(slot, substream, temporal);
            }
          } else {
            // What has just happened?
          }
        }
        if (msg['streams']) {
          // Update map of subscriptions by mid
          for (let i in msg['streams']) {
            let mid = msg['streams'][i]['mid'];
            this.subStreams[mid] = msg['streams'][i];
            let feed = this.feedStreams[msg['streams'][i]['feed_id']];
            // msg["streams"][i]["feed_display"] This is the subscribed user object relevant to the product
            if (this.feedStreams[msg['streams'][i]['feed_id']]) {
              const currentUser = JSON.parse(msg['streams'][i]['feed_display']);
              this.feedStreams[msg['streams'][i]['feed_id']]['uuid'] = currentUser.uuid;
              this.feedStreams[msg['streams'][i]['feed_id']]['user_context'] = currentUser;
              this.userList.push(currentUser);
            } else continue;
            if (feed && feed.slot) {
              this.slots[mid] = feed.slot;
              this.mids[feed.slot] = mid;
            }
          }
        }
        if (jsep) {
          Janus.debug('Handling SDP as well...', jsep);
          // Answer and attach
          this.remoteFeed.createAnswer({
            jsep: jsep, // Add data:true here if you want to subscribe to datachannels as well
            // (obviously only works if the publisher offered them in the first place)
            media: { audioSend: false, videoSend: false }, // We want recvonly audio/video
            success: (jsep) => {
              Janus.debug('Got SDP!');
              Janus.debug(jsep);
              let body = { request: 'start', room: this.myroom };
              this.remoteFeed.send({ message: body, jsep: jsep });
            },
            error: (error) => {
              Janus.error('WebRTC error:', error);
            },
          });
        }
      },
      onlocaltrack: (track, on) => {
        // The subscriber stream is receive only, we don't expect anything here
      },
      onremotetrack: (track, mid, on) => {
        // this.handleRemoteStreams(track, mid, on);
        // Which publisher are we getting on this mid?
        let sub = this.subStreams[mid];
        let pubID = sub.feed_id;
        let kind = track.kind;
        if (!this.mid_check[pubID]) this.mid_check[pubID] = {};
        if (!this.mid_check[pubID][kind]) {
          this.handleRemoteStreams(track, mid, on);
          this.mid_check[pubID][kind] = true;
        }
      },
      oncleanup: () => {
        Janus.log(' ::: Got a cleanup notification (remote feed) :::');
        for (let i = 1; i < 6; i++) {
          $('#remotevideo' + i).remove();
          $('#waitingvideo' + i).remove();
          $('#novideo' + i).remove();
          $('#curbitrate' + i).remove();
          $('#curres' + i).remove();
          if (this.bitrateTimer[i]) clearInterval(this.bitrateTimer[i]);
          this.bitrateTimer[i] = null;
          this.feedStreams[i].simulcastStarted = false;
          this.feedStreams[i].remoteVideos = 0;
          $('#simulcast' + i).remove();
        }
        this.remoteTracks = {};
      },
    });
  }

  handleRemoteStreams = (track, mid, on) => {
    Janus.log('Remote track (mid=' + mid + ') ' + (on ? 'added' : 'removed') + ':', track);
    // Which publisher are we getting on this mid?
    let sub = this.subStreams[mid];
    let feed = this.feedStreams[sub.feed_id];
    // let uuid = this.pubID_uuid[sub.feed_id];
    let uuid = this.feedStreams[sub.feed_id]['uuid'];
    const userContext = this.feedStreams[sub.feed_id]['user_context'];
    // Don't need to create an element for own published stream
    if (uuid === this.publisher_uuid) {
      Janus.log('Found publisher streams. Destroying.', track);
      track.stop();
      track.enabled = false;
      return;
    }
    let slot = this.slots[mid];
    if (feed && !slot) {
      slot = feed.slot;
      this.slots[mid] = feed.slot;
      this.mids[feed.slot] = mid;
    }
    Janus.debug(' >> mid ' + mid + ' is in slot ' + slot);
    if (!on) {
      // Track removed, get rid of the stream and the rendering
      let stream = this.remoteTracks[mid];
      if (stream) {
        try {
          let tracks = stream.getTracks();
          for (let i in tracks) {
            let mst = tracks[i];
            if (mst) mst.stop();
          }
        } catch (e) {}
      }
      $('#remotevideo' + slot + '-' + mid).remove();
      if (track.kind === 'video' && feed) {
        feed.remoteVideos--;
        if (feed.remoteVideos === 0) {
          // No video, at least for now: show a placeholder
          if ($('#videoremote' + slot + ' .no-video-container').length === 0) {
            $('#videoremote' + slot).append(
              '<div class="no-video-container">' +
                '<i class="fa fa-video-camera fa-5 no-video-icon"></i>' +
                '<span class="no-video-text">No remote video available</span>' +
                '</div>'
            );
          }
        }
      }
      delete this.remoteTracks[mid];
      delete this.slots[mid];
      delete this.mids[slot];
      return;
    }
    // If we're here, a new track was added
    if (feed.spinner) {
      feed.spinner.stop();
      feed.spinner = null;
    }
    let stream = null;
    if (track.kind === 'audio') {
      // New audio track: create a stream out of it, and use a hidden <audio> element
      stream = new MediaStream();
      stream.addTrack(track.clone());
      this.remoteTracks[mid] = stream;
      let sub_dict = {};
      for (let key in this.recent_sub) {
        sub_dict['pubID'] = key;
        sub_dict['uuid'] = this.recent_sub[key];
      }
      let newStreamResponse = {
        type: 'audio',
        stream: stream,
        slot: slot,
        mid: mid,
        sub: { pubID: sub.feed_id, uuid },
        user: userContext,
      };
      MediaStreams.push({ id: uuid, type: 'audio', stream });
      let remoteCall = typeof this.callbacks['remote'] === 'function' ? this.callbacks['remote'] : this.noop();
      remoteCall(newStreamResponse);
      this.state = 0;
    } else {
      // New video track: create a stream out of it
      feed.remoteVideos++;
      $('#videoremote' + slot + ' .no-video-container').remove();
      stream = new MediaStream();
      stream.addTrack(track.clone());
      this.remoteTracks[mid] = stream;
      let newStreamResponse = {
        type: 'video',
        stream: stream,
        slot: slot,
        mid: mid,
        sub: { pubID: sub.feed_id, uuid },
        user: userContext,
      };
      let remoteCall = typeof this.callbacks['remote'] === 'function' ? this.callbacks['remote'] : this.noop();
      if (uuid.includes('___')) {
        let audioContext = {
          type: 'audio',
          stream: null,
          slot: slot,
          mid: mid,
          sub: { pubID: sub.feed_id, uuid },
          user: userContext,
        };
        remoteCall(audioContext);
      }
      MediaStreams.push({ id: uuid, type: 'video', stream });
      console.log('newStreamResponse :>>>>>>>>>>>>>> ', newStreamResponse);
      remoteCall(newStreamResponse);
      this.state = 0;
    }
  };

  unsubscribeFrom(id) {
    // Unsubscribe from this publisher
    let feed = this.feedStreams[id];
    if (!feed) return;
    Janus.debug('Feed ' + id + ' (' + feed.display + ') has left the room, detaching');
    if (this.bitrateTimer[feed.slot]) clearInterval(this.bitrateTimer[feed.slot]);
    this.bitrateTimer[feed.slot] = null;
    delete this.simulcastStarted[feed.slot];
    delete this.feeds[feed.slot];
    this.feeds.slot = 0;
    delete this.feedStreams[id];
    // Send an unsubscribe request
    let unsubscribe = {
      request: 'unsubscribe',
      streams: [{ feed: id }],
    };
    if (this.remoteFeed != null) this.remoteFeed.send({ message: unsubscribe });
    delete this.subscriptions[id];
  }

  isEmpty(obj) {
    for (let key in obj) {
      if (obj.hasOwnProperty(key)) return false;
    }
    return true;
  }
}

class MediaDev {
  constructor() {
    this.initialize();
  }

  static isWebrtcSupported() {
    return navigator.mediaDevices !== undefined;
  }

  get mediaStream() {
    if (this.stream) return this.stream;
    else {
      console.error(
        "There is no media-stream fetched for this interface. Are you sure you called the 'start()' method of the object ? "
      );
      return null;
    }
  }

  get availableDevices() {
    if (this.enumerated === true) {
      const mediaArray = [];
      for (let label in this.MediaDevices) {
        if (Array.isArray(this.MediaDevices[label])) {
          for (let { kind, id } of this.MediaDevices[label]) mediaArray.push({ label, type: kind, id });
        } else mediaArray.push({ label, type: this.MediaDevices[label].kind, id: this.MediaDevices[label].id });
      }
      return mediaArray;
    } else {
      // console.error(
      //   "The devices have not been enumerated. Are you sure you called the 'start()' method of the object ? "
      // );
    }
  }

  noop = () => {};

  on(event, callback) {
    this.callbacks[event] = callback;
  }

  initialize() {
    if (!MediaDev.isWebrtcSupported()) {
      const mediaErrCB =
        typeof this.callbacks['media-error'] === 'function' ? this.callbacks['media-error'] : this.noop;
      return mediaErrCB('WebRTC is not supported in this browser.');
    }
    this.outAudio = null;
    this.stream = null;
    this.audio = true;
    this.video = true;
    this.enumerated = false;
    this.callbacks = {
      'media-error': (err) => console.log('Error : ', err),
    };
    this.MediaDevices = {};
    this.registerEvents();
  }

  registerEvents = () => {
    navigator.mediaDevices.addEventListener('devicechange', (event) => {
      console.log('Media devices changed : -> ', event);
      this.enumerate();
    });
  };

  start = (video = true, audio = true) => {
    // const vid = {
    //   height: { ideal: 360 },
    //   width: { ideal: 478 },
    //   aspectRatio: { ideal: 1.33 },
    //   facingMode: 'user',
    //   resizeMode: 'crop-and-scale',
    // };
    if (video && audio) {
      this.mediaStreamInit(null, video);
      this.enumerate();
    } else if (audio && !video) {
      this.mediaStreamInit(null, false);
    } else if (video && !audio) {
      this.mediaStreamInit(false, video);
    } else {
      console.log('invalid params');
    }
  };

  enumerate = () => {
    setTimeout(() => {
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        devices.forEach((device) => {
          const { kind, label, deviceId, groupId } = device;
          if (!this.MediaDevices[label]) this.MediaDevices[label] = { kind, id: deviceId, groupId };
          else {
            if (this.MediaDevices[label].id !== deviceId)
              this.MediaDevices[label] = [
                this.MediaDevices[label],
                {
                  kind,
                  id: deviceId,
                  groupId,
                },
              ];
          }
        });
        this.enumerated = true;
        const enumCB = typeof this.callbacks['enumerated'] === 'function' ? this.callbacks['enumerated'] : this.noop;
        enumCB(this.MediaDevices);
      });
    }, 3000);
  };

  mediaStreamInit(audio, video, tries = 0) {
    let aud = audio || { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
    let vid = video || { width: 160, height: 120, ratio: '4:3' };
    console.log(`User media called with constraints :`, aud, ' -:- ', vid);
    navigator.mediaDevices
      .getUserMedia({ audio: aud, video: vid })
      .then((stream) => {
        this.stream = stream;
        let newStreamCB = typeof this.callbacks['media'] === 'function' ? this.callbacks['media'] : this.noop;
        newStreamCB(stream);
      })
      .catch((err) => {
        const mediaErrCB =
          typeof this.callbacks['media-error'] === 'function' ? this.callbacks['media-error'] : this.noop;
        console.log('mediastream error : ', err);
        mediaErrCB(err);
        // ++tries;
        // const delay = (tries > 0 ? tries : 1) * 1000;
        // console.log('retrying media fetch after : ', delay);
        // if (tries <= 10) {
        //   setTimeout(() => {
        //     // if (tries <= 3) this.mediaStreamInit(true, true, tries);
        //     // else
        //     this.mediaStreamInit(true, true, tries);
        //   }, delay);
        // }
      });
  }

  stop = () => {
    console.log('Stopping mediaStream.');
    if (!this.stream) return console.error('Error stopping stream. No stream initialized.');
    const tracks = this.stream.getTracks();
    tracks.forEach((track) => {
      console.log("stopping track: ",track);
      track.stop();
    });
    // this.stream = null;
  };

  deviceId = (label) => {
    return this.MediaDevices[label].id;
  };

  deviceGroupId = (label) => {
    return this.MediaDevices[label].groupId;
  };

  deltaMedia = (label, id = null) => {
    let localChange = null;
    if (!this.MediaDevices[label])
      return console.error('I do not recognize this device please help me enumerate this device.');
    let kind;
    if (Array.isArray(this.MediaDevices[label])) {
      if (id) {
        const entry = this.MediaDevices[label].find((device) => device.id === id);
        if (entry) kind = entry.kind;
        else console.error('I do not possess info of device with id: ', id);
      } else kind = this.MediaDevices[label][0].kind;
    } else kind = this.MediaDevices[label].kind;
    if (!kind) {
      console.error('Please define the valid kind');
      return;
    }
    let deviceId = null;
    if (!id) deviceId = this.MediaDevices[label].id;
    else deviceId = id;
    console.log('Switching to :', label, ' -:- with ID : ', deviceId);
    switch (kind) {
      case 'audioinput':
        localChange = 'AIn';
        console.log('got audioinput', kind);
        this.audio = { deviceId };
        break;
      case 'videoinput':
        localChange = 'VIn';
        console.log('got videoinput', kind);
        this.video = { deviceId };
        break;
      case 'audiooutput':
        localChange = 'AOut';
        // this.outAudio;
        console.log('got audiooutput');
        break;
      case 'videooutput':
        localChange = 'VOut';
        // this.outVideo;
        console.log('got videooutput');
        break;
      default:
        localChange = 'n/a';
        console.log('Unexpected kind : ', kind);
        break;
    }
    if (localChange === 'AIn' || localChange === 'VIn') {
      if (this.stream) {
        const tracks = this.stream.getTracks();
        tracks.forEach((track) => track.stop());
        this.stream = null;
        this.changeStream();
      } else {
        this.changeStream();
      }
    }
  };

  changeStream = () => {
    this.mediaStreamInit(this.audio, this.video);
  };

  toggleVideo = (flag = true) => {
    if (typeof flag !== 'boolean') {
      console.error(`Wrong value ${flag} supplied to the method MediaDev.toggleVideo`);
      return;
    }
    let vidTrack = this.stream.getVideoTracks()[0];
    vidTrack.enabled = flag;
    // let vidToggleCB = typeof this.callbacks['toggle-video'] === 'function' ? this.callbacks['toggle-video'] : this.noop;
    // vidToggleCB(flag);
  };

  toggleAudio = (flag = true) => {
    if (typeof flag !== 'boolean') {
      console.error(`Wrong value ${flag} supplied to the method MediaDev.toggleAudio`);
      return;
    }
    let audTrack = this.stream.getAudioTracks()[0];
    audTrack.enabled = flag;
    // let audToggleCB = typeof this.callbacks['toggle-audio'] === 'function' ? this.callbacks['toggle-audio'] : this.noop;
    // audToggleCB(flag);
  };
}

const mediaDev = new MediaDev();

const fetchAvailableInstanceBack = (link, ip, callback = () => {}) => {
  console.log('Got IP and link : ', ip, ' -:- ', link);
  // if (socket) {
  //   socket.disconnect();
  //   socket = null;
  // }
  const CB = typeof callback === 'function' ? callback : () => {};
  if (link && ip) {
    dynamoIp = '34.212.174.197'; // ip;
    dynamoLink = '34_212_174_197'; // link;
    socket = io(`localhost:8666`, {
      query: { ID, Name, RoomId },
      path: `/34_212_174_197/sock`,
      transports: ['websocket'],
      reconnect: true,
    }); // https://call.monetanalytics.com /${link}/
    registerSocketEvents();
    return CB({ allotted: true });
  } else {
    fetch('https://call.monetanalytics.com/meteor/get-link?secret=janusoverlord')
      .then((response) => response.json())
      .then((response) => {
        const data = response.data;
        dynamoIp = '34.212.174.197'; //data.ip;
        dynamoLink = 'localhost:8666'; //https://call.monetanalytics.com
        socket = io(dynamoLink, {
          query: { ID, Name, RoomId },
          path: `/34_212_174_197/sock`,
          transports: ['websocket'],
          reconnect: true,
        }); // /${link}/
        dynamoLink = '34_212_174_197'; // data.route;
        registerSocketEvents();
        if (typeof data.response === 'string')
          if (data.response.includes('No instances available.')) return CB({ allotted: false });
        return CB({ allotted: true });
      });
  }
};

const fetchAvailableInstance = (link, ip, callback = () => {}) => {
  console.log('Got IP and link : ', ip, ' -:- ', link);
  // if (socket) {
  //   socket.disconnect();
  //   socket = null;
  // }
  const CB = typeof callback === 'function' ? callback : () => {};
  if (link !== null && ip !== null && ip !== undefined && link !== undefined) {
    dynamoIp = ip;
    dynamoLink = link;
    socket = io(`https://www.monetlive.com`, {
      query: { ID, Name, RoomId },
      path: `/${link}/sock`,
      transports: ['websocket'],
      reconnect: true,
    });
    registerSocketEvents();
    return CB({ allotted: true });
  } else {
    fetch('https://www.monetlive.com/meteor/get-link?secret=janusoverlord')
      .then((response) => response.json())
      .then((response) => {
        const data = response.data;
        console.log(data);
        dynamoIp = data.ip;
        dynamoLink = 'https://www.monetlive.com';
        socket = io(dynamoLink, {
          query: { ID, Name, RoomId },
          path: `/${data.route}/sock`,
          transports: ['websocket'],
          reconnect: true,
        });
        dynamoLink = data.route;
        registerSocketEvents();
        if (typeof data.response === 'string')
          if (data.response.includes('No instances available.')) return CB({ allotted: false });
        return CB({ allotted: true });
      });
  }
};

const registerSocketEvents = (ip) => {
  socket.on('connect', () => console.log('Socket connected with id ', socket.id));

  socket.on('error', ({ msg }) => console.log(msg));

  socket.on('room-audio', (res) => console.log(res));

  socket.on('leave', ({ userObj }) => {
    const { uuid } = userObj;
    let mediaArray = MediaStreams.filter((r) => r.id === uuid);
    for (let med of mediaArray) {
      if (!med.stream) return;
      for (let track of med.stream.getTracks()) {
        track.stop();
        track.enabled = false;
      }
    }
    MediaStreams = MediaStreams.filter((r) => r.id !== uuid);
  });
};
