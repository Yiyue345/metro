import hangzhouColors from '../../../hangzhou/data/line-colors.json';
import shaoxingColors from '../../../shaoxing/data/line-colors.json';

export const hangzhouLine5 = { id: 'hangzhou:5', name: '杭州5号线', color: hangzhouColors['5'], badge: '/hangzhou/lines/5.svg' };
export const shaoxingLine1 = { id: 'shaoxing:1', name: '绍兴1号线', color: shaoxingColors['1'], badge: '/shaoxing/lines/1.svg' };
export const hanggangLine5Operator = { id: 'hanggang', name: '杭港地铁', company: '杭州杭港地铁五号线有限公司', logo: '/operators/hanggang-metro.png', url: 'https://www.mtrhz.com.cn/' };
export const shaoxingLine1Operator = { id: 'shaoxing-jingyue', name: '绍兴京越地铁', company: '绍兴京越地铁有限公司运营分公司', logo: '/operators/shaoxing-jingyue.png', url: 'https://www.jymetro.com.cn/' };
// Same source-image capsule in both independently cropped city diagrams.
export const guniangqiaoShape = { width: 13.42, height: 11.63, angle: 26.57, transfer: true };
