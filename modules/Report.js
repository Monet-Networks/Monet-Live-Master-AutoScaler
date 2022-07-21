const fdModel = require('../models/faceData.model');
const Session = require('../models/sessions.model');
const initDB = require('./db');
const colors = require('colors');
new initDB();

class RepEngine {
  len;
  data;
  duration;
  maxDate;
  minDate;
  quadLength;
  Quad = [];
  Users;

  cTSegments = [];

  constructor(roomId) {
    if (typeof roomId !== 'string') throw new Error('Invalid roomId');
    this.RoomId = roomId;
    this.fetchData();
  }

  fetchData = async () => {
    this.User = await Session.find({ roomid: this.RoomId }, 'uuid name');
    this.data = await fdModel.find({ roomid: this.RoomId }).sort({ createdAt: 1 }).lean();
    this.len = this.data.length;
    if (this.len === 0) {
      console.log(`No data recorded for the session ${this.RoomId}. Please check what went wrong.`);
      return [];
    }
    this.duration = (this.data[this.len - 1].createdAt - this.data[0].createdAt) / (1000 * 60);
    this.maxDate = this.data[this.len - 1].createdAt;
    this.minDate = this.data[0].createdAt;
    this.quadLength = Math.floor(this.duration / 4);
    const meta = `
Data fetched successfully -
length : ${this.len}
min time stamp : ${this.minDate}
max time stamp : ${this.maxDate}
duration : ${this.duration}
layout :`.magenta;
    console.log(meta, this.data[0]);
    this.munge();
  };

  munge = () => {
    /* Munging will be done here.
     *  We will need to create relevant data structures here.
     *  - Pie chart calculations
     *  - Overall engagement
     */
    // 1. we create relevant data structures.
    this.createQuads();
    this.createSegmentedArray();
    // 2. we populate the relevant data structures with transactional data.
    for (let i = 0; i < this.len; i++) {
      this.mungePieData(this.data[i]);
      const { createdAt, engagement, mood } = this.data[i];
      const entry = {
        createdAt,
        engagement,
        mood,
      };
      this.popEntry(entry, 0, this.data.length - 1);
      // console.log(this.data[i]);
    }
    // 3. we process the populated data structures and derive meaningful data.
    this.wranggleQuads();
  };

  // ================================================================================================= Overall Engagement

  /**
   * @description This class populates the cTSegments array with relevant data point entries.
   * @param {object} dp
   * @param {number} start
   * @param {number} end
   * @memberof RepEngine
   */
  popEntry = (dp, start, end) => {
    // Find entry in the segmented array.
    // Binary search for the most suitable index.
    if (typeof start !== 'number' || typeof end !== 'number' || start > end) {
      throw new Error('missing or invalid mandatory parameter(s)', start, end);
    }
    let slArr = this.cTSegments.slice(start, end);
    if (slArr.length === 1) {
      slArr[0].dPs.push(dp);
      return;
    }
    const div = Math.round(slArr.length / 2);
    const entry = slArr[div];
    const { stamp } = entry;
    let newStart, newEnd;
    console.log('Called this');
    const stampDiff = Math.abs(dp.createdAt - stamp);
    if (stampDiff < 1000) {
      // Add the data point to the dp
      entry.dPs.push(dp);
      return;
    } else if (dp.createdAt < stamp) {
      newStart = start;
      newEnd = div;
    } else {
      newStart = div;
      newEnd = end;
    }
    if (newStart < newEnd) this.popEntry(dp, newStart, newEnd);
  };

  createSegmentedArray = () => {
    let tmp_min = this.minDate;
    const tmp_max = this.maxDate;
    while (tmp_min <= tmp_max) {
      this.cTSegments.push({ stamp: tmp_min, dPs: [] });
      tmp_min = new Date(tmp_min.getTime() + 1000);
    }
  };

  // =================================================================================================

  // ================================================================================================= Pie Data

  /**
   * @description buckets db entries into relvant quadrants
   * @param {object} r
   * @memberof RepEngine
   */
  mungePieData = (r) => {
    let timestmp = r.createdAt;
    const { uuid, webcam, engagement, mood } = r;
    const entry = {
      uuid,
      webcam,
      engagement,
      mood,
    };
    const { Quad } = this;
    if (!Quad || !Array.isArray(Quad)) {
      throw new Error(`No quadrant array spun up for ${this.RoomId}`);
    }
    if (Quad[0].min <= timestmp && timestmp <= Quad[0].max) this.addPieEntry(0, entry);
    else if (Quad[1].min < timestmp && timestmp <= Quad[1].max) this.addPieEntry(1, entry);
    else if (Quad[2].min < timestmp && timestmp <= Quad[2].max) this.addPieEntry(2, entry);
    else if (Quad[3].min < timestmp && timestmp <= Quad[3].max) this.addPieEntry(3, entry);
    else throw new Error('There is some flaw in the code for the entry : ', r);
  };

