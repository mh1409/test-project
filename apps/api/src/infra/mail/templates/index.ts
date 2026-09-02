import type { Locale } from '@souq/types';

export type EmailTemplateName =
  | 'welcome'
  | 'verify-email'
  | 'password-reset'
  | 'order-confirmation'
  | 'order-shipped'
  | 'order-delivered'
  | 'return-update'
  | 'refund-processed'
  | 'seller-new-sale'
  | 'payout-paid'
  | 'seller-verification'
  | 'abandoned-cart'
  | 'auction-outbid'
  | 'auction-won'
  | 'security-alert'
  | 'generic';

interface Rendered {
  subject: string;
  html: string;
  text: string;
}

const esc = (s: unknown): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function layout(locale: Locale, title: string, body: string, cta?: { label: string; url: string }): string {
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const font = locale === 'ar' ? "'Segoe UI', Tahoma, Arial, sans-serif" : "'Segoe UI', Helvetica, Arial, sans-serif";
  return `<!doctype html><html lang="${locale}" dir="${dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(title)}</title></head>
<body style="margin:0;background:#f6f7f9;font-family:${font};color:#111827;direction:${dir}">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px">
<table role="presentation" width="600" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden">
<tr><td style="background:#0f766e;color:#fff;padding:20px 24px;font-size:20px;font-weight:700">${locale === 'ar' ? 'سوق' : 'Souq'}</td></tr>
<tr><td style="padding:24px;font-size:16px;line-height:1.7"><h1 style="font-size:20px;margin:0 0 16px">${esc(title)}</h1>${body}
${cta ? `<p style="margin:24px 0"><a href="${esc(cta.url)}" style="background:#0f766e;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block">${esc(cta.label)}</a></p><p style="font-size:12px;color:#6b7280">${esc(cta.url)}</p>` : ''}
</td></tr>
<tr><td style="padding:16px 24px;font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb">${locale === 'ar' ? 'هذه رسالة آلية من سوق. لا تشارك رموز التحقق مع أي شخص.' : 'This is an automated message from Souq. Never share verification codes with anyone.'}</td></tr>
</table></td></tr></table></body></html>`;
}

function money(v: unknown): string {
  return typeof v === 'number' ? (v / 100).toFixed(2) : String(v ?? '');
}

