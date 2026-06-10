// /api/confirm-payment.js
// 토스페이먼츠 결제 검증 + Firestore plan 업데이트

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore }                  from 'firebase-admin/firestore';

// Firebase Admin 초기화 (Vercel 환경변수에서 서비스 계정 읽기)
function getAdminDb() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId:   process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey:  (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      }),
    });
  }
  return getFirestore();
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { paymentKey, orderId, amount, uid, lang } = req.body;

  // 필수 파라미터 검증
  if (!paymentKey || !orderId || !amount || !uid) {
    return res.status(400).json({ error: '필수 파라미터 누락' });
  }

  try {
    // 1. 토스페이먼츠 서버에 결제 최종 승인 요청
    const secretKey  = process.env.TOSS_SECRET_KEY;
    const authHeader = 'Basic ' + Buffer.from(secretKey + ':').toString('base64');

    const tossRes = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method:  'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ paymentKey, orderId, amount }),
    });

    const tossData = await tossRes.json();

    if (!tossRes.ok) {
      console.error('토스 승인 실패:', tossData);
      return res.status(400).json({ error: tossData.message || '결제 승인 실패', code: tossData.code });
    }

    // 2. 결제 성공 → Firestore 업데이트
    const db = getAdminDb();
    const userRef = db.collection('users').doc(uid);

    await userRef.set({
      plan:       'pro',
      role:       'user',
      proLang:    lang || 'all',          // 어떤 언어 Pro인지
      proSince:   new Date().toISOString(),
      orderId:    orderId,
      paymentKey: paymentKey,
      amount:     amount,
    }, { merge: true });

    // 3. 결제 내역 별도 저장
    await db.collection('payments').add({
      uid, orderId, paymentKey, amount,
      lang:      lang || 'all',
      method:    tossData.method,
      status:    tossData.status,
      paidAt:    tossData.approvedAt || new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });

    return res.status(200).json({ success: true, payment: tossData });

  } catch (err) {
    console.error('confirm-payment 오류:', err);
    return res.status(500).json({ error: err.message || '서버 오류' });
  }
}
