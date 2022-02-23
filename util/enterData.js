exports.enterData = (sector, entry, Quad) => {
  Quad[sector].entries++;
  if (!Quad[sector].users.includes(entry.uuid)) {
    Quad[sector].UEA[entry.uuid] = {
      low_eng: [],
      med_eng: [],
      hi_eng: [],
      camoff_eng: [],
      low_mo: [],
      med_mo: [],
      hi_mo: [],
      camoff_mo: [],
    };
    Quad[sector].users.push(entry.uuid);
  }
  if (entry.webcam === 0) {
    Quad[sector].UEA[entry.uuid].camoff_eng.push(entry.engagement);
    Quad[sector].UEA[entry.uuid].camoff_mo.push(entry.engagement);
    Quad[sector].camoff.push({
      uuid: entry.uuid,
      engagement: entry.engagement,
      mood: entry.mood,
      createdAt: entry.createdAt,
    });
  } else if (entry.engagement > 80) {
    Quad[sector].UEA[entry.uuid].hi_eng.push(entry.engagement);
  } else if (entry.engagement > 60) {
    Quad[sector].UEA[entry.uuid].med_eng.push(entry.engagement);
  } else {
    Quad[sector].UEA[entry.uuid].low_eng.push(entry.engagement);
  }
  if (entry.mood > 80) Quad[sector].UEA[entry.uuid].hi_mo.push(entry.mood);
  else if (entry.mood > 60) Quad[sector].UEA[entry.uuid].med_mo.push(entry.mood);
  else Quad[sector].UEA[entry.uuid].low_mo.push(entry.mood);
  return Quad;
};
