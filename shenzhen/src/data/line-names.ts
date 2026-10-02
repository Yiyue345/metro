// Traditional and commonly used route names, alongside the current line numbers.
export const lineNames: Record<string, string> = {
  '1': '罗宝线', '2': '蛇口线', '3': '龙岗线', '4': '龙华线',
  '5': '环中线', '6': '光明线', '6b': '光明支线', '7': '西丽线',
  '8': '盐田线', '9': '梅林线', '10': '坂田线', '11': '机场线',
  '12': '南宝线', '13': '石岩线', '14': '东部快线', '16': '龙坪线', '20': '会展线',
};

export function lineTitle(id: string, fallback = id) {
  const number = id === '6b' ? '6 号线支线' : /^\d+$/.test(id) ? `${id} 号线` : fallback;
  return lineNames[id] ? `${number} / ${lineNames[id]}` : number;
}
