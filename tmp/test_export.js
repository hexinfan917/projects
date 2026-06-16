const fs = require('fs');
const path = require('path');
const XLSX = require('D:/projects/frontend/admin/node_modules/xlsx');

const raw = fs.readFileSync('D:/projects/tmp/test_insurance_export.json', 'utf-8');
const res = JSON.parse(raw);
const rows = res.data;

console.log('total rows:', rows.length);

// aggregateInsuranceData simulation
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
      const breedType = first[`pet${i}_breed_type`] || '';
      const gender = first[`pet${i}_gender`] || '';
      const birthDate = first[`pet${i}_birth_date`] || '';
      const age = first[`pet${i}_age_str`] || '';
      const weight = first[`pet${i}_weight`];
      const vaccineDate = first[`pet${i}_vaccine_date`] || '';
      const vaccineBook = first[`pet${i}_vaccine_book`] || '';
      const healthNotes = first[`pet${i}_health_notes`] || '';
      const tags = first[`pet${i}_tags`] || '';
      const isDefault = first[`pet${i}_is_default`] ? '是' : '否';
      const petStatus = first[`pet${i}_status`] === 1 ? '正常' : '已删除';
      const createdAt = first[`pet${i}_created_at`] || '';
      const avatar = first[`pet${i}_avatar`] || '';
      const parts = [
        `宠物${i}`,
        `名称:${name}`,
        breed ? `品种:${breed}` : '',
        breedType ? `体型:${breedType}` : '',
        gender ? `性别:${gender}` : '',
        birthDate ? `出生日期:${birthDate}` : '',
        age ? `年龄:${age}` : '',
        weight !== undefined && weight !== '' ? `体重:${weight}kg` : '',
        vaccineDate ? `疫苗日期:${vaccineDate}` : '',
        vaccineBook ? `疫苗本:${vaccineBook}` : '',
        healthNotes ? `健康备注:${healthNotes}` : '',
        tags ? `标签:${tags}` : '',
        `是否默认:${isDefault}`,
        `状态:${petStatus}`,
        createdAt ? `创建时间:${createdAt}` : '',
      ].filter(Boolean);
      pets.push(parts.join(' | '));
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

// 1. 保险导出 CSV
function buildInsuranceCSV(rows) {
  const data = aggregateInsuranceData(rows);
  const headers = ['报名订单号', '用户ID', '路线名称', '出行日期', '联系人', '联系电话', '身份证号', '人数/宠物', '出行人信息', '宠物数量', '宠物信息', '宠物头像URL'];
  const csvRows = data.map((d) => [
    d.orderNo,
    d.userId,
    d.routeName,
    d.travelDate,
    d.contactName,
    d.contactPhone,
    `\t${d.contactIdCard}`,
    d.peoplePetSummary,
    d.travelers,
    d.petCount,
    d.pets,
    d.avatars.join('\n'),
  ]);
  const csvContent = [headers, ...csvRows]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  fs.writeFileSync('D:/projects/tmp/保险订单导出_test.csv', '\uFEFF' + csvContent);
  console.log('CSV generated: 保险订单导出_test.csv');
}

// 2. 保险导出 Excel
function buildInsuranceExcel(rows) {
  const data = aggregateInsuranceData(rows);
  const maxPets = data.reduce((max, d) => Math.max(max, d.avatars.length), 0);
  const headers = ['报名订单号', '用户ID', '路线名称', '出行日期', '联系人', '联系电话', '身份证号', '人数/宠物', '出行人信息', '宠物数量', '宠物信息'];
  for (let i = 1; i <= maxPets; i++) headers.push(`宠物${i}头像`);
  const excelRows = data.map((d) => {
    const row = [
      d.orderNo,
      d.userId,
      d.routeName,
      d.travelDate,
      d.contactName,
      d.contactPhone,
      d.contactIdCard,
      d.peoplePetSummary,
      d.travelers,
      d.petCount,
      d.pets,
    ];
    for (let i = 0; i < maxPets; i++) {
      const url = d.avatars[i] || '';
      row.push(url ? { f: `=IMAGE("${url}")` } : '');
    }
    return row;
  });
  const ws = XLSX.utils.aoa_to_sheet([headers, ...excelRows]);
  ws['!cols'] = [{ wch: 22 }, { wch: 10 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 22 }, { wch: 12 }, { wch: 30 }, { wch: 10 }, { wch: 30 }, ...Array(maxPets).fill({ wch: 20 })];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '保险订单');
  XLSX.writeFile(wb, 'D:/projects/tmp/保险订单导出_test.xlsx');
  console.log('Excel generated: 保险订单导出_test.xlsx');
}

// 3. 宠物明细导出 Excel
function buildPetDetailExcel(rows) {
  if (!rows.length) return;
  const headers = ['报名订单号', '路线名称', '出行日期', '联系人', '联系电话', '宠物ID', '宠物名', '品种', '体型', '性别', '出生日期', '年龄', '体重(kg)', '疫苗日期', '疫苗本URL', '头像URL', '标签', '健康备注', '是否默认', '状态', '创建时间', '更新时间'];
  const excelRows = [];
  const orderMap = new Map();
  rows.forEach((r) => {
    const list = orderMap.get(r.order_no) || [];
    list.push(r);
    orderMap.set(r.order_no, list);
  });
  orderMap.forEach((list) => {
    const first = list[0];
    const contactRow = list.find((r) => r.role === '联系人') || first;
    const petCount = Number(first.pet_count) || 0;
    for (let i = 1; i <= petCount; i++) {
      const name = first[`pet${i}_name`];
      if (!name) continue;
      excelRows.push([
        first.order_no || '',
        first.route_name || '',
        first.travel_date || '',
        contactRow.person_name || '',
        contactRow.person_phone || '',
        first[`pet${i}_id`] || '',
        name,
        first[`pet${i}_breed`] || '',
        first[`pet${i}_breed_type`] || '',
        first[`pet${i}_gender`] || '',
        first[`pet${i}_birth_date`] || '',
        first[`pet${i}_age_str`] || '',
        first[`pet${i}_weight`] ?? '',
        first[`pet${i}_vaccine_date`] || '',
        first[`pet${i}_vaccine_book`] || '',
        first[`pet${i}_avatar`] || '',
        first[`pet${i}_tags`] || '',
        first[`pet${i}_health_notes`] || '',
        first[`pet${i}_is_default`] ? '是' : '否',
        first[`pet${i}_status`] === 1 ? '正常' : '已删除',
        first[`pet${i}_created_at`] || '',
        first[`pet${i}_updated_at`] || '',
      ]);
    }
  });
  const ws = XLSX.utils.aoa_to_sheet([headers, ...excelRows]);
  ws['!cols'] = [
    { wch: 22 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 14 },
    { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 6 },
    { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 30 },
    { wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 10 }, { wch: 10 },
    { wch: 20 }, { wch: 20 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '宠物明细');
  XLSX.writeFile(wb, 'D:/projects/tmp/宠物明细导出_test.xlsx');
  console.log('Pet detail Excel generated: 宠物明细导出_test.xlsx');
}

buildInsuranceCSV(rows);
buildInsuranceExcel(rows);
buildPetDetailExcel(rows);
