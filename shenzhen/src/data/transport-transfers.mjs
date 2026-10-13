export const transportModeLabels = {
  rail: '国铁', highSpeedRail: '高铁', airport: '航空', ferry: '轮渡', gdIntercity: '广东城际',
};
export const transportAccessLabels = { direct: '通道换乘', walk: '出站步行', shuttle: '接驳巴士' };

// Classify the railway serving the station, including shared approaches and connecting lines.
// A G/D/C train number alone does not change the category of the railway it runs on.
export const railwayTransportModes = {
  '广深铁路': 'rail', '湘桂铁路': 'rail', '南昆铁路': 'rail', '南防铁路': 'rail',
  '广深港高速铁路': 'highSpeedRail', '赣深高速铁路': 'highSpeedRail', '厦深铁路': 'highSpeedRail',
  '南昆客运专线': 'highSpeedRail', '南凭高速铁路': 'highSpeedRail', '柳南客运专线': 'highSpeedRail',
  '南广铁路': 'highSpeedRail', '南钦铁路': 'highSpeedRail', '贵南高速铁路': 'highSpeedRail',
  '南珠高铁南玉段': 'highSpeedRail',
  '沪昆铁路': 'rail', '成昆铁路': 'rail',
  '沪昆高速铁路': 'highSpeedRail',
  '穗深城际铁路': 'gdIntercity', '广惠城际铁路': 'gdIntercity',
};

/** @param {unknown} value @param {Set<string>} stationIds */
export function validateTransportTransfers(value, stationIds) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('transport-transfers.json 必须是站点换乘配置对象。');
  for (const [id, transfers] of Object.entries(value)) {
    if (!stationIds.has(id)) throw new Error(`换乘标志包含未知或未开通站点：${id}`);
    if (!Array.isArray(transfers) || !transfers.length || transfers.length > 5) throw new Error(`${id} 的换乘标志必须为 1–5 项。`);
    const modes = new Set();
    for (const transfer of transfers) {
      if (!transfer || typeof transfer !== 'object' || !Object.hasOwn(transportModeLabels, transfer.mode)
        || !Object.hasOwn(transportAccessLabels, transfer.access) || typeof transfer.destination !== 'string'
        || !transfer.destination.trim() || transfer.destination.length > 100 || modes.has(transfer.mode)) {
        throw new Error(`${id} 的换乘标志存在无效类型、接驳方式、目的地或重复类型。`);
      }
      if (['rail', 'highSpeedRail', 'gdIntercity'].includes(transfer.mode)
        && (!Array.isArray(transfer.railways) || !transfer.railways.length
          || transfer.railways.length > 10 || new Set(transfer.railways).size !== transfer.railways.length
          || transfer.railways.some(railway => typeof railway !== 'string'
            || !Object.hasOwn(railwayTransportModes, railway) || railwayTransportModes[railway] !== transfer.mode))) {
        throw new Error(`${id} 的铁路标志必须与已核对的接入铁路类型一致。`);
      }
      modes.add(transfer.mode);
    }
  }
}