  /**
   * @description creates and populate arrays within temp object. To be used for final data parsing.
   * @param {number} sector
   * @param {object} entry
   * @memberof RepEngine
   */
  addPieEntry = (sector, entry) => {
    const { Quad } = this;
    const Sector = Quad[sector];
    if (!Sector) throw new Error(`No sector ${sector} found in Quad`);
    const { users, temp } = Sector;
    const { uuid, webcam, engagement, mood } = entry; // DB entry
    ++Sector.entries;
    if (!users.includes(uuid)) {
      temp[uuid] = {
        eng: 0,
        mo: 0,
        len: 0,
        // low_eng: [],
        // med_eng: [],
        // hi_eng: [],
        camoff_eng: [],
        // med_mo: [],
        // low_mo: [],
        // hi_mo: [],
        camoff_mo: [],
      };
      users.push(uuid);
    }
    const { camoff_eng, camoff_mo } = temp[uuid]; // Temporary Array Collection
    if (webcam === 0) {
      camoff_eng.push(engagement);
      camoff_mo.push(mood);
      return;
    }
    temp[uuid].eng += engagement;
    temp[uuid].mo += mood;
    ++temp[uuid].len;
    // Push engagement to relevant bucket
    // if (engagement > 80) hi_eng.push(engagement);
    // else if (engagement > 60) med_eng.push(engagement);
    // else low_eng.push(engagement);
    // // Push mood to relevant bucket
    // if (mood > 80) hi_mo.push(mood);
    // else if (mood > 60) med_mo.push(mood);
    // else low_mo.push(mood);
  };

  /**
   * @description populates quadrants with relevant timestamps
   * @memberof RepEngine
   */
  createQuads = () => {
    let i = 0,
      tmp_min = this.minDate,
      tmp_max = new Date(this.minDate.getTime() + this.quadLength * 1000 * 60);
    while (i < 4) {
      this.Quad.push({
        min: tmp_min,
        max: tmp_max,
        users: [],
        temp: {},
        userAverages: [],
        hiPercentage: {
          engSector: 0,
          moodSector: 0,
          engagement: [],
          mood: [],
        },
        medPercentage: {
          engSector: 0,
          moodSector: 0,
          engagement: [],
          mood: [],
        },
        lowPercentage: {
          engSector: 0,
          moodSector: 0,
          engagement: [],
          mood: [],
        },
        camoffPercentage: {
          engSector: 0,
          moodSector: 0,
          engagement: [],
          mood: [],
        },
        noUsers: 0,
        entries: 0,
      });
      tmp_min = tmp_max;
      tmp_max = new Date(tmp_max.getTime() + this.quadLength * 1000 * 60);
      if (i === 2) tmp_max = this.maxDate;
      i++;
    }
  };

  /**
   * @description post processes quadrants populated with temp array.
   * @memberof RepEngine
   */
  wranggleQuads = () => {
    let i = 0;
    const { Quad } = this;
    while (i < 4) {
      const Sector = Quad[i];
      const { temp, userAverages, hiPercentage, medPercentage, lowPercentage } = Sector;
      Sector.noUsers = Sector.users.length;
      for (const userId in temp) {
        // const { low_eng, med_eng, hi_eng, low_mo, med_mo, hi_mo, camoff_eng, camoff_mo } = temp[userId];
        const { mo, eng, len } = temp[userId];
        // const overall_low_eng = low_eng.length ? low_eng.reduce(this.redSum) : 0;
        // const overall_med_eng = med_eng.length ? med_eng.reduce(this.redSum) : 0;
        // const overall_hi_eng = hi_eng.length ? hi_eng.reduce(this.redSum) : 0;
        // const overall_camoff_eng = camoff_eng.length ? camoff_eng.reduce(this.redSum) : 0;
        // const overall_low_mo = low_mo.length ? low_mo.reduce(this.redSum) : 0;
        // const overall_med_mo = med_mo.length ? med_mo.reduce(this.redSum) : 0;
        // const overall_hi_mo = hi_mo.length ? hi_mo.reduce(this.redSum) : 0;
        // const overall_camoff_mo = camoff_mo.length ? camoff_mo.reduce(this.redSum) : 0;

        // const totalEngLength = low_eng.length + med_eng.length + hi_eng.length + camoff_eng.length;

        // const averageEng = (overall_low_eng + overall_med_eng + overall_hi_eng + overall_camoff_eng) / totalEngLength;

        // const averageMo = (overall_low_mo + overall_med_mo + overall_hi_mo + overall_camoff_mo) / totalEngLength;

        const averageEng = eng / len;
        const averageMo = mo / len;

        const sessionEntry = this.User.find((r) => r.uuid === userId);
        const { name } = sessionEntry;
        userAverages.push({
          uuid: userId,
          averageEng,
          averageMo,
          name,
        });

        if (averageEng > 80) hiPercentage.engagement.push(userId);
        else if (averageEng > 60) medPercentage.engagement.push(userId);
        else lowPercentage.engagement.push(userId);

        if (averageMo > 80) hiPercentage.mood.push(userId);
        else if (averageMo > 60) medPercentage.mood.push(userId);
        else lowPercentage.mood.push(userId);
      }

      if (Sector.noUsers.length === 0) continue;

      hiPercentage.engSector = ((hiPercentage.engagement.length * 100) / Sector.noUsers).toFixed(2);
      medPercentage.engSector = ((medPercentage.engagement.length * 100) / Sector.noUsers).toFixed(2);
      lowPercentage.engSector = ((lowPercentage.engagement.length * 100) / Sector.noUsers).toFixed(2);

      hiPercentage.moodSector = ((hiPercentage.mood.length * 100) / Sector.noUsers).toFixed(2);
      medPercentage.moodSector = ((medPercentage.mood.length * 100) / Sector.noUsers).toFixed(2);
      lowPercentage.moodSector = ((lowPercentage.mood.length * 100) / Sector.noUsers).toFixed(2);

      delete Sector.temp;
      i++;
    }

    console.log(Quad);
  };

  redSum = (acc, next) => acc + next;

  // =================================================================================================
}

new RepEngine('1657795180359');
