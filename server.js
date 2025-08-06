const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const path = require('path');
require('dotenv').config();

// 创建Express应用
const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

// 创建数据库 (使用lowdb 7.x API)
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const db = new Low(new JSONFile(path.join(__dirname, 'db.json')), { consultations: [] });

// 初始化数据库
async function initDB() {
  await db.read();
  db.data ||= {
    consultations: []
  };
  await db.write();
}

// 启动服务器前初始化数据库
initDB().then(() => {
  console.log('数据库初始化成功');
}).catch(err => {
  console.error('数据库初始化失败:', err);
});

// 配置邮件传输器
const transporter = nodemailer.createTransport({
  service: '163',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// 表单提交API
app.post('/api/consultation', async (req, res) => {
  try {
    console.log('收到表单提交请求:', req.body);
    const formData = req.body;
    console.log('表单数据:', formData);
    
    // 检查表单数据是否为空
    if (!formData || Object.keys(formData).length === 0) {
      console.error('表单数据为空');
      return res.status(400).json({ success: false, message: '表单数据不能为空' });
    }
    
    const timestamp = new Date().toISOString();
    const consultation = {
      id: Date.now().toString(),
      timestamp,
      ...formData
    };
    console.log('准备保存的咨询数据:', consultation);

    // 保存到数据库
    try {
      console.log('开始读取数据库...');
      await db.read();
      console.log('数据库读取成功，当前数据:', db.data);
      
      // 确保consultations数组存在
      if (!db.data.consultations) {
        db.data.consultations = [];
        console.log('初始化consultations数组');
      }
      
      db.data.consultations.push(consultation);
      console.log('添加数据后:', db.data);
      console.log('开始写入数据库...');
      await db.write();
      console.log('数据库写入成功');
    } catch (dbError) {
      console.error('数据库操作错误:', dbError);
      return res.status(500).json({ success: false, message: '数据保存失败，请稍后再试' });
    }

    // 发送邮件
    try {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: 'kaiwen0151@163.com',
        subject: '新的咨询表单提交',
        html: `
          <h3>新的咨询表单提交</h3>
          <p><strong>提交时间:</strong> ${timestamp}</p>
          <p><strong>姓名:</strong> ${formData.name || '-'}</p>
          <p><strong>邮箱:</strong> ${formData.email || '-'}</p>
          <p><strong>电话:</strong> ${formData.phone || '-'}</p>
          <p><strong>咨询类型:</strong> ${formData.consultationType || '-'}</p>
          <p><strong>学员年龄段:</strong> ${formData.ageGroup || '-'}</p>
          <p><strong>具体需求:</strong> ${formData.requirements || '-'}</p>
        `
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error('发送邮件失败:', error);
          // 即使邮件发送失败，也返回成功，因为数据已经保存
          return res.json({ success: true, message: '咨询表单已提交，我们会尽快与您联系！' });
        }
        console.log('邮件已发送:', info.response);
        res.json({ success: true, message: '咨询表单已提交，我们会尽快与您联系！' });
      });
    } catch (mailError) {
      console.error('发送邮件错误:', mailError);
      // 即使邮件发送失败，也返回成功，因为数据已经保存
      res.json({ success: true, message: '咨询表单已提交，我们会尽快与您联系！' });
    }
  } catch (error) {
    console.error('处理表单提交错误:', error);
    res.status(500).json({ success: false, message: '提交失败，请稍后再试' });
  }
});

// 获取所有咨询记录API
app.get('/api/consultations', async (req, res) => {
  try {
    await db.read();
    const consultations = db.data.consultations || [];
    res.json({
      success: true,
      consultations
    });
  } catch (error) {
    console.error('获取咨询记录错误:', error);
    res.status(500).json({ success: false, message: '获取数据失败' });
  }
});

// 后台管理页面
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`后台管理页面: http://localhost:${PORT}/admin`);
});