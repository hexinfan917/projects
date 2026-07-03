import { PageContainer, ProTable, ModalForm, ProFormSelect, ProFormTextArea, ProFormText, ProFormDependency } from '@ant-design/pro-components';
import { Button, Tag, Modal, Descriptions, message, Image, Card, Row, Col, Divider, Table } from 'antd';
import { EyeOutlined, ExportOutlined, MoneyCollectOutlined, CheckCircleOutlined, EditOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useRef, useState } from 'react';
import { request } from '@umijs/max';
import dayjs from 'dayjs';
import ExcelJS from 'exceljs';

const statusMap: Record<number, { text: string; color: string }> = {
  10: { text: '待支付', color: 'orange' },
  20: { text: '待出行', color: 'blue' },
  30: { text: '已取消', color: 'default' },
  40: { text: '退款中', color: 'red' },
  45: { text: '退款驳回', color: 'orange' },
  50: { text: '已退款', color: 'default' },
  55: { text: '部分退款', color: 'purple' },
  60: { text: '已完成', color: 'green' },
  70: { text: '已评价', color: 'green' },
};

const statusOptions = [
  { label: '待支付', value: 10 },
  { label: '待出行', value: 20 },
  { label: '已取消', value: 30 },
  { label: '退款中', value: 40 },
  { label: '退款驳回', value: 45 },
  { label: '已退款', value: 50 },
  { label: '部分退款', value: 55 },
  { label: '已完成', value: 60 },
  { label: '已评价', value: 70 },
];

