import React from 'react';
import { CheckCircle, XCircle } from 'lucide-react';

export default function FieldRow({ field }) {
  return (
    <tr className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
      <td className="py-2 px-3 text-sm font-medium text-gray-700">{field.field}</td>
      <td className="py-2 px-3 text-sm text-gray-500">{field.expected !== null ? String(field.expected) : 'N/A'}</td>
      <td className="py-2 px-3 text-sm text-gray-900">{field.actual !== null ? String(field.actual) : 'N/A'}</td>
      <td className="py-2 px-3 text-center">
        {field.matched ? (
          <CheckCircle className="inline w-5 h-5 text-green-500" />
        ) : (
          <XCircle className="inline w-5 h-5 text-red-500" />
        )}
      </td>
      <td className="py-2 px-3 text-xs text-gray-400 text-right">{(field.score * 100).toFixed(0)}%</td>
    </tr>
  );
}
