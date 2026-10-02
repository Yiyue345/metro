/**
 * @param {unknown} value
 * @param {Set<string>} stationIds
 * @returns {Record<string, string>}
 */
export function validateStationNotes(value, stationIds) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('station-notes.json 必须是以站点中文 id 为键的对象。');
  }
  for (const [id, note] of Object.entries(value)) {
    if (!stationIds.has(id)) throw new Error(`station-notes.json 存在未知站点：${id}`);
    if (typeof note !== 'string' || note.length > 5000) {
      throw new Error(`station-notes.json 的 ${id} 说明必须是最多 5000 字符的文本。`);
    }
  }
  return /** @type {Record<string, string>} */ (value);
}
