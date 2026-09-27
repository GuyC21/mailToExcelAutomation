import { useState } from 'react';
import StatusBadge from './StatusBadge';
import { formatBytes } from '../../utils/format';

const FORMAT_LABELS = { multipart: 'Webhook (multipart)', json: 'Webhook (JSON)', eml: 'קובץ ‎.eml' };

/**
 * Shows the inbound email exactly as the server received it – headers, body and
 * attachments with their processing status – for end-to-end demo transparency.
 * @param {{email: object, results: object[]}} props
 */
const EmailPayloadCard = ({ email, results }) => {
  const [showHeaders, setShowHeaders] = useState(false);
  const statusFor = (name) => (results || []).find((r) => r?.filename === name)?.status;

  return (
    <div className="bg-white rounded-lg shadow border border-gray-100 overflow-hidden">
      <div className="flex flex-wrap justify-between items-center gap-2 p-4 border-b border-gray-100 bg-slate-50">
        <h2 className="text-base md:text-lg font-bold text-gray-800">📨 המייל שהתקבל</h2>
        <span className="text-xs text-gray-500">מזהה #{email.id} · {FORMAT_LABELS[email.source_format] || email.source_format}</span>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 p-4 text-sm">
        <dt className="text-gray-500">מאת</dt><dd className="font-medium break-all" dir="auto">{email.sender}</dd>
        <dt className="text-gray-500">אל</dt><dd className="break-all" dir="auto">{email.recipients}</dd>
        <dt className="text-gray-500">נושא</dt><dd className="font-medium">{email.subject}</dd>
        <dt className="text-gray-500">תאריך</dt><dd dir="ltr" className="text-right">{email.sent_at}</dd>
      </dl>
      <div className="px-4 pb-4">
        <p className="text-xs text-gray-500 mb-1">גוף ההודעה</p>
        <pre className="whitespace-pre-wrap font-sans text-sm bg-gray-50 border border-gray-100 rounded p-3 max-h-40 overflow-y-auto">
          {email.body_text || '(ללא טקסט)'}
        </pre>
      </div>
      <div className="px-4 pb-4">
        <p className="text-xs text-gray-500 mb-1">קבצים מצורפים ({email.attachments.length})</p>
        <ul className="space-y-1">
          {email.attachments.map((a) => (
            <li key={a.filename} className="flex flex-wrap items-center justify-between gap-2 text-sm bg-gray-50 rounded px-3 py-2">
              <span className="break-all">📎 {a.filename} <span className="text-gray-400 text-xs">{a.content_type} · {formatBytes(a.size_bytes)}</span></span>
              {statusFor(a.filename) && <StatusBadge status={statusFor(a.filename)} />}
            </li>
          ))}
        </ul>
      </div>
      <div className="border-t border-gray-100">
        <button type="button" onClick={() => setShowHeaders(!showHeaders)} className="w-full text-right px-4 py-2 text-sm text-blue-600 hover:bg-blue-50">
          {showHeaders ? '▾ הסתר כותרות מלאות (Headers)' : '▸ הצג כותרות מלאות (Headers)'}
        </button>
        {showHeaders && (
          <div className="overflow-x-auto bg-gray-900 text-green-300 text-xs font-mono p-4" dir="ltr">
            {Object.entries(email.headers).map(([key, value]) => (
              <div key={key} className="whitespace-pre-wrap text-left"><span className="text-sky-300">{key}:</span> {value}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailPayloadCard;