type Data = Record<string, unknown>;
const T: Record<EmailTemplateName, Record<Locale, (d: Data) => { subject: string; title: string; body: string; cta?: { label: string; url: string } }>> = {
  welcome: {
    ar: (d) => ({ subject: 'مرحبًا بك في سوق', title: `أهلًا ${esc(d.name)}!`, body: `<p>سعداء بانضمامك. ابدأ التسوق أو افتح متجرك اليوم.</p>`, cta: { label: 'ابدأ التسوق', url: String(d.appUrl) } }),
    en: (d) => ({ subject: 'Welcome to Souq', title: `Welcome, ${esc(d.name)}!`, body: `<p>We're glad you're here. Start shopping or open your store today.</p>`, cta: { label: 'Start shopping', url: String(d.appUrl) } }),
  },
  'verify-email': {
    ar: (d) => ({ subject: 'تأكيد بريدك الإلكتروني', title: 'تأكيد البريد الإلكتروني', body: `<p>اضغط على الزر أدناه لتأكيد بريدك. الرابط صالح لمدة 24 ساعة.</p>`, cta: { label: 'تأكيد البريد', url: String(d.url) } }),
    en: (d) => ({ subject: 'Verify your email', title: 'Verify your email address', body: `<p>Click the button below to verify your email. The link is valid for 24 hours.</p>`, cta: { label: 'Verify email', url: String(d.url) } }),
  },
  'password-reset': {
    ar: (d) => ({ subject: 'إعادة تعيين كلمة المرور', title: 'إعادة تعيين كلمة المرور', body: `<p>تلقينا طلبًا لإعادة تعيين كلمة المرور. الرابط صالح لمدة ساعة. إن لم تطلب ذلك فتجاهل هذه الرسالة.</p>`, cta: { label: 'إعادة التعيين', url: String(d.url) } }),
    en: (d) => ({ subject: 'Reset your password', title: 'Password reset', body: `<p>We received a request to reset your password. The link is valid for 1 hour. If you didn't request this, ignore this email.</p>`, cta: { label: 'Reset password', url: String(d.url) } }),
  },
  'order-confirmation': {
    ar: (d) => ({ subject: `تأكيد الطلب ${esc(d.orderNumber)}`, title: 'شكرًا لطلبك!', body: `<p>تم استلام طلبك رقم <strong>${esc(d.orderNumber)}</strong> بقيمة <strong>${money(d.total)} ${esc(d.currency)}</strong>.</p>${itemsTable(d, 'ar')}`, cta: { label: 'عرض الطلب', url: String(d.url) } }),
    en: (d) => ({ subject: `Order confirmation ${esc(d.orderNumber)}`, title: 'Thank you for your order!', body: `<p>We received order <strong>${esc(d.orderNumber)}</strong> totalling <strong>${money(d.total)} ${esc(d.currency)}</strong>.</p>${itemsTable(d, 'en')}`, cta: { label: 'View order', url: String(d.url) } }),
  },
  'order-shipped': {
    ar: (d) => ({ subject: `تم شحن طلبك ${esc(d.orderNumber)}`, title: 'طلبك في الطريق', body: `<p>تم شحن طلبك. رقم التتبع: <strong>${esc(d.trackingNumber)}</strong> (${esc(d.carrier)}).</p>`, cta: { label: 'تتبع الشحنة', url: String(d.url) } }),
    en: (d) => ({ subject: `Your order ${esc(d.orderNumber)} has shipped`, title: 'Your order is on its way', body: `<p>Tracking number: <strong>${esc(d.trackingNumber)}</strong> (${esc(d.carrier)}).</p>`, cta: { label: 'Track shipment', url: String(d.url) } }),
  },
  'order-delivered': {
    ar: (d) => ({ subject: `تم توصيل طلبك ${esc(d.orderNumber)}`, title: 'تم التوصيل', body: `<p>نأمل أن ينال المنتج إعجابك. شارك تقييمك لمساعدة الآخرين.</p>`, cta: { label: 'قيّم المنتج', url: String(d.url) } }),
    en: (d) => ({ subject: `Order ${esc(d.orderNumber)} delivered`, title: 'Delivered', body: `<p>We hope you love it. Share a review to help other shoppers.</p>`, cta: { label: 'Leave a review', url: String(d.url) } }),
  },
  'return-update': {
    ar: (d) => ({ subject: `تحديث طلب الإرجاع ${esc(d.returnNumber)}`, title: 'تحديث على طلب الإرجاع', body: `<p>الحالة الجديدة: <strong>${esc(d.status)}</strong>.</p>${d.note ? `<p>${esc(d.note)}</p>` : ''}`, cta: { label: 'عرض الطلب', url: String(d.url) } }),
    en: (d) => ({ subject: `Return ${esc(d.returnNumber)} update`, title: 'Return request update', body: `<p>New status: <strong>${esc(d.status)}</strong>.</p>${d.note ? `<p>${esc(d.note)}</p>` : ''}`, cta: { label: 'View return', url: String(d.url) } }),
  },
  'refund-processed': {
    ar: (d) => ({ subject: 'تم معالجة الاسترداد', title: 'تم استرداد المبلغ', body: `<p>تم استرداد <strong>${money(d.amount)} ${esc(d.currency)}</strong> للطلب ${esc(d.orderNumber)}. قد يستغرق ظهوره 5–10 أيام عمل.</p>` }),
    en: (d) => ({ subject: 'Refund processed', title: 'Your refund is on its way', body: `<p><strong>${money(d.amount)} ${esc(d.currency)}</strong> was refunded for order ${esc(d.orderNumber)}. It may take 5–10 business days to appear.</p>` }),
  },
  'seller-new-sale': {
    ar: (d) => ({ subject: `طلب جديد ${esc(d.orderNumber)}`, title: 'لديك عملية بيع جديدة!', body: `<p>طلب بقيمة <strong>${money(d.total)} ${esc(d.currency)}</strong>. يرجى التأكيد والشحن قبل ${esc(d.shipBy)}.</p>`, cta: { label: 'إدارة الطلب', url: String(d.url) } }),
    en: (d) => ({ subject: `New order ${esc(d.orderNumber)}`, title: 'You made a sale!', body: `<p>Order worth <strong>${money(d.total)} ${esc(d.currency)}</strong>. Please confirm and ship by ${esc(d.shipBy)}.</p>`, cta: { label: 'Manage order', url: String(d.url) } }),
  },
  'payout-paid': {
    ar: (d) => ({ subject: 'تم تحويل مستحقاتك', title: 'تم التحويل', body: `<p>تم تحويل <strong>${money(d.amount)} ${esc(d.currency)}</strong> إلى حسابك المنتهي بـ ${esc(d.last4)}.</p>`, cta: { label: 'عرض التحويلات', url: String(d.url) } }),
    en: (d) => ({ subject: 'Payout sent', title: 'Payout sent', body: `<p><strong>${money(d.amount)} ${esc(d.currency)}</strong> was sent to your account ending in ${esc(d.last4)}.</p>`, cta: { label: 'View payouts', url: String(d.url) } }),
  },
  'seller-verification': {
    ar: (d) => ({ subject: 'تحديث حالة التحقق', title: 'حالة حساب البائع', body: `<p>الحالة الجديدة: <strong>${esc(d.status)}</strong>.</p>${d.note ? `<p>${esc(d.note)}</p>` : ''}`, cta: { label: 'لوحة البائع', url: String(d.url) } }),
    en: (d) => ({ subject: 'Seller verification update', title: 'Seller account status', body: `<p>New status: <strong>${esc(d.status)}</strong>.</p>${d.note ? `<p>${esc(d.note)}</p>` : ''}`, cta: { label: 'Seller dashboard', url: String(d.url) } }),
  },
  'abandoned-cart': {
    ar: (d) => ({ subject: 'نسيت شيئًا في سلتك', title: 'سلتك تنتظرك', body: `<p>لديك ${esc(d.count)} منتجات في السلة. أكمل الشراء قبل نفاد الكمية.</p>`, cta: { label: 'إتمام الشراء', url: String(d.url) } }),
    en: (d) => ({ subject: 'You left something in your cart', title: 'Your cart is waiting', body: `<p>You have ${esc(d.count)} items in your cart. Complete your purchase before they sell out.</p>`, cta: { label: 'Complete checkout', url: String(d.url) } }),
  },
  'auction-outbid': {
    ar: (d) => ({ subject: 'تمت المزايدة بأعلى من عرضك', title: 'لقد تجاوزك أحد المزايدين', body: `<p>المزايدة الحالية على <strong>${esc(d.title)}</strong> هي ${money(d.amount)} ${esc(d.currency)}.</p>`, cta: { label: 'زايد الآن', url: String(d.url) } }),
    en: (d) => ({ subject: "You've been outbid", title: 'Someone outbid you', body: `<p>The current bid on <strong>${esc(d.title)}</strong> is ${money(d.amount)} ${esc(d.currency)}.</p>`, cta: { label: 'Bid again', url: String(d.url) } }),
  },
  'auction-won': {
    ar: (d) => ({ subject: 'مبروك! فزت بالمزاد', title: 'فزت بالمزاد', body: `<p>فزت بـ <strong>${esc(d.title)}</strong> بمبلغ ${money(d.amount)} ${esc(d.currency)}. أكمل الدفع خلال 48 ساعة.</p>`, cta: { label: 'الدفع الآن', url: String(d.url) } }),
    en: (d) => ({ subject: 'Congratulations! You won', title: 'You won the auction', body: `<p>You won <strong>${esc(d.title)}</strong> for ${money(d.amount)} ${esc(d.currency)}. Complete payment within 48 hours.</p>`, cta: { label: 'Pay now', url: String(d.url) } }),
  },
  'security-alert': {
    ar: (d) => ({ subject: 'تنبيه أمني', title: 'نشاط جديد على حسابك', body: `<p>${esc(d.message)}</p><p>إذا لم يكن هذا أنت، غيّر كلمة المرور فورًا.</p>`, cta: { label: 'مراجعة الأمان', url: String(d.url) } }),
    en: (d) => ({ subject: 'Security alert', title: 'New activity on your account', body: `<p>${esc(d.message)}</p><p>If this wasn't you, change your password immediately.</p>`, cta: { label: 'Review security', url: String(d.url) } }),
  },
  generic: {
    ar: (d) => ({ subject: String(d.subject ?? 'إشعار من سوق'), title: String(d.title ?? ''), body: `<p>${esc(d.body)}</p>`, cta: d.url ? { label: String(d.ctaLabel ?? 'عرض'), url: String(d.url) } : undefined }),
    en: (d) => ({ subject: String(d.subject ?? 'Notification from Souq'), title: String(d.title ?? ''), body: `<p>${esc(d.body)}</p>`, cta: d.url ? { label: String(d.ctaLabel ?? 'View'), url: String(d.url) } : undefined }),
  },
};

