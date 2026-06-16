const ExcelJS = require('D:/projects/frontend/admin/node_modules/exceljs');

async function read() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile('D:/projects/tmp/订单导出_exceljs_test.xlsx');
  const worksheet = workbook.worksheets[0];
  console.log('rows:', worksheet.rowCount, 'cols:', worksheet.columnCount);
  const headers = worksheet.getRow(1).values.slice(1);
  console.log('headers:', headers);
  const row2 = worksheet.getRow(2).values.slice(1);
  console.log('row2:', row2.map((v, i) => `${headers[i]}:${JSON.stringify(v && v.text ? v.text : v)}`).join(' | '));
  const row3 = worksheet.getRow(3).values.slice(1);
  console.log('row3:', row3.map((v, i) => `${headers[i]}:${JSON.stringify(v && v.text ? v.text : v)}`).join(' | '));
}

read();
