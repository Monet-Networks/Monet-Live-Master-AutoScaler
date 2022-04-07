const { enterData } = require('./enterData');
const { wranggleQuad } = require('./wranggleQuad');

exports.createQuad = (nameArray, data, req, res, dur, cb = false) => {
  let Quad = [];
  const dynamic_data = {
    Max_date: null,
    Min_date: null,
    // Quad_round: null,
    // Quad_floor: null,
  };
  // ===================== Skippable =======================
  if (!data) return;
  if (!data[0]) return;
  // let maxdt = new Date(data[0].createdAt);
  // let mindt = new Date(data[0].createdAt);
  const { min_date, max_date } = dur;
  let maxdt = new Date(max_date);
  let mindt = new Date(min_date);
  // data.forEach((r) => {
  //   const currentdt = new Date(r.createdAt);
  //   if (currentdt > maxdt) maxdt = currentdt;
  //   if (currentdt < mindt) mindt = currentdt;
  // });
  dynamic_data.Max_date = maxdt;
  dynamic_data.Min_date = mindt;
  // dynamic_data.Quad_round = Math.round((maxdt - mindt) / (60 * 1000 * 4));
  // dynamic_data.Quad_floor = Math.floor((maxdt - mindt) / (60 * 1000 * 4));
  // ===================== Skippable =======================
  // const duration = (dynamic_data.Max_date - dynamic_data.Min_date) / 60000;
  const duration = (dynamic_data.Max_date - dynamic_data.Min_date) / 60000;
  const quad_length = Math.floor(duration / 4);
  let i = 0,
    tmp_min = new Date(dynamic_data.Min_date),
    tmp_max = new Date(dynamic_data.Min_date.getTime() + quad_length * 60000);
  while (i < 4) {
    Quad.push({
      min: tmp_min,
      max: tmp_max,
      users: [],
      UAE: [],
      UEA: {},
      no_users: 0,
      entries: 0,
      gap: ((tmp_max - tmp_min) / 60000).toFixed(2),
      low: [],
      med: [],
      hi: [],
      low_percentage: [null, { uuid: [] }, { uuid: [] }],
      med_percentage: [null, { uuid: [] }, { uuid: [] }],
      hi_percentage: [null, { uuid: [] }, { uuid: [] }],
      camoff_percentage: [null, { uuid: [] }, { uuid: [] }],
      camoff: [],
    });
    tmp_min = tmp_max;
    tmp_max = new Date(tmp_max.getTime() + quad_length * 60000);
    if (i === 2) tmp_max = dynamic_data.Max_date;
    i++;
  }
  data.forEach((r) => {
    let timestmp = new Date(r.createdAt);
    if (Quad[0].min <= timestmp && timestmp <= Quad[0].max) Quad = enterData(0, r, Quad);
    else if (Quad[1].min < timestmp && timestmp <= Quad[1].max) Quad = enterData(1, r, Quad);
    else if (Quad[2].min < timestmp && timestmp <= Quad[2].max) Quad = enterData(2, r, Quad);
    else if (Quad[3].min < timestmp && timestmp <= Quad[3].max) Quad = enterData(3, r, Quad);
    else {
      console.error('There is some flaw in the code for the entry : ', r);
    }
  });
  wranggleQuad(0, Quad, nameArray);
  wranggleQuad(1, Quad, nameArray);
  wranggleQuad(2, Quad, nameArray);
  wranggleQuad(3, Quad, nameArray);
  if (cb) {
    return Quad;
  } else {
    res.json({
      code: 200,
      error: false,
      message: 'pie chart segment data',
      response: Quad,
    });
  }
};