function itemsTable(d: Data, locale: Locale): string {
  const items = Array.isArray(d.items) ? (d.items as { title: string; quantity: number; total: number }[]) : [];
  if (!items.length) return '';
  const rows = items.map((i) => `<tr><td style="padding:6px 0;border-bottom:1px solid #eee">${esc(i.title)}</td><td style="padding:6px 8px;border-bottom:1px solid #eee">×${i.quantity}</td><td style="padding:6px 0;border-bottom:1px solid #eee">${money(i.total)}</td></tr>`).join('');
  return `<table role="presentation" width="100%" style="font-size:14px;margin-top:12px"><thead><tr><th align="start">${locale === 'ar' ? 'المنتج' : 'Item'}</th><th>${locale === 'ar' ? 'الكمية' : 'Qty'}</th><th align="start">${locale === 'ar' ? 'الإجمالي' : 'Total'}</th></tr></thead><tbody>${rows}</tbody></table>`;
}

export function renderEmail(template: EmailTemplateName, locale: Locale, data: Data): Rendered {
  const fn = T[template]?.[locale] ?? T.generic[locale];
  const r = fn(data);
  const html = layout(locale, r.title, r.body, r.cta);
  const text = `${r.title}\n\n${r.body.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()}${r.cta ? `\n\n${r.cta.label}: ${r.cta.url}` : ''}`;
  return { subject: r.subject, html, text };
}

export const EMAIL_TEMPLATES = Object.keys(T) as EmailTemplateName[];
