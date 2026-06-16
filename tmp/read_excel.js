const XLSX = require('D:/projects/frontend/admin/node_modules/xlsx');
const wb = XLSX.readFile('D:/projects/tmp/订单导出_test.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
console.log('rows:', data.length, 'cols:', data[0]?.length);
console.log('headers:');
data[0].forEach((h, i) => console.log(`  ${i + 1}: ${h}`));
console.log('row2:');
data[1].forEach((v, i) => console.log(`  ${i + 1}: ${v}`));
