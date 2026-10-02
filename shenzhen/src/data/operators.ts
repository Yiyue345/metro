export const operators = {
  szmetro: { name: '深圳地铁', logo: '/operators/shenzhen-metro.png', url: 'https://www.szmc.net/', company: '深圳地铁运营集团有限公司' },
  mtr: { name: '港铁（深圳）', logo: '/operators/mtr-shenzhen.png', url: 'https://www.mtrsz.com.cn/', company: '港铁轨道交通（深圳）有限公司' },
};

// Line 13 northern extension is jointly operated by MTR's project company and SZ Metro.
const line13North = new Set(['红坳公园', '光明城', '德雅路', '月亮路', '凤凰城', '光明大街', '将围', '新庄', '公明广场', '上村', '下村', '李松蓢']);

export function stationOperators(station: { id: string; lines: string[]; status?: string }) {
  if (station.status === 'planned') return [];
  const ids = new Set<keyof typeof operators>();
  for (const line of station.lines) {
    ids.add(line === '4' || line === '13' ? 'mtr' : 'szmetro');
    if (line === '13' && line13North.has(station.id)) ids.add('szmetro');
  }
  return [...ids].map(id => ({
    id, ...operators[id],
    company: id === 'mtr' && station.lines.includes('13')
      ? [station.lines.includes('4') ? operators.mtr.company : '', '港铁中铁电化轨道交通（深圳）有限公司'].filter(Boolean).join('；')
      : operators[id].company,
  }));
}
