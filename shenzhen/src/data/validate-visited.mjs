/**
 * @param {unknown} value
 * @param {Set<string>} stationIds Operating station ids only.
 * @returns {string[]}
 */
export function validateVisitedStations(value, stationIds) {
  if (!Array.isArray(value)) throw new Error('visited-stations.json 必须是数组。');
  const seen = new Set();
  for (const id of value) {
    if (typeof id !== 'string' || !stationIds.has(id)) {
      throw new Error(`visited-stations.json 存在未知或未开通站点：${String(id)}，请使用 stations.ts 中的运营站中文 id。`);
    }
    if (seen.has(id)) throw new Error(`visited-stations.json 存在重复站点：${id}`);
    seen.add(id);
  }
  return value;
}
