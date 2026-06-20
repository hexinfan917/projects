const fs = require('fs');
const ExcelJS = require('D:/projects/frontend/admin/node_modules/exceljs');

const raw = fs.readFileSync('D:/projects/tmp/test_insurance_export.json', 'utf-8');
const res = JSON.parse(raw);
const rows = res.data;

console.log('total rows:', rows.length);

function aggregateInsuranceData(rows) {
  const orderMap = new Map();
  rows.forEach((r) => {
    const list = orderMap.get(r.order_no) || [];
    list.push(r);
    orderMap.set(r.order_no, list);
  });

  return Array.from(orderMap.entries()).map(([orderNo, list]) => {
    const first = list[0];
    const contactRow = list.find((r) => r.role === '联系人') || first;

    const travelers = list
      .filter((r) => r.role !== '联系人')
      .map((r) => [r.person_name, r.person_phone, r.person_id_card].filter(Boolean).join(' / '))
      .filter(Boolean)
      .join('\n');

    const peopleCount = list.length;
    const petCount = Number(first.pet_count) || 0;
    const peoplePetSummary = `${peopleCount}人/${petCount}宠`;
    const pets = [];
    const avatars = [];
    for (let i = 1; i <= petCount; i++) {
      const name = first[`pet${i}_name`];
      if (!name) continue;
      const breed = first[`pet${i}_breed`] || '';
      const gender = first[`pet${i}_gender`] || '';
      const age = first[`pet${i}_age_str`] || '';
      const weight = first[`pet${i}_weight`];
      const avatar = first[`pet${i}_avatar`] || '';
      const parts = [
        `宠物${i}`,
        `昵称:${name}`,
        breed ? `品种:${breed}` : '',
        gender ? `性别:${gender}` : '',
        age ? `年龄:${age}` : '',
        weight !== undefined && weight !== '' ? `体重:${weight}kg` : '',
      ].filter(Boolean);
      pets.push(parts.join('  '));
      avatars.push(avatar);
    }

    return {
      orderNo,
      userId: first.user_id ?? '',
      routeName: first.route_name || '',
      travelDate: first.travel_date || '',
      contactName: contactRow.person_name || '',
      contactPhone: contactRow.person_phone || '',
      contactIdCard: contactRow.person_id_card || '',
      travelers,
      peopleCount,
      petCount,
      peoplePetSummary,
      pets: pets.join('\r\n'),
      avatars,
    };
  });
}

async function buildUnifiedExportExcel(rows) {
  const data = aggregateInsuranceData(rows);
  const maxPets = data.reduce((max, d) => Math.max(max, d.avatars.length), 0);

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('订单导出');

  const columns = [
    { header: '报名订单号', key: 'orderNo', width: 22 },
    { header: '用户ID', key: 'userId', width: 10 },
    { header: '路线名称', key: 'routeName', width: 20 },
    { header: '出行日期', key: 'travelDate', width: 12 },
    { header: '人数/宠物', key: 'peoplePetSummary', width: 12 },
    { header: '联系人', key: 'contactName', width: 12 },
    { header: '联系电话', key: 'contactPhone', width: 14 },
    { header: '身份证号', key: 'contactIdCard', width: 22 },
    { header: '出行人信息', key: 'travelers', width: 30 },
    { header: '宠物数量', key: 'petCount', width: 10 },
    { header: '宠物信息', key: 'pets', width: 50 },
  ];
  for (let i = 1; i <= maxPets; i++) {
    columns.push({ header: `宠物${i}头像`, key: `avatar${i}`, width: 15 });
  }
  worksheet.columns = columns;

  data.forEach((d) => {
    const rowData = {
      orderNo: d.orderNo,
      userId: d.userId,
      routeName: d.routeName,
      travelDate: d.travelDate,
      peoplePetSummary: d.peoplePetSummary,
      contactName: d.contactName,
      contactPhone: d.contactPhone,
      contactIdCard: d.contactIdCard,
      travelers: d.travelers,
      petCount: d.petCount,
      pets: d.pets,
    };
    for (let i = 0; i < maxPets; i++) {
      rowData[`avatar${i + 1}`] = d.avatars[i] || '';
    }
    const row = worksheet.addRow(rowData);

    const petInfoCell = row.getCell('pets');
    petInfoCell.alignment = { wrapText: true, vertical: 'top' };

    for (let i = 0; i < maxPets; i++) {
      const url = d.avatars[i];
      if (url) {
        const cell = row.getCell(`avatar${i + 1}`);
        cell.value = { text: '查看图片', hyperlink: url };
        cell.font = { color: { argb: 'FF0000FF' }, underline: true };
      }
    }
  });

  worksheet.getRow(1).font = { bold: true };

  await workbook.xlsx.writeFile('D:/projects/tmp/订单导出_exceljs_test.xlsx');
  console.log('ExcelJS export generated: 订单导出_exceljs_test.xlsx');
}

buildUnifiedExportExcel(rows);
