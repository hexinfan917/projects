const fs = require('fs');
const XLSX = require('D:/projects/frontend/admin/node_modules/xlsx');

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
      pets: pets.join('\n'),
      avatars,
    };
  });
}

function buildUnifiedExportExcel(rows) {
  const data = aggregateInsuranceData(rows);
  const maxPets = data.reduce((max, d) => Math.max(max, d.avatars.length), 0);

  const headers = [
    '报名订单号', '用户ID', '路线名称', '出行日期', '人数/宠物',
    '联系人', '联系电话', '身份证号', '出行人信息', '宠物数量', '宠物信息',
  ];
  for (let i = 1; i <= maxPets; i++) headers.push(`宠物${i}头像`);

  const excelRows = data.map((d) => {
    const row = [
      d.orderNo, d.userId, d.routeName, d.travelDate, d.peoplePetSummary,
      d.contactName, d.contactPhone, d.contactIdCard, d.travelers, d.petCount, d.pets,
    ];
    for (let i = 0; i < maxPets; i++) {
      row.push(d.avatars[i] || '');
    }
    return row;
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...excelRows]);
  ws['!cols'] = [
    { wch: 22 }, { wch: 10 }, { wch: 20 }, { wch: 12 }, { wch: 12 },
    { wch: 12 }, { wch: 14 }, { wch: 22 }, { wch: 30 }, { wch: 10 },
    { wch: 30 }, ...Array(maxPets).fill({ wch: 20 }),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '订单导出');
  XLSX.writeFile(wb, 'D:/projects/tmp/订单导出_test.xlsx');
  console.log('Simplified export generated: 订单导出_test.xlsx');
  console.log('headers count:', headers.length);
  console.log('order count:', excelRows.length);
  console.log('headers:', headers);
}

buildUnifiedExportExcel(rows);
