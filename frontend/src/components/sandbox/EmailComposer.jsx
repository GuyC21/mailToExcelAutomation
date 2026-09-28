import { useState } from 'react';
import FilePicker from './FilePicker';

const DEFAULT_EMAIL = {
  from: 'מדי-פארם הנהלת חשבונות <billing@medipharm-care.co.il>',
  to: 'invoices@goldencare.co.il',
  subject: 'טופס התחשבנות ספק – אוגוסט 2026',
  text: 'שלום רב,\nמצורף טופס ההתחשבנות לחודש אוגוסט 2026.\nנודה לאישור קבלה.\n\nבברכה,\nהנהלת חשבונות',
};
const INPUT = 'w-full border border-gray-300 rounded p-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500';

/**
 * Composes a supplier email (or picks a raw .eml) and sends it to the inbox webhook.
 * @param {{onSendComposed: (email: object) => void, onSendEml: (file: File) => void, isSending: boolean}} props
 */
const EmailComposer = ({ onSendComposed, onSendEml, isSending }) => {
  const [email, setEmail] = useState(DEFAULT_EMAIL);
  const [files, setFiles] = useState([]);
  const [emlFiles, setEmlFiles] = useState([]);
  const update = (field) => (e) => setEmail({ ...email, [field]: e.target.value });

  return (
    <div className="bg-white p-5 md:p-6 rounded-lg shadow border border-gray-100 space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-gray-800">מייל נכנס מספק</h2>
        <p className="text-sm text-gray-500">המייל נשלח ל-Webhook של תיבת הדואר, בדיוק כפי שספק דואר אמיתי היה שולח.</p>
      </div>
      <label className="block text-sm">
        <span className="text-gray-700 font-medium">מאת</span>
        <input className={INPUT} value={email.from} onChange={update('from')} dir="auto" />
      </label>
      <label className="block text-sm">
        <span className="text-gray-700 font-medium">אל</span>
        <input className={INPUT} value={email.to} onChange={update('to')} dir="ltr" />
      </label>
      <label className="block text-sm">
        <span className="text-gray-700 font-medium">נושא</span>
        <input className={INPUT} value={email.subject} onChange={update('subject')} />
      </label>
      <label className="block text-sm">
        <span className="text-gray-700 font-medium">גוף ההודעה</span>
        <textarea className={`${INPUT} min-h-[96px] resize-y`} value={email.text} onChange={update('text')} />
      </label>
      <FilePicker files={files} onChange={setFiles} accept=".pdf,image/*" multiple placeholder="צרף טופס התחשבנות (PDF / תמונה)" />
      <button
        type="button"
        onClick={() => onSendComposed({ ...email, files })}
        disabled={!files.length || !email.from.trim() || isSending}
        className="w-full bg-blue-600 text-white font-medium py-2.5 px-4 rounded hover:bg-blue-700 transition shadow-sm disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {isSending ? 'המייל בעיבוד...' : 'שלח מייל לתיבת הדואר'}
      </button>

      <div className="pt-3 border-t border-gray-100">
        <p className="text-sm font-medium text-gray-700 mb-2">או: קובץ מייל מקורי (‎.eml)</p>
        <FilePicker files={emlFiles} onChange={(f) => setEmlFiles(f.slice(0, 1))} accept=".eml,message/rfc822"
          placeholder="בחר קובץ .eml שיוצא מ-Outlook / Gmail" icon="✉️" />
        <button
          type="button"
          onClick={() => onSendEml(emlFiles[0])}
          disabled={!emlFiles.length || isSending}
          className="w-full mt-2 bg-white text-blue-700 border border-blue-300 font-medium py-2 px-4 rounded hover:bg-blue-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          שלח קובץ .eml
        </button>
      </div>
    </div>
  );
};

export default EmailComposer;
