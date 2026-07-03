const fs = require('fs');
const XLSX = require('D:/projects/frontend/admin/node_modules/xlsx');

const raw = fs.readFileSync('D:/projects/tmp/test_insurance_export.json', 'utf-8');
const res = JSON.parse(raw);
const rows = res.data;

console.log('total rows:', rows.length);

function buildOrderExportExcel(rows) {
  const orderMap = new Map();
  rows.forEach((r) => {
    const list = orderMap.get(r.order_no) || [];
    list.push(r);
    orderMap.set(r.order_no, list);
  });

  let maxPets = 0;
  orderMap.forEach((list) => {
    maxPets = Math.max(maxPets, Number(list[0].pet_count) || 0);
  });

  const petFields = [
    { key: 'id', title: 'ID', width: 10 },
    { key: 'name', title: '名称', width: 12 },
    { key: 'breed', title: '品种', width: 14 },
    { key: 'breed_type', title: '体型', width: 10 },
    { key: 'gender', title: '性别', width: 8 },
    { key: 'birth_date', title: '出生日期', width: 12 },
    { key: 'age_str', title: '年龄', width: 10 },
    { key: 'weight', title: '体重(kg)', width: 10 },
    { key: 'vaccine_date', title: '疫苗日期', width: 12 },
    { key: 'vaccine_book', title: '疫苗本URL', width: 30 },
    { key: 'avatar', title: '头像URL', width: 30 },
    { key: 'tags', title: '标签', width: 16 },
    { key: 'health_notes', title: '健康备注', width: 20 },
    { key: 'is_default', title: '是否默认', width: 10 },
    { key: 'status', title: '状态', width: 10 },
    { key: 'created_at', title: '创建时间', width: 20 },
    { key: 'updated_at', title: '更新时间', width: 20 },
  ];

  const headers = [
    '报名订单号', '用户ID', '路线名称', '出行日期', '人数/宠物',
    '联系人姓名', '联系人电话', '联系人身份证号', '联系人性别', '联系人出生日期',
    '紧急联系人', '紧急联系电话', '出行人信息', '宠物数量',
  ];

  for (let i = 1; i <= maxPets; i++) {
    petFields.forEach((f) => headers.push(`宠物${i}_${f.title}`));
  }

  const excelRows = [];
  orderMap.forEach((list) => {
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

    const row = [
      first.order_no || '',
      first.user_id ?? '',
      first.route_name || '',
      first.travel_date || '',
      peoplePetSummary,
      contactRow.person_name || '',
      contactRow.person_phone || '',
      contactRow.person_id_card || '',
      contactRow.person_gender || '',
      contactRow.person_birthday || '',
      contactRow.emergency_name || '',
      contactRow.emergency_phone || '',
      travelers,
      petCount,
    ];

    for (let i = 1; i <= maxPets; i++) {
      row.push(first[`pet${i}_id`] || '');
      row.push(first[`pet${i}_name`] || '');
      row.push(first[`pet${i}_breed`] || '');
      row.push(first[`pet${i}_breed_type`] || '');
      row.push(first[`pet${i}_gender`] || '');
      row.push(first[`pet${i}_birth_date`] || '');
      row.push(first[`pet${i}_age_str`] || '');
      row.push(first[`pet${i}_weight`] ?? '');
      row.push(first[`pet${i}_vaccine_date`] || '');
      row.push(first[`pet${i}_vaccine_book`] || '');
      row.push(first[`pet${i}_avatar`] || '');
      row.push(first[`pet${i}_tags`] || '');
      row.push(first[`pet${i}_health_notes`] || '');
      row.push(first[`pet${i}_is_default`] ? '是' : '否');
      row.push(first[`pet${i}_status`] === 1 ? '正常' : '已删除');
      row.push(first[`pet${i}_created_at`] || '');
      row.push(first[`pet${i}_updated_at`] || '');
    }

    excelRows.push(row);
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...excelRows]);
  const cols = [
    { wch: 22 }, { wch: 10 }, { wch: 24 }, { wch: 12 }, { wch: 12 },
    { wch: 12 }, { wch: 14 }, { wch: 22 }, { wch: 10 }, { wch: 12 },
    { wch: 12 }, { wch: 14 }, { wch: 30 }, { wch: 10 },
  ];
  for (let i = 1; i <= maxPets; i++) {
    petFields.forEach((f) => cols.push({ wch: f.width }));
  }
  ws['!cols'] = cols;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '订单导出');
  XLSX.writeFile(wb, 'D:/projects/tmp/订单导出_test.xlsx');
  console.log('Unified order export generated: 订单导出_test.xlsx');
  console.log('headers count:', headers.length);
  console.log('sample order count:', excelRows.length);
}

buildOrderExportExcel(rows);
