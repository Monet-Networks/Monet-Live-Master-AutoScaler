exports.wranggleQuad = async (sector, Quad, nameArray) => {
  Quad[sector].no_users = Quad[sector].users.length;
  // Array of keys
  for (const key in Quad[sector].UEA) {

    let low_eng = Quad[sector].UEA[key].low_eng.length ? Quad[sector].UEA[key].low_eng.reduce(redAvg) : 0;

    let med_eng = Quad[sector].UEA[key].med_eng.length ? Quad[sector].UEA[key].med_eng.reduce(redAvg) : 0;

    let hi_eng = Quad[sector].UEA[key].hi_eng.length ? Quad[sector].UEA[key].hi_eng.reduce(redAvg) : 0;

    let camoff_eng = Quad[sector].UEA[key].camoff_eng.length ? Quad[sector].UEA[key].camoff_eng.reduce(redAvg) : 0;

    let low_mo = Quad[sector].UEA[key].low_mo.length ? Quad[sector].UEA[key].low_mo.reduce(redAvg) : 0;

    let med_mo = Quad[sector].UEA[key].med_mo.length ? Quad[sector].UEA[key].med_mo.reduce(redAvg) : 0;

    let hi_mo = Quad[sector].UEA[key].hi_mo.length ? Quad[sector].UEA[key].hi_mo.reduce(redAvg) : 0;

    let camoff_mo = Quad[sector].UEA[key].camoff_mo.length ? Quad[sector].UEA[key].camoff_mo.reduce(redAvg) : 0;

    let totalLength =
      Quad[sector].UEA[key].low_eng.length +
      Quad[sector].UEA[key].med_eng.length +
      Quad[sector].UEA[key].hi_eng.length +
      Quad[sector].UEA[key].camoff_eng.length;
    const average_eng = (low_eng + med_eng + hi_eng + camoff_eng) / totalLength;
    const average_mo = (low_mo + med_mo + hi_mo + camoff_mo) / totalLength;
    const entry = nameArray.find((r) => r.uuid === key);
    if (!entry) return;
    const name = entry.name;
    Quad[sector].UAE.push({
      uuid: key,
      average: average_eng,
      average_mood: average_mo,
      name,
    });
    if (average_eng > 80) Quad[sector].hi_percentage[1]['uuid'].push(key);
    else if (average_eng > 60) Quad[sector].med_percentage[1]['uuid'].push(key);
    else Quad[sector].low_percentage[1]['uuid'].push(key);
    if (average_mo > 80) Quad[sector].hi_percentage[2]['uuid'].push(key);
    else if (average_mo > 60) Quad[sector].med_percentage[2]['uuid'].push(key);
    else Quad[sector].low_percentage[2]['uuid'].push(key);
  }

  /*
    Schematics index value relevance for arrays below
    The array: ----------------------------------------->
    [0] index is overall average engagement percentage, [1] is array of uuids with average engagement,
    [2] is array of uuids with average mood, [3] is percentage overall average mood percentage.
    -----------------------------------------------XXX-----------------------------------------------
  */

  Quad[sector].hi_percentage[0] = (Quad[sector].hi_percentage[1]['uuid'].length * 100) / Quad[sector].no_users;
  Quad[sector].med_percentage[0] = (Quad[sector].med_percentage[1]['uuid'].length * 100) / Quad[sector].no_users;
  Quad[sector].low_percentage[0] = (Quad[sector].low_percentage[1]['uuid'].length * 100) / Quad[sector].no_users;
  Quad[sector].hi_percentage[3] = (Quad[sector].hi_percentage[2]['uuid'].length * 100) / Quad[sector].no_users;
  Quad[sector].med_percentage[3] = (Quad[sector].med_percentage[2]['uuid'].length * 100) / Quad[sector].no_users;
  Quad[sector].low_percentage[3] = (Quad[sector].low_percentage[2]['uuid'].length * 100) / Quad[sector].no_users;
  delete Quad[sector].users;
  delete Quad[sector].med;
  delete Quad[sector].low;
  delete Quad[sector].hi;
  delete Quad[sector].UEA;
  delete Quad[sector].camoff_percentage;
  return Quad;
};

function redAvg(acc, next) {
  return acc + next;
}