export default function OrderList() {
  const tableRef = useRef<any>(null);
  const formRef = useRef<any>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [refundModalVisible, setRefundModalVisible] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [selectedRows, setSelectedRows] = useState<any[]>([]);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const editFormRef = useRef<any>(null);
  const lastSearchRef = useRef<string>('__init__');

  // 从 URL 获取 order_no 参数（会员列表跳转过来时携带）
  const urlParams = new URLSearchParams(window.location.search);
  const orderNoFromUrl = urlParams.get('order_no');

  const handleViewDetail = async (record: any) => {
    try {
      setLoading(true);
      const res = await request('/api/v1/admin/orders/' + record.id);
      if (res.code === 200 && res.data) {
        setCurrentOrder(res.data);
        setDetailModalVisible(true);
      } else {
        message.error(res.message || '获取订单详情失败');
      }
    } catch (error) {
      message.error('获取订单详情失败');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (record: any) => {
    try {
      setLoading(true);
      const res = await request('/api/v1/admin/orders/' + record.id);
      if (res.code === 200 && res.data) {
        setCurrentOrder(res.data);
        setEditModalVisible(true);
        // 等待 Modal 打开后设置表单值
        setTimeout(() => {
          const data = res.data;
          editFormRef.current?.setFieldsValue?.({
            travel_date: data.travel_date || '',
            remark: data.remark || '',
            participants_json: data.participants?.length ? JSON.stringify(data.participants, null, 2) : '',
            pets_json: data.pets?.length ? JSON.stringify(data.pets, null, 2) : '',
          });
        }, 100);
      } else {
        message.error(res.message || '获取订单详情失败');
      }
    } catch (error) {
      message.error('获取订单详情失败');
    } finally {
      setLoading(false);
    }
  };

  const submitEdit = async (values: any) => {
    try {
      const payload: any = {};
      // 联系人固定为下单账号本人，不允许编辑
      // payload.contact = {
      //   name: values.contact_name,
      //   phone: values.contact_phone,
      //   id_card: values.contact_id_card,
      // };
      if (values.travel_date) payload.travel_date = values.travel_date;
      if (values.remark !== undefined) payload.remark = values.remark;
      if (values.participants_json?.trim()) {
        try { payload.participants = JSON.parse(values.participants_json); } catch { message.error('出行人 JSON 格式错误'); return false; }
      } else {
        payload.participants = [];
      }
      if (values.pets_json?.trim()) {
        try { payload.pets = JSON.parse(values.pets_json); } catch { message.error('宠物 JSON 格式错误'); return false; }
      } else {
        payload.pets = [];
      }

      const res = await request('/api/v1/admin/orders/' + currentOrder.id, {
        method: 'PUT',
        data: payload,
      });
      if (res.code === 200) {
        message.success('订单修改成功');
        setEditModalVisible(false);
        tableRef.current?.reload();
        return true;
      } else {
        message.error(res.message || '修改失败');
        return false;
      }
    } catch (error) {
      message.error('修改失败');
      return false;
    }
  };

  const handleCancelOrder = (record: any) => {
    Modal.confirm({
      title: '确认取消订单',
      content: `确认取消订单 ${record.order_no}？取消后将恢复库存。`,
      okText: '确认取消',
      cancelText: '再想想',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const res = await request('/api/v1/admin/orders/' + record.id + '/cancel', {
            method: 'POST',
          });
          if (res.code === 200) {
            message.success('订单已取消');
            tableRef.current?.reload();
          } else {
            message.error(res.message || '取消失败');
          }
        } catch (error) {
          message.error('取消失败');
        }
      },
    });
  };

  const handleRefund = async (record: any) => {
    try {
      setLoading(true);
      const res = await request('/api/v1/admin/orders/' + record.id);
      if (res.code === 200 && res.data) {
        setCurrentOrder(res.data);
        setRefundModalVisible(true);
      } else {
        message.error(res.message || '获取订单详情失败');
      }
    } catch (error) {
      message.error('获取订单详情失败');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (record: any) => {
    Modal.confirm({
      title: '确认完成订单',
      content: `确认将订单 ${record.order_no} 标记为已完成？用户将可以进行评价。`,
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await request('/api/v1/admin/orders/' + record.id + '/verify', {
            method: 'POST',
          });
          if (res.code === 200) {
            message.success('订单已确认完成');
            tableRef.current?.reload();
          } else {
            message.error(res.message || '确认失败');
          }
        } catch (error) {
          message.error('确认失败');
        }
      },
    });
  };

  const submitRefund = async (values: any) => {
    try {
      // 退款中订单走审核通过接口，其他状态走直接退款接口
      const isRefundPending = currentOrder?.status === 40;
      const url = isRefundPending
        ? '/api/v1/admin/refunds/' + currentOrder.id + '/approve'
        : '/api/v1/admin/orders/' + currentOrder.id + '/direct-refund';
      const res = await request(url, {
        method: 'POST',
        data: values,
      });
      if (res.code === 200) {
        message.success(isRefundPending ? '退款审核通过' : '退款成功');
        setRefundModalVisible(false);
        tableRef.current?.reload();
        return true;
      } else {
        message.error(res.message || '退款失败');
        return false;
      }
    } catch (error) {
      message.error('退款失败');
      return false;
    }
  };

  // 聚合订单数据，把同一订单的多个人员合并
  const aggregateInsuranceData = (rows: any[]) => {
    const orderMap = new Map<string, any[]>();
    rows.forEach((r: any) => {
      const list = orderMap.get(r.order_no) || [];
      list.push(r);
      orderMap.set(r.order_no, list);
    });

    return Array.from(orderMap.entries()).map(([orderNo, list]: [string, any[]]) => {
      const first = list[0];
      const contactRow = list.find((r: any) => r.role === '联系人') || first;

      const travelers = list
        .filter((r: any) => r.role !== '联系人')
        .map((r: any) => {
          const parts = [r.person_name, r.person_phone, r.person_id_card].filter(Boolean);
          return parts.join(' / ');
        })
        .filter(Boolean)
        .join('\n');

      const peopleCount = list.length;
      const petCount = Number(first.pet_count) || 0;
      const peoplePetSummary = `${peopleCount}人/${petCount}宠`;
      const pets: string[] = [];
      const avatars: string[] = [];
      const vaccineBooks: string[] = [];
      for (let i = 1; i <= petCount; i++) {
        const name = first[`pet${i}_name`];
        if (!name) continue;
        const breed = first[`pet${i}_breed`] || '';
        const gender = first[`pet${i}_gender`] || '';
        const age = first[`pet${i}_age_str`] || '';
        const weight = first[`pet${i}_weight`];
        const avatar = first[`pet${i}_avatar`] || '';
        const vaccineBook = first[`pet${i}_vaccine_book`] || '';
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
        vaccineBooks.push(vaccineBook);
      }

      return {
        orderNo,
        userId: first.user_id ?? '',
        routeName: first.route_name || '',
        travelDate: first.travel_date || '',
        status: first.status_name || first.status || '',
        payAmount: first.pay_amount ?? '',
        createdAt: first.created_at || '',
        contactName: contactRow.person_name || '',
        contactPhone: contactRow.person_phone || '',
        contactIdCard: contactRow.person_id_card || '',
        travelers,
        peopleCount,
        petCount,
        peoplePetSummary,
        pets: pets.join('\r\n'),
        avatars,
        vaccineBooks,
      };
    });
  };

  // 构建出行人清单数据（每个出行人一行，用于保险购买）
  const buildTravelerSheetData = (rows: any[]) => {
    const orderMap = new Map<string, any[]>();
    rows.forEach((r: any) => {
      const list = orderMap.get(r.order_no) || [];
      list.push(r);
      orderMap.set(r.order_no, list);
    });

    const result: any[] = [];
    Array.from(orderMap.entries()).forEach(([orderNo, list]: [string, any[]]) => {
      const first = list[0];
      const contactRow = list.find((r: any) => r.role === '联系人') || first;

      // 每个出行人（包括联系人）生成一行
      list.forEach((r: any) => {
        const petCount = Number(first.pet_count) || 0;
        const pets: string[] = [];
        for (let i = 1; i <= petCount; i++) {
          const name = first[`pet${i}_name`];
          if (!name) continue;
          const breed = first[`pet${i}_breed`] || '';
          const gender = first[`pet${i}_gender`] || '';
          const age = first[`pet${i}_age_str`] || '';
          pets.push(`宠物${i} 昵称:${name} ${breed ? '品种:' + breed : ''} ${gender ? '性别:' + gender : ''} ${age ? '年龄:' + age : ''}`.trim());
        }

        result.push({
          orderNo,
          routeName: first.route_name || '',
          travelDate: first.travel_date || '',
          travelerName: r.person_name || '',
          travelerPhone: r.person_phone || '',
          travelerIdCard: r.person_id_card || '',
          travelerRole: r.role || '出行人',
          contactName: contactRow.person_name || '',
          contactPhone: contactRow.person_phone || '',
          pets: pets.join('  '),
        });
      });
    });

    return result;
  };

  // 统一订单导出 Excel：字段精简、清晰
  const buildUnifiedExportExcel = async (rows: any[]) => {
    if (!rows.length) {
      message.warning('暂无数据可导出');
      return;
    }

    // 判断数据格式：如果是普通订单列表（有 id 字段），转换为保险导出格式
    const isInsuranceFormat = rows[0].role !== undefined || rows[0].person_name !== undefined;
    
    let data: any[];
    let travelerData: any[];
    
    if (isInsuranceFormat) {
      // 保险导出格式（按人头展开）
      data = aggregateInsuranceData(rows);
      travelerData = buildTravelerSheetData(rows);
    } else {
      // 普通订单列表格式
      data = rows.map((order: any) => {
        const participants = order.participants || [];
        const pets = order.pets || [];
        const contact = order.contact || {};
        
        const travelers = participants
          .map((p: any) => {
            const parts = [p.name, p.phone, p.id_card].filter(Boolean);
            return parts.join(' / ');
          })
          .filter(Boolean)
          .join('\n');
        
        const petInfo = pets.map((p: any, i: number) => {
          const parts = [
            `宠物${i + 1}`,
            `昵称:${p.name || ''}`,
            p.breed ? `品种:${p.breed}` : '',
            p.gender !== undefined ? `性别:${p.gender === 1 ? '公' : '母'}` : '',
            p.age_str ? `年龄:${p.age_str}` : '',
            p.weight ? `体重:${p.weight}kg` : '',
          ].filter(Boolean);
          return parts.join('  ');
        }).join('\r\n');
        
        return {
          orderNo: order.order_no || '',
          userId: order.user_id || '',
          routeName: order.route_name || '',
          travelDate: order.travel_date || '',
          status: order.status_name || order.status || '',
          payAmount: order.pay_amount || '',
          createdAt: order.created_at || '',
          peopleCount: order.participant_count || 0,
          petCount: order.pet_count || 0,
          peoplePetSummary: `${order.participant_count || 0}人/${order.pet_count || 0}宠`,
          contactName: contact.name || '',
          contactPhone: contact.phone || '',
          contactIdCard: contact.id_card || '',
          travelers,
          pets: petInfo,
          avatars: pets.map((p: any) => p.avatar || '').filter(Boolean),
          vaccineBooks: pets.map((p: any) => p.vaccine_book || '').filter(Boolean),
        };
      });
      
      // 构建普通订单格式的出行人清单数据
      travelerData = [];
      rows.forEach((order: any) => {
        const participants = order.participants || [];
        const contact = order.contact || {};
        const pets = order.pets || [];
        
        // 构建宠物信息文本
        const petInfo = pets.map((p: any, i: number) => {
          const parts = [
            `宠物${i + 1}`,
            `昵称:${p.name || ''}`,
            p.breed ? `品种:${p.breed}` : '',
            p.gender !== undefined ? `性别:${p.gender === 1 ? '公' : '母'}` : '',
            p.age_str ? `年龄:${p.age_str}` : '',
          ].filter(Boolean);
          return parts.join(' ');
        }).join('  ');
        
        // 联系人作为第一行
        if (contact.name) {
          travelerData.push({
            orderNo: order.order_no || '',
            routeName: order.route_name || '',
            travelDate: order.travel_date || '',
            peoplePetSummary: `${order.participant_count || 0}人/${order.pet_count || 0}宠`,
            travelerName: contact.name || '',
            travelerPhone: contact.phone || '',
            travelerIdCard: contact.id_card || '',
            travelerRole: '联系人',
            contactName: contact.name || '',
            contactPhone: contact.phone || '',
            pets: petInfo,
          });
        }
        
        // 每个参与者一行
        participants.forEach((p: any) => {
          // 跳过重复的联系人
          if (p.phone === contact.phone && p.name === contact.name) return;
          
          travelerData.push({
            orderNo: order.order_no || '',
            routeName: order.route_name || '',
            travelDate: order.travel_date || '',
            peoplePetSummary: `${order.participant_count || 0}人/${order.pet_count || 0}宠`,
            travelerName: p.name || '',
            travelerPhone: p.phone || '',
            travelerIdCard: p.id_card || '',
            travelerRole: '出行人',
            contactName: contact.name || '',
            contactPhone: contact.phone || '',
            pets: petInfo,
          });
        });
      });
    }
    
    const maxPets = data.reduce((max, d) => Math.max(max, d.avatars.length, d.vaccineBooks.length), 0);

    const workbook = new ExcelJS.Workbook();
    
    // ===== Sheet1: 订单汇总 =====
    const worksheet = workbook.addWorksheet('订单汇总');

    const columns: any[] = [
      { header: '报名订单号', key: 'orderNo', width: 22 },
      { header: '用户ID', key: 'userId', width: 10 },
      { header: '下单时间', key: 'createdAt', width: 18 },
      { header: '订单状态', key: 'status', width: 12 },
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
    // 每个宠物添加独立的头像和疫苗本列
    for (let i = 1; i <= maxPets; i++) {
      columns.push({ header: `宠物${i}头像`, key: `avatar${i}`, width: 15 });
      columns.push({ header: `宠物${i}疫苗本`, key: `vaccineBook${i}`, width: 15 });
    }
    worksheet.columns = columns;

    data.forEach((d: any) => {
      const rowData: any = {
        orderNo: d.orderNo,
        userId: d.userId,
        createdAt: d.createdAt,
        status: d.status,
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
        rowData[`vaccineBook${i + 1}`] = d.vaccineBooks[i] || '';
      }
      const row = worksheet.addRow(rowData);

      // 宠物信息列自动换行
      const petInfoCell = row.getCell('pets');
      petInfoCell.alignment = { wrapText: true, vertical: 'top' };

      // 头像、疫苗本列显示为蓝色可点击超链接
      for (let i = 0; i < maxPets; i++) {
        const avatarUrl = d.avatars[i];
        if (avatarUrl) {
          const cell = row.getCell(`avatar${i + 1}`);
          cell.value = { text: '查看图片', hyperlink: avatarUrl } as any;
          cell.font = { color: { argb: 'FF0000FF' }, underline: true };
        }
        const bookUrl = d.vaccineBooks[i];
        if (bookUrl) {
          const cell = row.getCell(`vaccineBook${i + 1}`);
          cell.value = { text: '查看图片', hyperlink: bookUrl } as any;
          cell.font = { color: { argb: 'FF0000FF' }, underline: true };
        }
      }
    });

    // 表头加粗
    worksheet.getRow(1).font = { bold: true };

    // ===== Sheet2: 出行人清单 =====
    if (travelerData.length > 0) {
      const travelerSheet = workbook.addWorksheet('出行人清单');
      travelerSheet.columns = [
        { header: '报名订单号', key: 'orderNo', width: 22 },
        { header: '路线名称', key: 'routeName', width: 20 },
        { header: '出行日期', key: 'travelDate', width: 12 },
        { header: '人数/宠物', key: 'peoplePetSummary', width: 12 },
        { header: '出行人姓名', key: 'travelerName', width: 12 },
        { header: '出行人手机号', key: 'travelerPhone', width: 14 },
        { header: '出行人身份证号', key: 'travelerIdCard', width: 22 },
        { header: '身份', key: 'travelerRole', width: 10 },
        { header: '联系人姓名', key: 'contactName', width: 12 },
        { header: '联系人手机号', key: 'contactPhone', width: 14 },
        { header: '宠物信息', key: 'pets', width: 50 },
      ];

      // 按订单号分组，记录每个订单的起始行和结束行（用于合并单元格）
      const orderRowMap = new Map<string, { startRow: number; endRow: number }>();
      let currentRow = 2; // 从第2行开始（第1行是表头）

      travelerData.forEach((d: any, index: number) => {
        const orderNo = d.orderNo;
        if (!orderRowMap.has(orderNo)) {
          orderRowMap.set(orderNo, { startRow: currentRow, endRow: currentRow });
        } else {
          const range = orderRowMap.get(orderNo)!;
          range.endRow = currentRow;
        }
        currentRow++;
      });

      // 重新遍历，添加数据
      travelerData.forEach((d: any) => {
        const row = travelerSheet.addRow({
          orderNo: d.orderNo,
          routeName: d.routeName,
          travelDate: d.travelDate,
          peoplePetSummary: d.peoplePetSummary || '',
          travelerName: d.travelerName,
          travelerPhone: d.travelerPhone,
          travelerIdCard: d.travelerIdCard,
          travelerRole: d.travelerRole,
          contactName: d.contactName,
          contactPhone: d.contactPhone,
          pets: d.pets,
        });
        const petCell = row.getCell('pets');
        petCell.alignment = { wrapText: true, vertical: 'top' };
      });

      // 合并同一个订单号的单元格（订单号、路线名称、出行日期、人数/宠物、联系人姓名、联系人手机号、宠物信息列）
      orderRowMap.forEach((range, orderNo) => {
        if (range.startRow < range.endRow) {
          // 需要合并的列：A(订单号), B(路线名称), C(出行日期), D(人数/宠物), I(联系人姓名), J(联系人手机号), K(宠物信息)
          const columnsToMerge = ['A', 'B', 'C', 'D', 'I', 'J', 'K'];
          columnsToMerge.forEach((col) => {
            travelerSheet.mergeCells(`${col}${range.startRow}`, `${col}${range.endRow}`);
          });
        }
      });

      travelerSheet.getRow(1).font = { bold: true };
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `订单导出_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportAll = async () => {
    try {
      message.loading('正在生成订单导出...', 0);
      const filterValues = formRef.current?.getFieldsValue?.() || {};
      const hasSelection = selectedRowKeys.length > 0;
      
      let exportData: any[] = [];
      
      if (hasSelection) {
        // 有选择记录时，使用普通订单列表接口，按订单维度导出
        const res = await request('/api/v1/admin/orders', {
          params: {
            ids: selectedRowKeys.join(','),
            page_size: selectedRowKeys.length,
          },
        });
        if (res.code === 200 && res.data?.orders) {
          exportData = res.data.orders;
        }
      } else {
        // 没有选择时，使用保险导出接口（按人头展开）
        const res = await request('/api/v1/admin/orders/insurance-export', {
          params: {
            status: filterValues.status,
            is_free: filterValues.is_free,
            keyword: filterValues.route_name,
            order_no: orderNoFromUrl || undefined,
          },
        });
        if (res.code === 200 && res.data) {
          exportData = res.data;
        }
      }
      
      message.destroy();

      if (!exportData.length) {
        message.warning('暂无数据可导出');
        return;
      }

      await buildUnifiedExportExcel(exportData);
      message.success(`已导出 ${exportData.length} 条记录`);
    } catch (error: any) {
      message.destroy();
      console.error('订单导出失败:', error);
      message.error('订单导出失败: ' + (error?.message || '未知错误'));
    }
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 70,
      search: false,
    },
    {
      title: '订单号',
      dataIndex: 'order_no',
      width: 180,
      search: false,
      copyable: true,
    },
    {
      title: '用户ID',
      dataIndex: 'user_id',
      width: 80,
      search: false,
    },
    {
      title: '路线',
      dataIndex: 'route_name',
      ellipsis: true,
      width: 200,
    },
    {
      title: '出行日期',
      dataIndex: 'travel_date',
      width: 120,
      search: false,
    },
    {
      title: '人数/宠物',
      width: 100,
      search: false,
      render: (record: any) => `${record.participant_count}人/${record.pet_count}宠`,
    },
    {
      title: '类型',
      dataIndex: 'is_free',
      width: 80,
      valueEnum: {
        0: { text: '付费' },
        1: { text: '免费' },
      },
      render: (_: any, record: any) => (
        <Tag color={record.is_free ? 'green' : 'blue'}>
          {record.is_free ? '免费' : '付费'}
        </Tag>
      ),
    },
    {
      title: '会员',
      dataIndex: 'is_member',
      width: 80,
      search: false,
      render: (_: any, record: any) => (
        <Tag color={record.is_member ? 'gold' : 'default'}>
          {record.is_member ? '会员' : '非会员'}
        </Tag>
      ),
    },
    {
      title: '金额',
      dataIndex: 'pay_amount',
      width: 100,
      search: false,
      render: (text: number) => <span style={{ color: '#cf1322', fontWeight: 'bold' }}>¥{text?.toFixed(2)}</span>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueEnum: {
        10: { text: '待支付' },
        20: { text: '待出行' },
        30: { text: '已取消' },
        40: { text: '退款中' },
        45: { text: '退款驳回' },
        50: { text: '已退款' },
        55: { text: '部分退款' },
        60: { text: '已完成' },
        70: { text: '已评价' },
      },
      render: (_: any, record: any) => {
        const status = Number(record.status);
        const config = statusMap[status];
        return (
          <Tag color={config?.color || 'default'}>
            {config?.text || record.status_name || '未知'}
          </Tag>
        );
      },
    },
    {
      title: '下单时间',
      dataIndex: 'created_at',
      width: 180,
      search: false,
      render: (date: string) => date ? dayjs(date).format('MM-DD HH:mm') : '-',
    },
    {
      title: '操作',
      valueType: 'option',
      width: 260,
      fixed: 'right',
      render: (_: any, record: any) => [
        <Button key="view" type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
          查看
        </Button>,
        <Button key="edit" type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
          编辑
        </Button>,
        [10, 20].includes(record.status) && (
          <Button key="cancel" type="link" size="small" danger icon={<CloseCircleOutlined />} onClick={() => handleCancelOrder(record)}>
            取消
          </Button>
        ),
        record.status === 20 && (
          <Button key="verify" type="link" size="small" style={{ color: '#52c41a' }} icon={<CheckCircleOutlined />} onClick={() => handleVerify(record)}>
            确认完成
          </Button>
        ),
        (!record.is_free && [20, 40, 45, 55].includes(record.status)) && (
          <Button key="refund" type="link" size="small" danger icon={<MoneyCollectOutlined />} onClick={() => handleRefund(record)}>
            {record.status === 40 ? '确认退款' : '退款'}
          </Button>
        ),
      ],
    },
  ];

  return (
    <PageContainer title="订单管理">
      <ProTable
        columns={columns}
        actionRef={tableRef}
        formRef={formRef}
        request={async (params) => {
          const res = await request('/api/v1/admin/orders', {
            params: {
              page: params.current,
              page_size: params.pageSize,
              status: params.status,
              keyword: params.route_name,
              order_no: orderNoFromUrl || undefined,
            },
          });
          const data = res.data?.orders || [];

          // 只有筛选条件变化时才自动全选（搜索/重置），初始加载和翻页时不触发
          const searchKey = JSON.stringify({
            status: params.status,
            route_name: params.route_name,
            is_free: params.is_free,
          });
          if (lastSearchRef.current === '__init__') {
            // 首次加载，记录参数但不选中
            lastSearchRef.current = searchKey;
          } else if (lastSearchRef.current !== searchKey) {
            // 筛选条件变化（用户点击了查询/重置），拉取全部数据并全选
            lastSearchRef.current = searchKey;
            const allRes = await request('/api/v1/admin/orders', {
              params: {
                page: 1,
                page_size: 5000,
                status: params.status,
                keyword: params.route_name,
                is_free: params.is_free,
                order_no: orderNoFromUrl || undefined,
              },
            });
            const allData = allRes.data?.orders || [];
            setSelectedRowKeys(allData.map((o: any) => o.id));
            setSelectedRows(allData);
          }

          return {
            data,
            success: res.code === 200,
            total: res.data?.total || 0,
          };
        }}
        rowKey="id"
        search={{ labelWidth: 'auto' }}
        pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: [10, 20, 50, 100] }}
        scroll={{ x: 1300 }}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys, rows) => {
            setSelectedRowKeys(keys);
            // rows 只包含当前页，需和之前已选跨页数据合并
            setSelectedRows(prev => {
              const map = new Map();
              (prev || []).forEach((o: any) => { if (o && o.id != null) map.set(o.id, o); });
              (rows || []).forEach((o: any) => { if (o && o.id != null) map.set(o.id, o); });
              return (keys || []).map((id: any) => map.get(id)).filter(Boolean);
            });
          },
          preserveSelectedRowKeys: true,
        }}
        toolBarRender={() => [
          <Button
            key="selectAll"
            onClick={() => {
              const data = tableRef.current?.pageData?.data || [];
              if (!data.length) return;
              const pageKeys = data.map((o: any) => o.id);
              setSelectedRowKeys(prev => Array.from(new Set([...prev, ...pageKeys])));
              setSelectedRows(prev => {
                const map = new Map();
                prev.forEach((o: any) => map.set(o.id, o));
                data.forEach((o: any) => map.set(o.id, o));
                return Array.from(map.values());
              });
            }}
          >
            全选本页
          </Button>,
          <Button key="export" icon={<ExportOutlined />} onClick={handleExportAll}>
            导出订单
          </Button>,
        ]}
      />

      {/* 订单详情 */}
      <Modal
        title="订单详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[<Button key="close" onClick={() => setDetailModalVisible(false)}>关闭</Button>]}
        width={800}
      >
        {currentOrder && (
          <>
            <Card title="基本信息" size="small" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={12}>
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="订单号">{currentOrder.order_no}</Descriptions.Item>
                    <Descriptions.Item label="下单时间">{currentOrder.created_at ? dayjs(currentOrder.created_at).format('YYYY-MM-DD HH:mm:ss') : '-'}</Descriptions.Item>
                    <Descriptions.Item label="订单状态">
                      <Tag color={statusMap[currentOrder.status]?.color}>{statusMap[currentOrder.status]?.text}</Tag>
                    </Descriptions.Item>
                  </Descriptions>
                </Col>
                <Col span={12}>
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="用户ID">{currentOrder.user_id}</Descriptions.Item>
                    <Descriptions.Item label="支付时间">{currentOrder.pay_time ? dayjs(currentOrder.pay_time).format('YYYY-MM-DD HH:mm:ss') : '-'}</Descriptions.Item>
                    <Descriptions.Item label="支付方式">{currentOrder.pay_channel || '-'}</Descriptions.Item>
                    <Descriptions.Item label="微信支付单号">{currentOrder.pay_trade_no || currentOrder.pay_transaction_id || '-'}</Descriptions.Item>
                  </Descriptions>
                </Col>
              </Row>
            </Card>

            <Card title="路线信息" size="small" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={8}>
                  {currentOrder.route_cover ? (
                    <Image src={currentOrder.route_cover} style={{ width: '100%', borderRadius: 4, maxHeight: 160, objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: 120, background: '#f0f0f0', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
                      暂无封面图
                    </div>
                  )}
                </Col>
                <Col span={16}>
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="路线名称">{currentOrder.route_name}</Descriptions.Item>
                    <Descriptions.Item label="出行日期">{currentOrder.travel_date}</Descriptions.Item>
                    <Descriptions.Item label="套餐类型">
                      <Tag color={currentOrder.package_type === 'single_person' ? 'green' : currentOrder.package_type === 'single_pet' ? 'blue' : 'orange'}>
                        {currentOrder.package_type === 'single_person' ? '单人轻旅（无宠）' : currentOrder.package_type === 'single_pet' ? '毛孩专属接送' : '一人一宠'}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="出行方式">
                      <Tag color="blue">
                        {currentOrder.travel_type === 'bus' ? '大巴出行' : currentOrder.travel_type === 'self_drive' ? '自驾出行' : currentOrder.travel_type || '-'}
                      </Tag>
                    </Descriptions.Item>
                    {(() => {
                      const basePerson = currentOrder.package_type === 'single_pet' ? 0 : (currentOrder.package_type === 'single_person' ? 1 : 1)
                      const basePet = currentOrder.package_type === 'single_person' ? 0 : (currentOrder.package_type === 'single_pet' ? 1 : 1)
                      const extraPerson = Math.max(0, (currentOrder.participant_count || 0) - basePerson)
                      const extraPet = Math.max(0, (currentOrder.pet_count || 0) - basePet)
                      if (extraPerson <= 0 && extraPet <= 0) return null
                      return (
                        <Descriptions.Item label="额外增加">
                          <Tag color="purple">
                            {extraPerson > 0 ? `成人+${extraPerson} ` : ''}{extraPet > 0 ? `宠物+${extraPet}` : ''}
                          </Tag>
                        </Descriptions.Item>
                      )
                    })()}
                    <Descriptions.Item label="出行人数">{currentOrder.participant_count}人</Descriptions.Item>
                    <Descriptions.Item label="携带宠物">{currentOrder.pet_count}只</Descriptions.Item>
                  </Descriptions>
                </Col>
              </Row>
            </Card>

            <Card title="费用明细" size="small" style={{ marginBottom: 16 }}>
              <Descriptions column={2} size="small">
                <Descriptions.Item label="路线单价">¥{currentOrder.route_price?.toFixed(2)}</Descriptions.Item>
                <Descriptions.Item label="保险费用">¥{currentOrder.insurance_price?.toFixed(2)}</Descriptions.Item>
                <Descriptions.Item label="装备费用">¥{currentOrder.equipment_price?.toFixed(2)}</Descriptions.Item>
                <Descriptions.Item label="选装费用">¥{currentOrder.addon_amount?.toFixed(2)}</Descriptions.Item>
                <Descriptions.Item label="优惠金额">-¥{currentOrder.discount_amount?.toFixed(2)}</Descriptions.Item>
                <Descriptions.Item label="订单总额">
                  <span>¥{currentOrder.total_amount?.toFixed(2)}</span>
                </Descriptions.Item>
                <Descriptions.Item label="实付金额">
                  <span style={{ color: '#cf1322', fontSize: 16, fontWeight: 'bold' }}>¥{currentOrder.pay_amount?.toFixed(2)}</span>
                </Descriptions.Item>
                {currentOrder.refunded_amount > 0 && (
                  <>
                    <Descriptions.Item label="已退金额">
                      <span style={{ color: '#faad14', fontWeight: 'bold' }}>¥{currentOrder.refunded_amount?.toFixed(2)}</span>
                    </Descriptions.Item>
                    <Descriptions.Item label="实付净额">
                      <span style={{ color: '#52c41a', fontWeight: 'bold' }}>¥{(currentOrder.pay_amount - currentOrder.refunded_amount)?.toFixed(2)}</span>
                    </Descriptions.Item>
                  </>
                )}
              </Descriptions>
            </Card>

            {/* 退款记录 */}
            {currentOrder.refund_records && currentOrder.refund_records.length > 0 && (
              <Card title="退款记录" size="small" style={{ marginBottom: 16 }}>
                <Table
                  size="small"
                  pagination={false}
                  bordered
                  dataSource={currentOrder.refund_records}
                  columns={[
                    { title: '退款单号', dataIndex: 'refund_no', key: 'refund_no' },
                    { title: '退款金额', dataIndex: 'amount', key: 'amount', render: (v: number) => <span style={{ color: '#cf1322' }}>¥{v?.toFixed(2)}</span> },
                    { title: '类型', dataIndex: 'type', key: 'type', render: (v: string) => v === 'full' ? '全额' : '部分' },
                    { title: '原因', dataIndex: 'reason', key: 'reason', render: (v: string) => v || '-' },
                    { title: '状态', dataIndex: 'status', key: 'status', render: (v: number) => v === 20 ? '成功' : v === 30 ? '失败' : '处理中' },
                    { title: '时间', dataIndex: 'created_at', key: 'created_at', render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-' },
                  ]}
                  rowKey="id"
                />
              </Card>
            )}

            {/* 出行人信息（仅实际出行人） */}
            {currentOrder.participants && currentOrder.participants.length > 0 && (
              <Card title={`出行人信息（共${currentOrder.participants.length}人）`} size="small" style={{ marginBottom: 16 }}>
                <Table
                  size="small"
                  pagination={false}
                  bordered
                  dataSource={currentOrder.participants}
                  columns={[
                    { title: '姓名', dataIndex: 'name', key: 'name', render: (v: string) => v || '未命名' },
                    { title: '手机号', dataIndex: 'phone', key: 'phone', render: (v: string) => v || '-' },
                    { title: '身份证号', dataIndex: 'id_card', key: 'id_card', render: (v: string) => v || '-' },
                    { title: '性别', dataIndex: 'gender', key: 'gender', render: (v: number) => v === 1 ? '男' : v === 2 ? '女' : '未知' },
                  ]}
                  rowKey={(record: any, idx: number) => record.phone || idx}
                />
              </Card>
            )}

            {/* 联系人信息（固定为下单账号本人） */}
            {currentOrder.contact && (
              <Card title="下单账号信息（联系人）" size="small" style={{ marginBottom: 16 }}>
                <Descriptions column={2} size="small">
                  <Descriptions.Item label="姓名">{currentOrder.contact.name || '-'}</Descriptions.Item>
                  <Descriptions.Item label="手机">{currentOrder.contact.phone || '-'}</Descriptions.Item>
                  <Descriptions.Item label="身份证号">{currentOrder.contact.id_card || '-'}</Descriptions.Item>
                </Descriptions>
              </Card>
            )}

            {/* 宠物信息 */}
            {currentOrder.pets && currentOrder.pets.length > 0 && (
              <Card title="宠物信息" size="small" style={{ marginBottom: 16 }}>
                <Table
                  size="small"
                  pagination={false}
                  bordered
                  dataSource={currentOrder.pets}
                  columns={[
                    {
                      title: '头像',
                      dataIndex: 'avatar',
                      key: 'avatar',
                      width: 80,
                      render: (url: string) => url ? <Image src={url} style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 4 }} /> : '-',
                    },
                    { title: '宠物ID', dataIndex: 'id', key: 'id', render: (v: any) => v || '-' },
                    { title: '宠物名', dataIndex: 'name', key: 'name' },
                    { title: '品种', dataIndex: 'breed', key: 'breed', render: (v: string) => v || '-' },
                    { title: '性别', dataIndex: 'gender', key: 'gender', render: (v: number) => v === 1 ? '公' : v === 2 ? '母' : '未知' },
                    { title: '年龄', dataIndex: 'age_str', key: 'age_str', render: (v: string) => v || '-' },
                    { title: '体重(kg)', dataIndex: 'weight', key: 'weight', render: (v: number) => v ? v.toFixed(1) : '-' },
                    {
                      title: '疫苗',
                      dataIndex: 'vaccine_date',
                      key: 'vaccine_date',
                      render: (v: string) => v ? (
                        <Tag color="green">已接种 {v}</Tag>
                      ) : (
                        <Tag color="default">未接种</Tag>
                      ),
                    },
                    {
                      title: '疫苗本',
                      dataIndex: 'vaccine_book',
                      key: 'vaccine_book',
                      width: 100,
                      render: (url: string) => url ? <Image src={url} style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 4 }} /> : '-',
                    },
                  ]}
                  rowKey={(record: any, idx: number) => record.id || idx}
                />
              </Card>
            )}
          </>
        )}
      </Modal>

      {/* 退款申请 */}
      <ModalForm
        title="订单直接退款"
        open={refundModalVisible}
        onOpenChange={setRefundModalVisible}
        onFinish={submitRefund}
      >
        <p>订单号: {currentOrder?.order_no}</p>
        <p>实付金额: <span style={{ color: '#cf1322', fontWeight: 'bold' }}>¥{currentOrder?.pay_amount?.toFixed(2)}</span></p>
        {currentOrder?.refunded_amount > 0 && (
          <>
            <p>已退金额: <span style={{ color: '#cf1322', fontWeight: 'bold' }}>¥{currentOrder?.refunded_amount?.toFixed(2)}</span></p>
            <p>剩余可退: <span style={{ color: '#52c41a', fontWeight: 'bold' }}>¥{(currentOrder?.pay_amount - currentOrder?.refunded_amount)?.toFixed(2)}</span></p>
          </>
        )}
        <ProFormSelect
          name="refund_type"
          label="退款类型"
          options={[
            { label: '全额退款', value: 'full' },
            { label: '部分退款', value: 'partial' },
          ]}
          initialValue="full"
        />
        <ProFormDependency name={['refund_type']}>
          {({ refund_type }) => {
            if (refund_type !== 'partial') return null;
            const remaining = (currentOrder?.pay_amount || 0) - (currentOrder?.refunded_amount || 0);
            return (
              <ProFormText
                name="refund_amount"
                label={`退款金额（剩余可退: ¥${remaining.toFixed(2)}）`}
                placeholder="请输入退款金额"
                rules={[
                  { required: true, message: '请输入退款金额' },
                  {
                    validator: (_, value) => {
                      const num = parseFloat(value);
                      if (isNaN(num) || num <= 0) {
                        return Promise.reject('退款金额必须大于0');
                      }
                      if (num > remaining) {
                        return Promise.reject(`退款金额不能大于剩余可退金额 ¥${remaining.toFixed(2)}`);
                      }
                      return Promise.resolve();
                    },
                  },
                ]}
              />
            );
          }}
        </ProFormDependency>
        <ProFormTextArea
          name="refund_reason"
          label="退款原因"
          placeholder="请输入退款原因"
          rules={[{ required: true, message: '请输入退款原因' }]}
        />
      </ModalForm>

      {/* 编辑订单 */}
      <ModalForm
        title={`编辑订单 - ${currentOrder?.order_no || ''}`}
        open={editModalVisible}
        onOpenChange={setEditModalVisible}
        onFinish={submitEdit}
        formRef={editFormRef}
        width={600}
      >
        <p style={{ color: '#999', marginBottom: 16 }}>订单状态: {statusMap[currentOrder?.status]?.text || '-'}</p>
        <p style={{ color: '#999', marginBottom: 16 }}>联系人固定为下单账号本人，不可在此修改。</p>
        <ProFormText name="travel_date" label="出行日期" placeholder="YYYY-MM-DD" />
        <ProFormTextArea
          name="participants_json"
          label="出行人列表 (JSON)"
          placeholder={`[{"name":"张三","phone":"13800138000","id_card":"","gender":1}]`}
          fieldProps={{ rows: 4 }}
        />
        <ProFormTextArea
          name="pets_json"
          label="宠物列表 (JSON)"
          placeholder={`[{"name":"旺财","breed":"金毛","gender":1,"weight":25}]`}
          fieldProps={{ rows: 4 }}
        />
        <ProFormTextArea name="remark" label="备注" placeholder="订单备注" />
      </ModalForm>
    </PageContainer>
  );
}
